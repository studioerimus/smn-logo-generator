import type { GeneratorResult, GeneratorParams } from './algorithm'
import { polygonToSVGPath, generate } from './algorithm'

export function exportSVG(result: GeneratorResult, seed: number) {
  const { canvasSize, polygon } = result
  const pathD = polygonToSVGPath(polygon)
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${canvasSize}" height="${canvasSize}" viewBox="0 0 ${canvasSize} ${canvasSize}">
  <rect width="${canvasSize}" height="${canvasSize}" fill="white"/>
  <path d="${pathD}" fill="black"/>
</svg>`
  download(`somana-seed-${seed}.svg`, svg, 'image/svg+xml')
}

export function exportPNG(params: GeneratorParams) {
  const SIZE = 1920
  const result = generate(params)
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')!
  const scale = SIZE / result.canvasSize

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, SIZE, SIZE)

  if (result.polygon.length >= 3) {
    ctx.beginPath()
    ctx.fillStyle = '#000000'
    const [fx, fy] = result.polygon[0]
    ctx.moveTo(fx * scale, fy * scale)
    for (let i = 1; i < result.polygon.length; i++) {
      const [x, y] = result.polygon[i]
      ctx.lineTo(x * scale, y * scale)
    }
    ctx.closePath()
    ctx.fill()
  }

  canvas.toBlob(blob => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `somana-seed-${params.seed}.png`
    a.click()
    URL.revokeObjectURL(url)
  }, 'image/png')
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
