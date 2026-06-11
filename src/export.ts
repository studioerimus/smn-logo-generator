import type { GenerationResult } from './algorithm'
import { drawMark } from './draw'

export function exportSVG(result: GenerationResult): void {
  const { poly, CANVAS, seed } = result
  if (poly.length < 3) return

  const pts = poly.map(([x, y]) => `${x},${y}`).join(' ')
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}">
  <rect width="${CANVAS}" height="${CANVAS}" fill="white"/>
  <polygon points="${pts}" fill="black"/>
</svg>`
  trigger(`somana-${seed}.svg`, svg, 'image/svg+xml')
}

export function exportPNG(result: GenerationResult): void {
  const SIZE = 1920
  const canvas = document.createElement('canvas')
  canvas.width  = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')!
  drawMark(ctx, result, false, SIZE)
  canvas.toBlob(blob => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a   = document.createElement('a')
    a.href     = url
    a.download = `somana-${result.seed}.png`
    a.click()
    URL.revokeObjectURL(url)
  }, 'image/png')
}

function trigger(filename: string, content: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const a   = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
