import type { AiAttachment } from '../../types/model'

const imageDataUrl = async (file: File): Promise<string> => {
  if (file.size > 15_000_000) throw new Error('Obraz przekracza 15 MB.')
  const bitmap = await createImageBitmap(file)
  try {
    const canvas = document.createElement('canvas')
    const factor = Math.min(1, 1080 / Math.max(bitmap.width, bitmap.height))
    canvas.width = Math.max(1, Math.round(bitmap.width * factor))
    canvas.height = Math.max(1, Math.round(bitmap.height * factor))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Nie można przetworzyć obrazu.')
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const output = canvas.toDataURL('image/webp', .76)
    if (output.length > 1_800_000) throw new Error('Obraz jest zbyt duży po zmniejszeniu. Wybierz mniejszy plik.')
    return output
  } finally { bitmap.close() }
}

export const convertFile = async (file: File): Promise<AiAttachment> => {
  const base = { id: crypto.randomUUID(), name: file.name.slice(0, 180) }
  if (['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    return { ...base, mime: 'image/webp', dataUrl: await imageDataUrl(file) }
  }
  const extension = file.name.toLowerCase().split('.').pop()
  if (extension === 'pdf') {
    if (file.size > 5_000_000) throw new Error('PDF nie może przekraczać 5 MB.')
    if (!(await file.slice(0, 5).text()).startsWith('%PDF-')) throw new Error('Wybrany plik nie wygląda na poprawny PDF.')
    const fileData = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Nie można odczytać PDF.'))
      reader.onerror = () => reject(new Error('Nie można odczytać PDF.'))
      reader.readAsDataURL(file)
    })
    if (!fileData.startsWith('data:application/pdf;base64,')) throw new Error('Nieprawidłowy format PDF.')
    return { ...base, mime: 'application/pdf', fileData }
  }
  const mime = ({ txt: 'text/plain', md: 'text/markdown', csv: 'text/csv', json: 'application/json' } as Record<string, string>)[extension || '']
  if (!mime) throw new Error('Obsługiwane są obrazy PNG/JPG/WebP oraz pliki PDF, TXT, MD, CSV i JSON.')
  if (file.size > 100_000) throw new Error('Plik tekstowy przekracza 100 KB.')
  return { ...base, mime, text: await file.text() }
}

