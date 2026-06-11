import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import type { GeneratorResult } from './algorithm'

interface CanvasProps {
  result: GeneratorResult
  showScaffold: boolean
  size?: number
  onThumbnailReady?: (dataUrl: string) => void
}

export interface CanvasHandle {
  getDataURL: () => string
}

export const Canvas = forwardRef<CanvasHandle, CanvasProps>(
  ({ result, showScaffold, size = 512 }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useImperativeHandle(ref, () => ({
      getDataURL: () => canvasRef.current?.toDataURL('image/png') ?? '',
    }))

    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const scale = size / result.canvasSize
      canvas.width = size
      canvas.height = size

      ctx.clearRect(0, 0, size, size)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, size, size)

      // Draw grid scaffold
      if (showScaffold) {
        ctx.strokeStyle = '#000000'
        ctx.lineWidth = 1.5 * scale
        ctx.fillStyle = '#ffffff'
        for (const c of result.circles) {
          ctx.beginPath()
          ctx.arc(c.x * scale, c.y * scale, c.r * scale, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()
        }
      }

      // Draw polygon
      if (result.polygon.length < 3) return
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
    }, [result, showScaffold, size])

    return (
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    )
  }
)

Canvas.displayName = 'Canvas'

// Small thumbnail renderer (no scaffold, fixed size)
export function renderThumbnail(result: GeneratorResult, size = 80): string {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const scale = size / result.canvasSize

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, size, size)

  if (result.polygon.length < 3) return canvas.toDataURL()

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
  return canvas.toDataURL()
}
