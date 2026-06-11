import { useCallback, useEffect, useRef, useState } from 'react'
import type { GenerationResult } from './algorithm'
import { generate } from './algorithm'
import { drawMark, renderThumbnail } from './draw'
import { exportSVG, exportPNG } from './export'

const ACCENT = '#143333'

interface HistoryEntry {
  seed:      number
  gridSize:  4 | 5 | 6
  thumbnail: string
}

function randomSeed() {
  return Math.floor(Math.random() * 1_000_000)
}

// ── Segmented grid-size control ──────────────────────────────────────────────
function GridButtons({
  value,
  onChange,
}: {
  value: 4 | 5 | 6
  onChange: (v: 4 | 5 | 6) => void
}) {
  const opts: (4 | 5 | 6)[] = [4, 5, 6]
  return (
    <div style={{ display: 'flex', border: `1px solid ${ACCENT}` }}>
      {opts.map(v => (
        <button
          key={v}
          onClick={() => onChange(v)}
          style={{
            flex: 1,
            padding: '6px 0',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.08em',
            cursor: 'pointer',
            border: 'none',
            borderRight: v !== 6 ? `1px solid ${ACCENT}` : 'none',
            backgroundColor: value === v ? ACCENT : 'white',
            color: value === v ? 'white' : ACCENT,
            transition: 'background 0.1s, color 0.1s',
          }}
        >
          {v}×{v}
        </button>
      ))}
    </div>
  )
}

// ── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({
  on,
  onToggle,
}: {
  on: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={on}
      style={{
        width: 40,
        height: 20,
        borderRadius: 10,
        backgroundColor: on ? ACCENT : '#c4c4c4',
        border: 'none',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 0.15s',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: on ? 22 : 2,
          width: 16,
          height: 16,
          backgroundColor: 'white',
          borderRadius: '50%',
          transition: 'left 0.15s',
          display: 'block',
        }}
      />
    </button>
  )
}

// ── Canvas ───────────────────────────────────────────────────────────────────
function MarkCanvas({
  result,
  showScaffold,
  canvasRef,
}: {
  result: GenerationResult | null
  showScaffold: boolean
  canvasRef: React.RefObject<HTMLCanvasElement | null>
}) {
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !result) return
    const dpr  = window.devicePixelRatio || 1
    const size = canvas.offsetWidth || 512
    canvas.width  = size * dpr
    canvas.height = size * dpr
    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)
    drawMark(ctx, result, showScaffold, size)
  }, [result, showScaffold, canvasRef])

  // Resize handler
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !result) return
    const obs = new ResizeObserver(() => {
      const dpr  = window.devicePixelRatio || 1
      const size = canvas.offsetWidth
      if (!size) return
      canvas.width  = size * dpr
      canvas.height = size * dpr
      const ctx = canvas.getContext('2d')!
      ctx.scale(dpr, dpr)
      drawMark(ctx, result, showScaffold, size)
    })
    if (canvas.parentElement) obs.observe(canvas.parentElement)
    return () => obs.disconnect()
  }, [result, showScaffold, canvasRef])

  return (
    <div
      ref={wrapRef}
      style={{
        width: '100%',
        aspectRatio: '1',
        backgroundColor: 'white',
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  )
}

// ── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [seed, setSeed]           = useState<number>(() => randomSeed())
  const [gridSize, setGridSize]   = useState<4 | 5 | 6>(4)
  const [showScaffold, setScaffold] = useState(true)
  const [result, setResult]       = useState<GenerationResult | null>(null)
  const [history, setHistory]     = useState<HistoryEntry[]>([])

  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Run generation — only called on explicit user actions
  const runGeneration = useCallback((s: number, g: 4 | 5 | 6) => {
    const res = generate(s, g)
    setResult(res)
    return res
  }, [])

  // Initial generation on mount
  useEffect(() => {
    runGeneration(seed, gridSize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Handle RANDOMISER
  const handleRandomise = useCallback(() => {
    // Push current to history before replacing
    setHistory(prev => {
      if (!result) return prev
      const thumb = renderThumbnail(result)
      const entry: HistoryEntry = { seed, gridSize, thumbnail: thumb }
      const filtered = prev.filter(e => e.seed !== seed)
      return [entry, ...filtered].slice(0, 12)
    })
    const newSeed = randomSeed()
    setSeed(newSeed)
    runGeneration(newSeed, gridSize)
  }, [seed, gridSize, result, runGeneration])

  // Handle grid size change — keep seed, regenerate
  const handleGridChange = useCallback((g: 4 | 5 | 6) => {
    setGridSize(g)
    runGeneration(seed, g)
  }, [seed, runGeneration])

  // Recall from history
  const handleRecall = useCallback((entry: HistoryEntry) => {
    setSeed(entry.seed)
    setGridSize(entry.gridSize)
    runGeneration(entry.seed, entry.gridSize)
  }, [runGeneration])

  // Spacebar shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.code === 'Space') { e.preventDefault(); handleRandomise() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleRandomise])

  const PANEL = 300

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    }}>

      {/* ── Left Panel ── */}
      <div style={{
        width: PANEL,
        minWidth: PANEL,
        height: '100%',
        backgroundColor: '#EEEEEE',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>

        {/* Wordmark */}
        <div style={{ padding: '22px 22px 18px' }}>
          <img src="/wordmark.svg" alt="SOMANA" style={{ width: '80%', display: 'block' }} />
        </div>

        {/* Controls */}
        <div style={{ flex: 1, padding: '0 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Grid size */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Label>Grid size</Label>
            <GridButtons value={gridSize} onChange={handleGridChange} />
          </div>

          {/* Scaffold toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Label>Show grid scaffold</Label>
            <Toggle on={showScaffold} onToggle={() => setScaffold(s => !s)} />
          </div>

        </div>

        {/* Export buttons */}
        <div style={{ padding: '16px 22px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={() => result && exportSVG(result)}
            disabled={!result}
            style={{
              padding: '11px 0',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'white',
              backgroundColor: ACCENT,
              border: 'none',
              cursor: result ? 'pointer' : 'default',
              opacity: result ? 1 : 0.4,
            }}
          >
            Export SVG
          </button>
          <button
            onClick={() => result && exportPNG(result)}
            disabled={!result}
            style={{
              padding: '11px 0',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: ACCENT,
              backgroundColor: 'white',
              border: `1px solid ${ACCENT}`,
              cursor: result ? 'pointer' : 'default',
              opacity: result ? 1 : 0.4,
            }}
          >
            Export PNG
          </button>
        </div>
      </div>

      {/* ── Canvas Area ── */}
      <div style={{
        flex: 1,
        height: '100%',
        backgroundColor: 'white',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
      }}>

        {/* Top bar: randomiser + seed */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 12,
          padding: '18px 24px 12px',
        }}>
          <span style={{ fontSize: 10, color: '#aaa', letterSpacing: '0.04em', fontVariantNumeric: 'tabular-nums' }}>
            seed {seed}
          </span>
          <button
            onClick={handleRandomise}
            style={{
              padding: '9px 18px',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'white',
              backgroundColor: ACCENT,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Randomiser
          </button>
        </div>

        {/* Canvas */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, minHeight: 0 }}>
          <div style={{
            height: 'min(calc(100vh - 200px), calc(100vw - 380px))',
            maxHeight: '100%',
            maxWidth: '100%',
            aspectRatio: '1',
          }}>
            <MarkCanvas
              result={result}
              showScaffold={showScaffold}
              canvasRef={canvasRef}
            />
          </div>
        </div>

        {/* Seed history strip */}
        <div style={{ padding: '0 24px 20px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#bbb', marginBottom: 8 }}>
            Seed History
          </div>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
            {Array.from({ length: 12 }).map((_, idx) => {
              const entry = history[idx]
              return entry ? (
                <button
                  key={entry.seed}
                  onClick={() => handleRecall(entry)}
                  title={`Seed ${entry.seed} · ${entry.gridSize}×${entry.gridSize}`}
                  style={{
                    width: 54, height: 54, minWidth: 54,
                    padding: 0,
                    border: entry.seed === seed ? `2px solid ${ACCENT}` : '1px solid #e4e4e4',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    backgroundColor: 'white',
                  }}
                >
                  <img
                    src={entry.thumbnail}
                    alt=""
                    style={{ width: '100%', height: '100%', display: 'block' }}
                  />
                </button>
              ) : (
                <div
                  key={idx}
                  style={{
                    width: 54, height: 54, minWidth: 54,
                    backgroundColor: '#f3f3f3',
                    border: '1px solid #e8e8e8',
                  }}
                />
              )
            })}
          </div>
        </div>

      </div>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#888' }}>
      {children}
    </span>
  )
}
