import type { GenerationResult } from './algorithm'

export function drawMark(
  ctx:          CanvasRenderingContext2D,
  result:       GenerationResult,
  showScaffold: boolean,
  displaySize:  number
): void {
  const { arcs, circles, tourCenters, tourRadii, R, CANVAS } = result
  const s = displaySize / CANVAS

  ctx.clearRect(0, 0, displaySize, displaySize)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, displaySize, displaySize)

  if (showScaffold) {
    // All grid cells at base R — faint, shows grid structure
    ctx.strokeStyle = '#cccccc'
    ctx.lineWidth   = 1 * s
    ctx.fillStyle   = '#f5f5f5'
    for (const [x, y] of circles) {
      ctx.beginPath()
      ctx.arc(x * s, y * s, R * s, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
    // Tour cells at their actual per-node radii — shows the geometry that drives the mark
    ctx.strokeStyle = '#000000'
    ctx.lineWidth   = 1.5 * s
    ctx.fillStyle   = '#ffffff'
    for (let i = 0; i < tourCenters.length; i++) {
      const [x, y] = tourCenters[i]
      ctx.beginPath()
      ctx.arc(x * s, y * s, tourRadii[i] * s, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
  }

  if (arcs.length < 2) return

  // Draw using real arc() calls — perfectly smooth at any resolution.
  // Canvas2D arc() auto-connects exit[i] to entry[i+1] with a straight lineTo,
  // which is exactly the tangent segment we want. closePath() handles the last one.
  ctx.fillStyle = '#000000'
  ctx.beginPath()
  ctx.moveTo(arcs[0].entX * s, arcs[0].entY * s)
  for (const arc of arcs) {
    ctx.arc(arc.cx * s, arc.cy * s, arc.r * s, arc.thetaEntry, arc.thetaExit, arc.ccw)
  }
  ctx.closePath()
  ctx.fill()
}

export function renderThumbnail(result: GenerationResult, size = 80): string {
  const canvas  = document.createElement('canvas')
  canvas.width  = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  drawMark(ctx, result, false, size)
  return canvas.toDataURL()
}
