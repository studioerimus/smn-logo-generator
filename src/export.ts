import type { GenerationResult, ArcSegment } from './algorithm'
import { drawMark } from './draw'

// Arc span in [0, 2π] for large-arc-flag computation
function arcSpan(arc: ArcSegment): number {
  const TAU = Math.PI * 2
  if (arc.ccw) {
    // decreasing angle — span is entry minus exit (mod TAU)
    return ((arc.thetaEntry - arc.thetaExit) % TAU + TAU) % TAU
  } else {
    // increasing angle — span is exit minus entry (mod TAU)
    return ((arc.thetaExit - arc.thetaEntry) % TAU + TAU) % TAU
  }
}


function buildSVGPathWithLines(arcs: ArcSegment[]): string {
  if (arcs.length === 0) return ''
  const fmt = (n: number) => n.toFixed(4)

  let d = `M ${fmt(arcs[0].entX)} ${fmt(arcs[0].entY)}`

  for (let i = 0; i < arcs.length; i++) {
    const arc      = arcs[i]
    const r        = arc.r.toFixed(4)
    const span     = arcSpan(arc)
    const largeArc = span > Math.PI ? 1 : 0
    const sweep    = arc.ccw ? 0 : 1
    d += ` A ${r} ${r} 0 ${largeArc} ${sweep} ${fmt(arc.extX)} ${fmt(arc.extY)}`

    if (i < arcs.length - 1) {
      const next = arcs[i + 1]
      d += ` L ${fmt(next.entX)} ${fmt(next.entY)}`
    }
  }

  return d + ' Z'
}

export function exportSVG(result: GenerationResult): void {
  const { arcs, CANVAS, seed } = result
  if (arcs.length < 2) return

  const pathD = buildSVGPathWithLines(arcs)
  const svg   = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}">
  <rect width="${CANVAS}" height="${CANVAS}" fill="white"/>
  <path d="${pathD}" fill="black" fill-rule="nonzero"/>
</svg>`
  trigger(`somana-${seed}.svg`, svg, 'image/svg+xml')
}

export function exportPNG(result: GenerationResult): void {
  const SIZE    = 1920
  const canvas  = document.createElement('canvas')
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

