import type { BitmapData } from '../types/yoboApp'

/**
 * Charge une image et la transforme en bitmap monochrome pour ESC/POS (GS v 0).
 * @param url URL de l'image (locale ou distante)
 * @param maxWidth Largeur max (ex: 256 pour 80mm)
 */
export async function loadImageToEscposBitmap(url: string, maxWidth: number = 256): Promise<BitmapData> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'Anonymous'
    img.onload = () => {
      // 1. Calcul des dimensions (doit être un multiple de 8 pour la largeur)
      let width = img.width
      let height = img.height
      if (width > maxWidth) {
        height = Math.floor((maxWidth / width) * height)
        width = maxWidth
      }
      // Ajustement pour être multiple de 8
      width = Math.floor(width / 8) * 8
      if (width === 0) width = 8

      // 2. Dessin sur Canvas pour obtenir les pixels
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) {
        reject(new Error('Impossible de créer le contexte 2D'))
        return
      }

      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(img, 0, 0, width, height)

      const imageData = ctx.getImageData(0, 0, width, height)
      const pixels = imageData.data

      // 3. Conversion en monochrome Noir Uni (Seuil élevé pour capturer l'orange)
      const bytesPerRow = width / 8
      const bitmap = new Uint8Array(bytesPerRow * height)
      
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4
          const r = pixels[idx]
          const g = pixels[idx + 1]
          const b = pixels[idx + 2]
          const a = pixels[idx + 3]

          // Seuil de conversion : tout ce qui est plus sombre que 128 devient noir
          const grayscale = a < 10 ? 255 : (r + g + b) / 3
          const isBlack = grayscale < 128

          if (isBlack) {
            const byteIdx = y * bytesPerRow + Math.floor(x / 8)
            const bitIdx = 7 - (x % 8)
            bitmap[byteIdx] |= (1 << bitIdx)
          }
        }
      }

      resolve({ data: bitmap, width, height })
    }
    img.onerror = (e) => reject(e)
    img.src = url
  })
}
