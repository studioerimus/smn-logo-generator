import type { GenerationResult } from './algorithm'

export function drawMark(
  ctx: CanvasRenderingContext2D,
  result: GenerationResult,
  showScaffold: boolean,
  displaySize: number
): void {
  const { poly, circles, R, CANVAS } = result
  const s = displaySize / CANVAS

  ctx.clearRect(0, 0, displaySize, displaySize)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, displaySize, displaySize)

  if (showScaffold) {
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 2 * s
    ctx.fillStyle = '#ffffff'
    for (const [x, y] of circles) {
      ctx.beginPath()
      ctx.arc(x * s, y * s, R * s, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
  }

  if (poly.length < 3) return
  ctx.fillStyle = '#000000'
  ctx.strokeStyle = '#000000'
  ctx.lineWidth = 2 * s
  ctx.beginPath()
  ctx.moveTo(poly[0][0] * s, poly[0][1] * s)
  for (let i = 1; i < poly.length; i++)
    ctx.lineTo(poly[i][0] * s, poly[i][1] * s)
  ctx.closePath()
  ctx.fill()
}

export function renderThumbnail(result: GenerationResult, size = 80): string {
  const canvas = document.createElement('canvas')
  canvas.width  = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  drawMark(ctx, result, false, size)
  return canvas.toDataURL()
}
