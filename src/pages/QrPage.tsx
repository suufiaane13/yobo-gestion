// v2 - Nettoyage Imp. Pro
import { useMemo, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useYoboStore } from '../store'
import { isTauriRuntime } from '../lib/isTauriRuntime'
import { writeYoboDocumentsTextExport } from '../lib/yoboDocumentsExports'
import { YoboAlphaInput, YoboNumericInput } from '../components/YoboKeyboardInputs'
import { printQrTicket } from '../lib/ticketPrint'



type QrMode = 'url' | 'instagram' | 'whatsapp' | 'phone' | 'text'

function cleanPhoneDigits(raw: string): string {
  return raw.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '')
}

function ensureHttps(u: string): string {
  const s = u.trim()
  if (!s) return ''
  if (/^https?:\/\//i.test(s)) return s
  return `https://${s}`
}

function buildWhatsAppLink(phone: string, msg: string): string {
  const digits = cleanPhoneDigits(phone).replace(/^\+/, '')
  if (!digits) return ''
  const base = `https://wa.me/${digits}`
  const t = msg.trim()
  return t ? `${base}?text=${encodeURIComponent(t)}` : base
}

function downloadSvg(svg: SVGSVGElement, filename: string) {
  const xml = new XMLSerializer().serializeToString(svg)
  const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

const BRAND_ICONS = {
  instagram: (
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.947.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" fill="currentColor"/>
  ),
  whatsapp: (
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" fill="currentColor"/>
  ),
  url: (
    <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm6.93 6h-2.95a15.65 15.65 0 00-1.38-3.56A8.03 8.03 0 0118.93 8zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14C4.1 13.36 4 12.69 4 12s.1-1.36.26-2h3.38c-.08.66-.14 1.32-.14 2s.06 1.34.14 2H4.26zm.81 2h2.95c.32 1.25.78 2.45 1.38 3.56A8.03 8.03 0 015.07 16zm2.95-8H5.07a8.03 8.03 0 013.91-3.56A15.65 15.65 0 007.6 8zm4.4 11.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82c-.43 1.43-1.08 2.76-1.91 3.96zM10.1 14c-.08-.66-.14-1.32-.14-2s.06-1.34.14-2h3.8c.08.66.14 1.32.14 2s-.06 1.34-.14 2h-3.8zm3.28 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95a8.03 8.03 0 01-4.33 3.56zM15.8 14c.08-.66.14-1.32.14-2s-.06-1.34-.14-2h3.38c.16.64.26 1.31.26 2s-.1 1.36-.26 2H15.8z" fill="currentColor"/>
  ),
  phone: (
    <path d="M6.62 10.79c1.44 2.82 3.76 5.14 6.58 6.58l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.58.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.46.57 3.58.11.35.03.74-.25 1.02l-2.22 2.2z" fill="currentColor"/>
  ),
  text: (
    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" fill="currentColor"/>
  )
}

export function QrPage() {
  const userId = useYoboStore((s) => s.userId)
  const pushToast = useYoboStore((s) => s.pushToast)
  const ticketPrinterA = useYoboStore((s) => s.ticketPrinterA)
  const ticketShopLabel = useYoboStore((s) => s.ticketShopLabel)

  const [mode, setMode] = useState<QrMode>('instagram')
  const [label, setLabel] = useState('Instagram')
  const [value, setValue] = useState('')
  const [waMsg, setWaMsg] = useState('Bonjour')

  const qrValue = useMemo(() => {
    if (mode === 'instagram') {
      const u = value.trim().replace(/^@/, '')
      return u ? `https://instagram.com/${encodeURIComponent(u)}` : ''
    }
    if (mode === 'whatsapp') return buildWhatsAppLink(value, waMsg)
    if (mode === 'phone') {
      const p = cleanPhoneDigits(value)
      return p ? `tel:${p}` : ''
    }
    if (mode === 'url') return ensureHttps(value)
    return value.trim()
  }, [mode, value, waMsg])

  const config = useMemo(() => {
    const types: { id: QrMode; label: string; icon: keyof typeof BRAND_ICONS; color: string; hint: string }[] = [
      { id: 'instagram', label: 'Instagram', icon: 'instagram', color: '#E1306C', hint: 'Saisis un @ ou un nom (ex. yobo.snack)' },
      { id: 'whatsapp', label: 'WhatsApp', icon: 'whatsapp', color: '#25D366', hint: 'Saisis un numéro (ex. +2126...)' },
      { id: 'url', label: 'Site Web', icon: 'url', color: '#4285F4', hint: 'Site (https://...)' },
      { id: 'phone', label: 'Téléphone', icon: 'phone', color: '#FBBC05', hint: 'Numéro à appeler (tel:)' },
      { id: 'text', label: 'Texte Libre', icon: 'text', color: '#757575', hint: 'Texte libre' },
    ]
    return {
      current: types.find((t) => t.id === mode)!,
      all: types
    }
  }, [mode])

  const preset = (m: QrMode) => {
    setMode(m)
    const t = config.all.find(x => x.id === m)!
    setLabel(t.label)
    setValue('')
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* 1. CONFIGURATION COLUMN */}
      <div className="flex-1 space-y-6">
        
        {/* Type Selection Card */}
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--muted)] opacity-60">
            <span className="material-symbols-outlined text-[16px]">category</span>
            Type de QR Code
          </div>
          
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {config.all.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => preset(t.id)}
                className={`group flex flex-col items-center justify-center gap-2 rounded-2xl border p-4 transition-all hover:scale-[1.02] active:scale-95 ${
                  mode === t.id
                    ? 'border-[var(--accent)] bg-[var(--accent-bg)] shadow-md ring-1 ring-[var(--accent)]'
                    : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent-border)]'
                }`}
              >
                <div 
                  className={`flex size-10 items-center justify-center rounded-xl transition-colors ${
                    mode === t.id ? 'bg-[var(--accent)] text-white' : 'bg-[var(--card)] text-[var(--muted)] group-hover:text-[var(--accent)]'
                  }`}
                >
                  <svg viewBox="0 0 24 24" className="size-5">
                    {BRAND_ICONS[t.icon]}
                  </svg>
                </div>
                <span className={`text-[10px] font-black uppercase tracking-tight ${mode === t.id ? 'text-[var(--accent)]' : 'text-[var(--muted)]'}`}>
                  {t.label}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Content Card */}
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-0 shadow-sm overflow-hidden">
          <div className="border-b border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--muted)] opacity-60">
              <span className="material-symbols-outlined text-[16px]">edit_note</span>
              Contenu & Personnalisation
            </div>
          </div>
          
          <div className="p-6 space-y-6">
            <div className="grid gap-6">
              <div className="space-y-2">
                <label className="text-[11px] font-black uppercase tracking-widest text-[var(--muted)] ml-1" htmlFor="qr-value">
                  {config.current.label}
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-3.5 text-[20px] text-[var(--muted)] opacity-40">
                    link
                  </span>
                  {mode === 'phone' || mode === 'whatsapp' ? (
                    <YoboNumericInput
                      id="qr-value"
                      className="yobo-modal-field w-full !pl-10 h-12"
                      value={value}
                      onValueChange={setValue}
                      placeholder={config.current.hint}
                      variant="pin"
                      maskPin={false}
                      keyboardMaxLen={18}
                      autoComplete="off"
                    />
                  ) : (
                    <YoboAlphaInput
                      id="qr-value"
                      className="yobo-modal-field w-full !pl-10 h-12"
                      value={value}
                      onValueChange={setValue}
                      placeholder={config.current.hint}
                      autoComplete="off"
                      keyboardMaxLength={220}
                      autoCapitalize="off"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                  )}
                </div>
              </div>
            </div>

            {mode === 'whatsapp' && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="text-[11px] font-black uppercase tracking-widest text-[var(--muted)] ml-1" htmlFor="wa-msg">
                  Message Automatique (optionnel)
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-3 text-[20px] text-[var(--muted)] opacity-40">
                    forum
                  </span>
                  <YoboAlphaInput
                    id="wa-msg"
                    className="yobo-modal-field w-full !pl-10 min-h-[5rem] !pt-2.5"
                    value={waMsg}
                    onValueChange={(v) => setWaMsg(v.slice(0, 200))}
                    placeholder="Bonjour, je souhaiterais..."
                    autoComplete="off"
                    keyboardMaxLength={200}
                  />
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-[var(--muted)] opacity-50">
                <span className="material-symbols-outlined text-[14px]">visibility</span>
                Lien généré
              </div>
              <div className="mt-2 text-xs font-mono break-all text-[var(--accent)] bg-[var(--accent-bg)] px-3 py-2 rounded-lg border border-[var(--accent-border)]/20">
                {qrValue || "—"}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* 2. PREVIEW COLUMN */}
      <div className="lg:w-[320px] xl:w-[380px] space-y-6">
        <aside className="sticky top-6 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-0 shadow-xl overflow-hidden">
          <div className="bg-gradient-to-tr from-[var(--surface)] to-[var(--card)] p-8">
            {/* The "Sticker" Mockup */}
            <div className="relative mx-auto aspect-square w-full max-w-[280px] rounded-[2.5rem] bg-white p-6 shadow-2xl ring-8 ring-black/5 flex flex-col items-center justify-center transition-transform hover:scale-[1.02] duration-500">
              
              <div className="flex-1 flex items-center justify-center w-full">
                {qrValue ? (
                  <div id="yobo-qr-svg" className="p-2 bg-white rounded-xl">
                    <QRCodeSVG 
                      value={qrValue} 
                      size={200} 
                      level="H"
                      includeMargin={false}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 text-center p-8 opacity-20">
                    <span className="material-symbols-outlined text-[64px]">qr_code_2</span>
                    <span className="text-[10px] font-black uppercase tracking-widest">En attente<br/>de données</span>
                  </div>
                )}
              </div>

            </div>

            <p className="mt-8 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--muted)] opacity-40">
              Aperçu de votre Sticker
            </p>
          </div>

          <div className="p-6 space-y-3 bg-[var(--card)]">
            <button
              type="button"
              className="yobo-modal-btn yobo-modal-btn--primary w-full justify-center h-12 shadow-lg shadow-[var(--accent)]/10"
              disabled={!qrValue}
              onClick={() => {
                const svg = document.querySelector('#yobo-qr-svg svg') as SVGSVGElement | null
                if (!svg) return
                const filename = `QR-${(label || 'QR').replace(/\s+/g, '_')}.svg`
                if (isTauriRuntime() && userId != null) {
                  const xml = new XMLSerializer().serializeToString(svg)
                  void (async () => {
                    try {
                      const out = await writeYoboDocumentsTextExport({
                        userId,
                        kind: 'qr',
                        filename,
                        content: xml,
                      })
                      pushToast('success', `QR enregistré: ${out}`)
                    } catch {
                      pushToast('error', 'Export QR impossible.')
                    }
                  })()
                  return
                }
                downloadSvg(svg, filename)
                pushToast('success', 'QR téléchargé.')
              }}
            >
              <span className="material-symbols-outlined text-[20px]">download</span>
              Télécharger SVG
            </button>
            
            <button
              type="button"
              className="yobo-modal-btn yobo-modal-btn--ghost w-full justify-center h-11 border-[var(--border)]"
              disabled={!qrValue}
              onClick={async () => {
                try {
                  await printQrTicket({
                    printer: ticketPrinterA,
                    label: label || config.current.label,
                    value: qrValue,
                    shopLabel: ticketShopLabel,
                  })
                  pushToast('success', 'Impression QR envoyée.')
                } catch (e) {
                  console.error(e)
                  pushToast('error', "Échec de l'impression QR.")
                }
              }}
            >
              <span className="material-symbols-outlined text-[18px]">print</span>
              Imprimer
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}


