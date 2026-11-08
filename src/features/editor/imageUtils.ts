const SUPPORTED = ['image/jpeg', 'image/png', 'image/webp']
const MAX_UPLOAD_SIZE = 25 * 1024 * 1024
const MAX_DIMENSION = 1500

export const compressImage = async (file: File): Promise<string> => {
  if (!SUPPORTED.includes(file.type)) throw new Error('Dodaj obraz JPG, PNG lub WebP (SVG i GIF nie są obsługiwane).')
  if (file.size > MAX_UPLOAD_SIZE) throw new Error('Obraz nie może przekraczać 25 MB.')

  const bitmap = await createImageBitmap(file)
  try {
    const factor = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * factor))
    canvas.height = Math.max(1, Math.round(bitmap.height * factor))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Nie można przetworzyć obrazu')
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/webp', 0.82)
    if (dataUrl.length > 8_000_000) throw new Error('Obraz po kompresji jest zbyt duży')
    return dataUrl
  } finally {
    bitmap.close()
  }
}
