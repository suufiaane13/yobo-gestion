/**
 * Utilitaire ultra-léger pour générer des commandes ESC/POS en mode texte.
 * Indépendant de tout moteur de rendu graphique.
 */

export class EscPosBuilder {
  private buffer: number[] = []

  private textLines: string[] = []

  constructor() {
    // 1. Initialisation imprimante (ESC @)
    this.buffer.push(0x1B, 0x40)
    // 2. Sortir du mode Chinois/Japonais (FS .) - Très important pour la compatibilité accents
    this.buffer.push(0x1C, 0x2E)
    // 3. Signal sonore (Buzzer)
    this.buffer.push(0x07, 0x1B, 0x42, 0x02, 0x02)
    // 4. Sélection de la table de caractères WPC1252 (Windows Western) — ESC t n
    // Souvent plus compatible avec les drivers Windows que PC850
    this.buffer.push(0x1B, 0x74, 0x10) 
  }


  /** Mappage robuste pour le français (WPC1252 / CP850) */
  private encodeCP850(str: string): number[] {
    const output: number[] = []
    
    // Normalisation pour décomposer les accents si nécessaire
    // Mais on garde d'abord les caractères complets pour le mappage direct
    for (let i = 0; i < str.length; i++) {
        const char = str[i]
        const code = char.charCodeAt(0)

        // Caractères ASCII standard
        if (code < 128) {
            output.push(code)
            continue
        }

        // Mappage manuel pour Windows-1252 (Français)
        const mapping: Record<string, number> = {
          '€': 0x80, 'é': 0xE9, 'è': 0xE8, 'ê': 0xEA, 'ë': 0xEB,
          'à': 0xE0, 'â': 0xE2, 'î': 0xEE, 'ï': 0xEF, 'ô': 0xF4,
          'û': 0xFB, 'ù': 0xF9, 'ç': 0xE7, '°': 0xB0,
          'œ': 0x9C, 'Œ': 0x8C,
          'É': 0xC9, 'È': 0xC8, 'Ê': 0xCA, 'À': 0xC0, 'Â': 0xC2,
          'Î': 0xCE, 'Ô': 0xD4, 'Û': 0xDB, 'Ç': 0xC7
        }

        if (mapping[char] !== undefined) {
            output.push(mapping[char])
        } else {
            // FALLBACK : On essaie de retirer l'accent pour éviter les symboles bizarres
            // ex: 'ê' -> 'e', 'ô' -> 'o'
            const normalized = char.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            if (normalized.length > 0 && normalized.charCodeAt(0) < 128) {
                output.push(normalized.charCodeAt(0))
            } else {
                output.push(0x3F) // '?' par défaut
            }
        }
    }
    return output
  }

  /** Aligne le texte : 0 = gauche, 1 = centre, 2 = droite */
  align(pos: 0 | 1 | 2): this {
    this.buffer.push(0x1B, 0x61, pos)
    return this
  }

  /** Active/Désactive le Gras */
  bold(on: boolean): this {
    this.buffer.push(0x1B, 0x45, on ? 1 : 0)
    return this
  }

  /** Change la taille du texte (0 à 7) */
  size(width: number, height: number): this {
    const n = (width << 4) | height
    this.buffer.push(0x1D, 0x21, n)
    return this
  }

  /** Ajoute une ligne de texte (avec conversion d'encadrement CP850) */
  text(str: string): this {
    const bytes = this.encodeCP850(str)
    bytes.forEach(b => this.buffer.push(b))
    return this
  }


  line(str: string = ''): this {
    this.text(str + '\n')
    this.textLines.push(str)
    return this
  }

  feed(n: number = 3): this {
    this.buffer.push(0x1B, 0x64, n)
    return this
  }

  /** Coupe le papier */
  cut(): this {
    this.buffer.push(0x1D, 0x56, 66, 0)
    return this
  }

  /** Séparateur pointillé (avec bordures optionnelles pour alignement box) */
  dashedLine(bordered: boolean = false): this {
    if (bordered) {
      this.line('+' + '-'.repeat(42 - 2) + '+')
    } else {
      this.line('-'.repeat(42))
    }
    return this
  }

  /** Séparateur plein (avec bordures optionnelles pour alignement box) */
  solidLine(bordered: boolean = false): this {
    if (bordered) {
      this.line('+' + '='.repeat(42 - 2) + '+')
    } else {
      this.line('='.repeat(42))
    }
    return this
  }

  /** Ajoute une ligne avec texte à gauche et valeur à droite (ex: Articles | Prix) */
  row(left: string, right: string, width: number = 32): this {
    const leftPart = left.slice(0, width - right.length - 1)
    const spaces = ' '.repeat(width - leftPart.length - right.length)
    this.line(`${leftPart}${spaces}${right}`)
    return this
  }

  /** Active/Désactive l’inversion des couleurs (blanc sur noir) — GS B n */
  invert(on: boolean): this {
    this.buffer.push(0x1d, 0x42, on ? 1 : 0)
    return this
  }

  /** Active/Désactive le soulignement — ESC - n */
  underline(on: boolean): this {
    this.buffer.push(0x1b, 0x2d, on ? 1 : 0)
    return this
  }

  /** Imprime un QR Code natif robuste (Correction Soufiane-Zero-Ghost) — GS ( k */
  printQrCode(data: string, size: number = 4): this {
    // 0. Reset universel des styles (ESC ! 0)
    this.buffer.push(0x1B, 0x21, 0x00) 

    // On ajoute un espace de sécurité à la fin pour que l'imprimante ne "mange" pas la dernière lettre
    const safeData = data + " "
    const bytes = Array.from(new TextEncoder().encode(safeData))
    
    // len = cn(1) + fn(1) + m(1) + data(k) = k + 3
    const len = bytes.length + 3
    const pL = len & 0xff
    const pH = (len >> 8) & 0xff

    // 1. Taille du module (Function 167) — Paramètre n=size
    this.buffer.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, size)
    
    // 2. Stockage des données (Function 180) — m=0 (NULL) pour invisibilité totale
    this.buffer.push(0x1d, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x00)
    bytes.forEach((b) => this.buffer.push(b))
    
    // 3. Impression (Function 181) — m=0 (NULL)
    this.buffer.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x00)

    return this
  }

  /** Imprime un logo bitmap 1-bit — GS v 0 */
  printBitmap(pixels: Uint8Array, width: number, height: number): this {
    const bytesPerRow = Math.ceil(width / 8)
    const xL = bytesPerRow & 0xff
    const xH = (bytesPerRow >> 8) & 0xff
    const yL = height & 0xff
    const yH = (height >> 8) & 0xff

    this.buffer.push(0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH)
    pixels.forEach((b) => this.buffer.push(b))
    return this
  }

  /** Ligne avec bordures ASCII (Modifié pour compatibilité totale) */
  boxLine(text: string, width: number = 32): this {
    const border = '+' + '-'.repeat(width - 2) + '+'
    const cleanText = text.slice(0, width - 4)
    const padding = width - 2 - cleanText.length
    const padLeft = Math.floor(padding / 2)
    const padRight = padding - padLeft
    const content = '|' + ' '.repeat(padLeft) + cleanText + ' '.repeat(padRight) + '|'
    const bottom = '+' + '-'.repeat(width - 2) + '+'

    this.line(border).line(content).line(bottom)
    return this
  }

  toBytes(): Uint8Array {
    return new Uint8Array(this.buffer)
  }

  toText(): string {
    return this.textLines.join('\n')
  }
}

