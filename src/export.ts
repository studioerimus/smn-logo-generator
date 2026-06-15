import type { GenerationResult, ArcSegment } from './algorithm'
import { generate } from './algorithm'
import { drawMark } from './draw'

function arcSpan(arc: ArcSegment): number {
  const TAU = Math.PI * 2
  if (arc.ccw) {
    return ((arc.thetaEntry - arc.thetaExit) % TAU + TAU) % TAU
  } else {
    return ((arc.thetaExit - arc.thetaEntry) % TAU + TAU) % TAU
  }
}

function buildSVGPath(arcs: ArcSegment[]): string {
  if (arcs.length === 0) return ''
  const fmt = (n: number) => n.toFixed(4)
  let d = `M ${fmt(arcs[0].entX)} ${fmt(arcs[0].entY)}`
  for (let i = 0; i < arcs.length; i++) {
    const arc  = arcs[i]
    const span = arcSpan(arc)
    d += ` A ${arc.r.toFixed(4)} ${arc.r.toFixed(4)} 0 ${span > Math.PI ? 1 : 0} ${arc.ccw ? 0 : 1} ${fmt(arc.extX)} ${fmt(arc.extY)}`
    if (i < arcs.length - 1) d += ` L ${fmt(arcs[i + 1].entX)} ${fmt(arcs[i + 1].entY)}`
  }
  return d + ' Z'
}

function toSVGString(result: GenerationResult): string {
  const { arcs, CANVAS } = result
  if (arcs.length < 2) return ''
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}">
  <rect width="${CANVAS}" height="${CANVAS}" fill="white"/>
  <path d="${buildSVGPath(arcs)}" fill="black" fill-rule="nonzero"/>
</svg>`
}

function download(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export function exportSVG(result: GenerationResult): void {
  const svg = toSVGString(result)
  if (!svg) return
  download(`somana-${result.seed}.svg`, new Blob([svg], { type: 'image/svg+xml' }))
}

export function exportPNG(result: GenerationResult): void {
  const SIZE = 1920
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SIZE
  drawMark(canvas.getContext('2d')!, result, false, SIZE)
  canvas.toBlob(blob => {
    if (blob) download(`somana-${result.seed}.png`, blob)
  }, 'image/png')
}

export async function exportAllAsZip(
  entries: Array<{ seed: number; gridSize: 4 | 5; rRatio: number; sizeVariation: number }>,
  format:  'svg' | 'png'
): Promise<void> {
  if (entries.length === 0) return
  const JSZip = (await import('jszip')).default
  const zip   = new JSZip()

  for (const entry of entries) {
    const result = generate(entry.seed, entry.gridSize, 0.1 + entry.rRatio * 0.4, entry.sizeVariation)
    if (format === 'svg') {
      const svg = toSVGString(result)
      if (svg) zip.file(`somana-${entry.seed}.svg`, svg)
    } else {
      const SIZE = 1920
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = SIZE
      drawMark(canvas.getContext('2d')!, result, false, SIZE)
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
      if (blob) zip.file(`somana-${entry.seed}.png`, await blob.arrayBuffer())
    }
  }

  const content = await zip.generateAsync({ type: 'blob' })
  download(`somana-favourites-${format}.zip`, content)
}
