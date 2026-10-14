export function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  window.setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
