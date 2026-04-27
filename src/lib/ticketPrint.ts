// v2 - Nettoyage Imp. Pro - Stable
// ================= IMPORTS =================
import { client } from './yoboClientMessages'
import { capitalizeFirstLetter } from './yoboStrings'
import type { OrderTicketDetailDto, SessionOrderDetailForPrint } from '../types/yoboApp'
import { useYoboStore } from '../store/yobo-store'
import { EscPosBuilder } from './escposTextBuilder'
import { invoke } from '@tauri-apps/api/core'

/** Largeur standard papier thermique 80mm en caractères (Font A) */
const PRINTER_WIDTH = 42

// ================= TYPES =================
export type TicketLineInput = {
  name: string
  size: string
  quantity: number
  unitPrice: number
  categoryLabel?: string
  lineNote?: string
  hasGratine?: boolean
  gratineAmount?: number
}

export type TicketShopBranding = {
  shopLabel?: string
  shopPhone?: string
}

export interface ClientTicketInput extends TicketShopBranding {
  orderId: number
  timeIso: string
  cashier: string
  orderType?: string | null
  lines: TicketLineInput[]
  total: number
  receivedAmount?: number | null
  changeAmount?: number | null
  customerPhone?: string | null
  customerAddress?: string | null
}

export interface CashCloseTicketInput extends TicketShopBranding {
  sessionId: number
  cashier: string
  closedAtIso?: string | null
  openingAmount: number
  salesTotal: number
  ordersCount: number
  theoretical: number
  closingAmount: number
  gap: number
  comment?: string | null
}

// ================= UTILS =================
function strip(text: string): string {
  if (!text) return ''
  let s = text.replace(/\uFE0F/g, '')
  s = s.replace(/\p{Extended_Pictographic}/gu, '')
  s = s.replace(/\u200D/g, '')
  return s.replace(/\s{2,}/g, ' ').trim()
}

function orderTypeLabel(type?: string | null): string {
  switch (type) {
    case 'sur_place': return 'SUR PLACE'
    case 'emporter': return 'EMPORTER'
    case 'livraison': return 'LIVRAISON'
    default: return 'SUR PLACE'
  }
}

/** Découpe un texte proprement pour l'imprimante thermique */
function wrapText(text: string, width: number): string[] {
  const result: string[] = []
  const words = text.split(' ')
  let currentLine = ''

  words.forEach((word) => {
    if ((currentLine + (currentLine === '' ? '' : ' ') + word).length <= width) {
      currentLine += (currentLine === '' ? '' : ' ') + word
    } else {
      if (currentLine !== '') result.push(currentLine)
      currentLine = word
      // Cas où un mot seul dépasse la largeur
      while (currentLine.length > width) {
        result.push(currentLine.slice(0, width))
        currentLine = currentLine.slice(width)
      }
    }
  })
  if (currentLine !== '') result.push(currentLine)
  return result
}

// ================= GENERATORS (PRO TEXT MODE) =================

/** Génère un EscPosBuilder prêt pour l'impression Client */
function prepareClientTicket(input: ClientTicketInput): EscPosBuilder {
  const b = new EscPosBuilder()
  const d = new Date()
  const timeStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const shopLabel = (input.shopLabel || 'YOBO').toUpperCase()

  // 1. Header Premium (Logo ou Texte)
  const logo = useYoboStore.getState().ticketLogo
  b.align(1)
  if (logo) {
    b.printBitmap(logo.data, logo.width, logo.height).feed(1)
  } else {
    b.boxLine(shopLabel, PRINTER_WIDTH)
  }
  if (input.shopPhone) b.line(input.shopPhone)

  // 2. Order Info
  const shortDate = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
  b.bold(true).row(`#${input.orderId}`, `${shortDate} ${timeStr}`, PRINTER_WIDTH).bold(false)
  b.align(1).invert(true).text(` ${orderTypeLabel(input.orderType)} `).line('').invert(false)
  b.dashedLine()

  if (input.customerPhone || input.customerAddress) {
    b.align(0).bold(true)
    if (input.customerPhone) b.line(`  TEL: ${input.customerPhone}`)
    if (input.customerAddress) {
      const addrLines = wrapText(input.customerAddress.toUpperCase(), PRINTER_WIDTH - 4)
      addrLines.forEach(l => b.line(`  ADR: ${l}`))
    }
    b.bold(false).dashedLine()
  }

  // 3. Groupement par Catégorie
  const categories: Record<string, TicketLineInput[]> = {}
  input.lines.forEach(l => {
    const cat = (l.categoryLabel || 'ARTICLES').toUpperCase()
    if (!categories[cat]) categories[cat] = []
    categories[cat].push(l)
  })

  // 4. Parcourir les catégories
  b.align(0)
  Object.keys(categories).forEach(catName => {
    categories[catName].forEach(l => {
      const qtyPrefix = `${l.quantity}x `
      const catNameNorm = (l.categoryLabel || '').toUpperCase()
      const isHiddenCat = catNameNorm.includes('BOISSON') || catNameNorm.includes('JUS')
      const catPrefix = (l.categoryLabel && !isHiddenCat) ? `${l.categoryLabel.toUpperCase()} - ` : ''
      const sizeSuffix = l.size ? ` ${l.size.toUpperCase()}` : ''
      const fullName = qtyPrefix + catPrefix + l.name.toUpperCase() + sizeSuffix

      const priceStr = `${(l.unitPrice * l.quantity).toFixed(2)} MAD`
      // On réserve de la place pour le prix (ex: 12 chars)
      const maxNameWidth = PRINTER_WIDTH - priceStr.length - 3 // -3 pour les marges
      const lines = wrapText(fullName, maxNameWidth)

      // Première ligne avec le prix
      b.bold(true).row(`  ${lines[0]}`, priceStr, PRINTER_WIDTH).bold(false)

      // Lignes suivantes (si besoin) sans le prix
      if (lines.length > 1) {
        for (let i = 1; i < lines.length; i++) {
          b.bold(true).line(`  ${lines[i]}`).bold(false)
        }
      }

      // Options en dessous (Gratiné, Note)
      if (l.hasGratine) b.line(`    GRATINÉ`)
      if (l.lineNote) b.line(`    Note: ${l.lineNote}`)
    })
  })

  // 5. Bloc Final
  b.align(1).solidLine()
  b.size(1, 1).invert(true).text(` TOTAL: ${input.total.toFixed(2)} MAD `).line('').invert(false).size(0, 0)

  if (input.receivedAmount !== undefined && input.receivedAmount !== null) {
    b.line(`ESPECES: ${input.receivedAmount.toFixed(2)} MAD`)
    if (input.changeAmount !== undefined && input.changeAmount !== null) {
      b.line(`RENDU: ${input.changeAmount.toFixed(2)} MAD`)
    }
  }

  b.solidLine()

  b.align(1)
  b.line('*** Merci de votre visite ! ***')
  return b
}




/** Génère un EscPosBuilder prêt pour l'impression Cuisine (Alignement Client Pro) */
function prepareKitchenTicket(input: ClientTicketInput): EscPosBuilder {
  const b = new EscPosBuilder()
  const d = new Date()
  const timeStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const shopLabel = (input.shopLabel || 'YOBO').toUpperCase()

  // 1. Header Premium (Logo ou Texte)
  const logo = useYoboStore.getState().ticketLogo
  b.align(1)
  if (logo) {
    b.printBitmap(logo.data, logo.width, logo.height).feed(1)
  } else {
    b.boxLine(shopLabel, PRINTER_WIDTH)
  }
  // Numéro de commande (Style Compact)
  b.bold(true).row(`#${input.orderId}`, timeStr, PRINTER_WIDTH).bold(false)
  b.invert(true).text(` ${orderTypeLabel(input.orderType)} `).line('').invert(false)
  b.dashedLine()

  if (input.customerPhone || input.customerAddress) {
    b.align(0).bold(true)
    if (input.customerPhone) b.line(`  TEL: ${input.customerPhone}`)
    if (input.customerAddress) {
      const addrLines = wrapText(input.customerAddress.toUpperCase(), PRINTER_WIDTH - 4)
      addrLines.forEach(l => b.line(`  ADR: ${l}`))
    }
    b.bold(false).dashedLine()
  }

  // 3. Groupement par Catégorie
  const categories: Record<string, TicketLineInput[]> = {}
  input.lines.forEach(l => {
    const cat = (l.categoryLabel || 'ARTICLES').toUpperCase()
    if (!categories[cat]) categories[cat] = []
    categories[cat].push(l)
  })

  // 4. Parcourir les catégories (Même alignement que Client)
  b.align(0)
  Object.keys(categories).forEach(catName => {
    categories[catName].forEach(l => {
      const qtyPrefix = `${l.quantity}x `
      const catPrefix = (l.categoryLabel) ? `${l.categoryLabel.toUpperCase()} - ` : ''
      const sizeSuffix = l.size ? ` ${l.size.toUpperCase()}` : ''
      const fullName = qtyPrefix + catPrefix + l.name.toUpperCase() + sizeSuffix

      const lines = wrapText(fullName, PRINTER_WIDTH - 4)

      // Plats en gras (Alignement Client)
      b.bold(true).line(`  ${lines[0]}`).bold(false)
      if (lines.length > 1) {
        for (let i = 1; i < lines.length; i++) {
          b.bold(true).line(`  ${lines[i]}`).bold(false)
        }
      }

      // Options
      if (l.hasGratine) b.line(`    GRATINÉ`)
      if (l.lineNote) b.line(`    Note: ${l.lineNote}`)
    })
  })

  b.align(1).solidLine()
  b.line('*** BON DE PREPARATION ***')
  b.solidLine()

  b.feed(1)
  return b
}





/** Génère un EscPosBuilder prêt pour l'impression Clôture */
function prepareCashCloseTicket(input: CashCloseTicketInput): EscPosBuilder {
  const b = new EscPosBuilder()
  const d = new Date()
  const dateStr = d.toLocaleDateString('fr-FR')
  const timeStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const shopLabel = (input.shopLabel || 'YOBO').toUpperCase()

  // 1. Header Premium (Logo ou Texte)
  const logo = useYoboStore.getState().ticketLogo
  b.align(1)
  if (logo) {
    b.printBitmap(logo.data, logo.width, logo.height).feed(1)
  } else {
    b.boxLine(shopLabel, PRINTER_WIDTH)
  }
  // 2. Session Info
  b.bold(true).row(`#SESSION ${input.sessionId}`, `${dateStr} ${timeStr}`, PRINTER_WIDTH).bold(false)
  b.line(`OPERATEUR: ${input.cashier.toUpperCase()}`)
  b.invert(true).text(' CLÔTURE DE CAISSE ').line('').invert(false)
  b.solidLine(true)

  // 3. Détails Financiers (Mode Tableau)
  b.align(0)
  b.row('  FOND OUVERTURE', `${input.openingAmount.toFixed(2)} MAD`, PRINTER_WIDTH)
  b.row('  TOTAL VENTES', `${input.salesTotal.toFixed(2)} MAD`, PRINTER_WIDTH)
  b.row('  NB COMMANDES', String(input.ordersCount), PRINTER_WIDTH)
  b.dashedLine(true)

  // 4. Bilan
  b.bold(true)
  b.row('  TOTAL THÉORIQUE', `${input.theoretical.toFixed(2)} MAD`, PRINTER_WIDTH)
  b.row('  TOTAL RÉEL (ESPÈCES)', `${input.closingAmount.toFixed(2)} MAD`, PRINTER_WIDTH)
  b.bold(false)

  b.solidLine(true)
  // 5. Écart (Alerte visuelle)
  if (Math.abs(input.gap) > 0.01) {
    b.align(1).invert(true).text(` ÉCART : ${input.gap.toFixed(2)} MAD `).line('').invert(false)
  } else {
    b.align(1).line('ÉTAT : CAISSE JUSTE')
  }
  b.solidLine(true)
  b.align(1).line('*** FIN DE SERVICE ***')
  return b
}




/** Génère un EscPosBuilder premium pour le ticket QR */
function prepareQrTicket(input: any): EscPosBuilder {
  const b = new EscPosBuilder()
  const shopLabel = (input.shopLabel || 'YOBO').toUpperCase()

  // 1. Header Boxed
  b.align(1)
  b.boxLine(shopLabel, PRINTER_WIDTH)
  // 2. Label Inversé
  b.invert(true).text(` ${input.label.toUpperCase()} `).line('').invert(false)

  // 3. QR Code
  b.printQrCode(input.value, 7)
  b.feed(1)

  // 4. Footer aligné
  b.dashedLine(true)
  b.align(1).bold(true).line(' SCANNEZ POUR NOUS SUIVRE ').bold(false)
  b.dashedLine(true)

  return b
}




// ================= PUBLIC EXPORTS =================

export async function printQrTicket(input: any): Promise<void> {
  const userId = useYoboStore.getState().userId || 0
  const printer = input.printer || useYoboStore.getState().ticketPrinterA
  if (!printer) return

  const b = prepareQrTicket(input)
  b.feed(2).cut()

  await invoke('printers_print_raw_bytes', {
    input: { userId, printerName: printer.trim(), jobName: `QR-${input.label}`, bytes: Array.from(b.toBytes()) }
  })
}

/** Génère le texte brut pour l'aperçu QR */
export function buildQrTicketText(input: any): string {
  return prepareQrTicket(input).toText()
}

export async function printOrderTicket(input: any): Promise<void> {
  const userId = useYoboStore.getState().userId || 0

  // 1. Impression Client (Imprimante A)
  if (input.printerA && input.printerA.trim()) {
    const b = prepareClientTicket(input)
    b.feed(2).cut()
    await invoke('printers_print_raw_bytes', {
      input: { userId, printerName: input.printerA.trim(), jobName: `Client #${input.orderId}`, bytes: Array.from(b.toBytes()) }
    })
  }

  // 2. Impression Cuisine (Imprimante B)
  if (input.printerB && input.printerB.trim()) {
    const b = prepareKitchenTicket(input)
    b.feed(2).cut()
    await invoke('printers_print_raw_bytes', {
      input: { userId, printerName: input.printerB.trim(), jobName: `Cuisine #${input.orderId}`, bytes: Array.from(b.toBytes()) }
    })
  }
}

export async function printTestTicket(printerName: string): Promise<void> {
  if (!printerName.trim()) return
  const userId = useYoboStore.getState().userId || 0

  const b = new EscPosBuilder()

  // 1. En-tête Premium
  b.align(1).boxLine('YOBO SYSTEM TEST', PRINTER_WIDTH)
  b.feed(1)

  // 2. Test des Accents (Preuve de compatibilité)
  b.invert(true).line('  TABLE DE CARACTÈRES  ').invert(false)
  b.align(1)
  b.line('Accents: é à è ê ô û î â ç')
  b.line('Majuscules: É À È Ê Ô Û Î Â Ç')
  b.line('Euro: €  Degré: °')
  b.solidLine(true)

  // 3. Test des Styles
  b.align(0)
  b.row('  STYLE NORMAL', 'OK', PRINTER_WIDTH)
  b.bold(true).row('  STYLE GRAS', 'OK', PRINTER_WIDTH).bold(false)
  b.invert(true).row('  STYLE INVERSÉ ', 'OK ', PRINTER_WIDTH).invert(false)
  b.underline(true).row('  STYLE SOULIGNÉ', 'OK', PRINTER_WIDTH).underline(false)
  b.dashedLine(true)

  // 4. Test des Tailles
  b.align(1).feed(1)
  b.size(1, 1).line('DOUBLE TAILLE')
  b.size(0, 0).feed(1)

  // 5. QR Code Natif Clean
  b.invert(true).line('  QR CODE TEST  ').invert(false)
  b.feed(1)
  b.printQrCode('https://yobo.me', 6)

  b.feed(2)
  b.solidLine(true)
  b.align(1).line(`Date Test: ${new Date().toLocaleString('fr-FR')}`)
  b.line('VERSION LOGICIELLE: V2.5-PRO')
  b.solidLine(true)

  b.feed(4).cut()

  await invoke('printers_print_raw_bytes', {
    input: { userId, printerName: printerName.trim(), jobName: "Test Impression YOBO", bytes: Array.from(b.toBytes()) }
  })
}


export async function printCashCloseTicket(input: CashCloseTicketInput): Promise<void> {
  const printer = useYoboStore.getState().ticketPrinterA || useYoboStore.getState().ticketPrinterB
  const userId = useYoboStore.getState().userId || 0
  if (!printer || !printer.trim()) return

  const b = prepareCashCloseTicket(input)
  b.feed(2).cut()

  await invoke('printers_print_raw_bytes', {
    input: { userId, printerName: printer.trim(), jobName: `Clôture #${input.sessionId}`, bytes: Array.from(b.toBytes()) }
  })
}

/** Génère le texte brut pour l'aperçu simultané Client + Cuisine */
export function buildOrderTicketPreviewText(input: any): string {
  const clientT = prepareClientTicket(input).toText()
  const kitchenT = prepareKitchenTicket(input).toText()

  return `${clientT}\n\n--- COUPURE PAPIER ---\n\n${kitchenT}`
}

/** Génère le texte brut pour l'aperçu Clôture */
export function buildCashClosePreviewText(input: CashCloseTicketInput): string {
  return prepareCashCloseTicket(input).toText()
}

export function orderTicketDetailsFromApi(rows: OrderTicketDetailDto[]): SessionOrderDetailForPrint[] {
  return rows.map((d) => ({
    id: d.id,
    timeIso: d.time,
    total: d.total,
    cashier: strip(capitalizeFirstLetter(d.cashier ?? '') || '—'),
    customerPhone: d.customerPhone ?? null,
    customerAddress: d.customerAddress ?? null,
    lines: (d.lines ?? []).map((l) => ({
      name: strip((l.name ?? '').trim()) || 'Article',
      size: strip((l.size ?? '').trim()),
      quantity: Math.max(1, Math.floor(Number(l.quantity)) || 1),
      unitPrice: typeof l.price === 'number' && Number.isFinite(l.price) ? l.price : 0,
      categoryLabel: l.categoryLabel?.trim(),
      lineNote: l.lineNote?.trim(),
      hasGratine: !!(l as { hasGratine?: boolean }).hasGratine,
      gratineAmount: (l as { gratineAmount?: number }).gratineAmount
    })),
    receivedAmount: d.receivedAmount ?? null,
    changeAmount: d.changeAmount ?? null,
  }))
}

export function ticketPrintUserError(): string {
  return client.warn.ticketPrint
}
