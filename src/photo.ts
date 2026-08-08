/** Photo d’identité : redimensionnée et compressée (data URL JPEG). */

export const PHOTO_MAX_SIDE = 320
export const PHOTO_JPEG_QUALITY = 0.72
export const PHOTO_MAX_INPUT_BYTES = 12 * 1024 * 1024

export function isPhotoDataUrl(value: string | undefined | null): boolean {
  return Boolean(value && /^data:image\/(jpeg|jpg|png|webp|gif);base64,/i.test(value))
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Impossible de lire cette image'))
    }
    img.src = url
  })
}

/** Centre et recadre en carré, puis compresse en JPEG. */
export async function compressIdentityPhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Choisis une image (JPG, PNG, WebP…)')
  }
  if (file.size > PHOTO_MAX_INPUT_BYTES) {
    throw new Error('Image trop lourde (max. 12 Mo)')
  }

  const img = await loadImage(file)
  const side = Math.min(img.naturalWidth, img.naturalHeight)
  if (side < 16) throw new Error('Image trop petite')

  const sx = Math.floor((img.naturalWidth - side) / 2)
  const sy = Math.floor((img.naturalHeight - side) / 2)
  const out = Math.min(PHOTO_MAX_SIDE, side)

  const canvas = document.createElement('canvas')
  canvas.width = out
  canvas.height = out
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas indisponible')

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, sx, sy, side, side, 0, 0, out, out)

  const dataUrl = canvas.toDataURL('image/jpeg', PHOTO_JPEG_QUALITY)
  if (!isPhotoDataUrl(dataUrl)) throw new Error('Compression échouée')
  return dataUrl
}
