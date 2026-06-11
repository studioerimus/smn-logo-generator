import { useCallback, useEffect, useRef, useState } from 'react'
import type { GenerationResult } from './algorithm'
import { generate } from './algorithm'
import { drawMark, renderThumbnail } from './draw'
import { exportSVG, exportPNG } from './export'

const ACCENT        = '#143333'
const HISTORY_LIMIT = 20

interface HistoryEntry {
  seed:          number
  gridSize:      3 | 4 | 5 | 6
  rRatio:        number
  sizeVariation: number
  thumbnail:     string
  pinned:        boolean
}

function randomSeed() {
  return Math.floor(Math.random() * 1_000_000)
}

// FIFO eviction respects pinned entries
function addToHistory(entry: HistoryEntry, prev: HistoryEntry[]): HistoryEntry[] {
  const filtered = prev.filter(e => e.seed !== entry.seed)
  const combined = [entry, ...filtered]
  if (combined.length <= HISTORY_LIMIT) return combined
  for (let i = combined.length - 1; i >= 0; i--) {
    if (!combined[i].pinned) return [...combined.slice(0, i), ...combined.slice(i + 1)]
  }
  return combined.slice(0, HISTORY_LIMIT)
}

// ── Slider ───────────────────────────────────────────────────────────────────
function LabeledSlider({ label, value, display, min, max, step, onChange }: {
  label: string; value: number; display: string
  min: number; max: number; step: number
  onChange: (v: number) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Label>{label}</Label>
        <span style={{ fontSize: 10, color: '#888', fontVariantNumeric: 'tabular-nums', letterSpacing: '0.04em' }}>
          {display}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: ACCENT, cursor: 'pointer' }}
      />
    </div>
  )
}

// ── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={on}
      style={{
        width: 40, height: 20, borderRadius: 10,
        backgroundColor: on ? ACCENT : '#c4c4c4',
        border: 'none', cursor: 'pointer', position: 'relative',
        transition: 'background 0.15s', flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: on ? 22 : 2,
        width: 16, height: 16, backgroundColor: 'white', borderRadius: '50%',
        transition: 'left 0.15s', display: 'block',
      }} />
    </button>
  )
}

// ── Canvas ───────────────────────────────────────────────────────────────────
function MarkCanvas({ result, showScaffold, canvasRef }: {
  result: GenerationResult | null
  showScaffold: boolean
  canvasRef: React.RefObject<HTMLCanvasElement | null>
}) {
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
    <div style={{
      width: '100%', aspectRatio: '1',
      backgroundColor: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
    }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  )
}

// ── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [seed, setSeed]             = useState<number>(() => randomSeed())
  const [gridSize, setGridSize]     = useState<3 | 4 | 5 | 6>(4)
  const [rRatio, setRRatio]         = useState(0.44)
  const [sizeVar, setSizeVar]       = useState(1)
  const [showScaffold, setScaffold] = useState(false)
  const [result, setResult]         = useState<GenerationResult | null>(null)
  const [history, setHistory]       = useState<HistoryEntry[]>([])
  const [isPlaying, setIsPlaying]   = useState(false)

  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const isPlayingRef = useRef(false)

  // Kept current so stable interval callbacks avoid stale closures
  const latestRef = useRef({ seed, gridSize, rRatio, sizeVar, result })
  useEffect(() => { latestRef.current = { seed, gridSize, rRatio, sizeVar, result } })

  const stopAutoplay = useCallback(() => {
    isPlayingRef.current = false
    if (intervalRef.current !== null) { clearInterval(intervalRef.current); intervalRef.current = null }
    setIsPlaying(false)
  }, [])

  // Core step shared by manual button and autoplay interval
  const randomiseStep = useCallback(() => {
    const { seed: s, gridSize: g, rRatio: rr, sizeVar: sv, result: r } = latestRef.current
    if (r) {
      const thumb = renderThumbnail(r)
      setHistory(prev => addToHistory(
        { seed: s, gridSize: g, rRatio: rr, sizeVariation: sv, thumbnail: thumb, pinned: false },
        prev
      ))
    }
    const newSeed = randomSeed()
    setSeed(newSeed)
    setResult(generate(newSeed, g, rr, sv))
  }, [])

  // Initial generation on mount
  useEffect(() => {
    setResult(generate(seed, gridSize, rRatio, sizeVar))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleRandomise = useCallback(() => {
    stopAutoplay()
    randomiseStep()
  }, [stopAutoplay, randomiseStep])

  const handlePlayPause = useCallback(() => {
    if (isPlayingRef.current) {
      stopAutoplay()
    } else {
      isPlayingRef.current = true
      setIsPlaying(true)
      intervalRef.current = setInterval(randomiseStep, 750)
    }
  }, [stopAutoplay, randomiseStep])

  const handleGridChange = useCallback((g: 3 | 4 | 5 | 6) => {
    stopAutoplay()
    setGridSize(g)
    setResult(generate(latestRef.current.seed, g, latestRef.current.rRatio, latestRef.current.sizeVar))
  }, [stopAutoplay])

  const handleRRatioChange = useCallback((rr: number) => {
    stopAutoplay()
    setRRatio(rr)
    setResult(generate(latestRef.current.seed, latestRef.current.gridSize, rr, latestRef.current.sizeVar))
  }, [stopAutoplay])

  const handleSizeVarChange = useCallback((sv: number) => {
    stopAutoplay()
    const svInt = Math.round(sv)
    setSizeVar(svInt)
    setResult(generate(latestRef.current.seed, latestRef.current.gridSize, latestRef.current.rRatio, svInt))
  }, [stopAutoplay])

  const handleScaffoldToggle = useCallback(() => {
    stopAutoplay()
    setScaffold(s => !s)
  }, [stopAutoplay])

  const handleRecall = useCallback((entry: HistoryEntry) => {
    stopAutoplay()
    setSeed(entry.seed)
    setGridSize(entry.gridSize)
    setRRatio(entry.rRatio)
    setSizeVar(entry.sizeVariation)
    setResult(generate(entry.seed, entry.gridSize, entry.rRatio, entry.sizeVariation))
  }, [stopAutoplay])

  const handleTogglePin = useCallback((pinSeed: number) => {
    setHistory(prev => prev.map(e => e.seed === pinSeed ? { ...e, pinned: !e.pinned } : e))
  }, [])

  // Spacebar → toggle play/pause
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.code === 'Space') { e.preventDefault(); handlePlayPause() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handlePlayPause])

  useEffect(() => () => stopAutoplay(), [stopAutoplay])

  const PANEL = 300

  return (
    <div style={{
      display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden',
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    }}>

      {/* ── Left Panel ── */}
      <div style={{
        width: PANEL, minWidth: PANEL, height: '100%',
        backgroundColor: '#EEEEEE', display: 'flex',
        flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ padding: '22px 22px 18px' }}>
          <img src="/wordmark.svg" alt="SOMANA" style={{ width: '80%', display: 'block' }} />
        </div>

        <div style={{ flex: 1, padding: '0 22px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <LabeledSlider
            label="Grid Size"
            value={gridSize}
            display={`${gridSize}×${gridSize}`}
            min={3} max={6} step={1}
            onChange={v => handleGridChange(v as 3 | 4 | 5 | 6)}
          />
          <LabeledSlider
            label="Circle Size"
            value={rRatio}
            display={rRatio.toFixed(2)}
            min={0.25} max={0.65} step={0.01}
            onChange={handleRRatioChange}
          />
          <LabeledSlider
            label="Size Variation"
            value={sizeVar}
            display={String(sizeVar)}
            min={1} max={5} step={1}
            onChange={handleSizeVarChange}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Label>Show Grid Scaffold</Label>
            <Toggle on={showScaffold} onToggle={handleScaffoldToggle} />
          </div>
        </div>

        <div style={{ padding: '16px 22px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={() => result && exportSVG(result)}
            disabled={!result}
            style={{
              padding: '11px 0', fontSize: 10, fontWeight: 700,
              letterSpacing: '0.12em', textTransform: 'uppercase',
              color: 'white', backgroundColor: ACCENT,
              border: 'none', cursor: result ? 'pointer' : 'default',
              opacity: result ? 1 : 0.4,
            }}
          >
            Export SVG
          </button>
          <button
            onClick={() => result && exportPNG(result)}
            disabled={!result}
            style={{
              padding: '11px 0', fontSize: 10, fontWeight: 700,
              letterSpacing: '0.12em', textTransform: 'uppercase',
              color: ACCENT, backgroundColor: 'white',
              border: `1px solid ${ACCENT}`, cursor: result ? 'pointer' : 'default',
              opacity: result ? 1 : 0.4,
            }}
          >
            Export PNG
          </button>
        </div>
      </div>

      {/* ── Canvas Area ── */}
      <div style={{
        flex: 1, height: '100%', backgroundColor: 'white',
        display: 'flex', flexDirection: 'column', minWidth: 0,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          gap: 8, padding: '18px 24px 12px',
        }}>
          <span style={{
            fontSize: 10, color: '#aaa', letterSpacing: '0.04em',
            fontVariantNumeric: 'tabular-nums', marginRight: 4,
          }}>
            seed {seed}
          </span>
          <button
            onClick={handlePlayPause}
            style={{
              padding: '9px 18px', fontSize: 10, fontWeight: 700,
              letterSpacing: '0.12em', textTransform: 'uppercase',
              color: 'white', backgroundColor: ACCENT, border: 'none', cursor: 'pointer',
            }}
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <button
            onClick={handleRandomise}
            style={{
              padding: '9px 18px', fontSize: 10, fontWeight: 700,
              letterSpacing: '0.12em', textTransform: 'uppercase',
              color: 'white', backgroundColor: ACCENT, border: 'none', cursor: 'pointer',
            }}
          >
            Randomiser
          </button>
        </div>

        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24, minHeight: 0,
        }}>
          <div style={{
            height: 'min(calc(100vh - 200px), calc(100vw - 380px))',
            maxHeight: '100%', maxWidth: '100%', aspectRatio: '1',
          }}>
            <MarkCanvas result={result} showScaffold={showScaffold} canvasRef={canvasRef} />
          </div>
        </div>

        {/* Seed history — 20 slots, right-click to pin */}
        <div style={{ padding: '0 24px 20px' }}>
          <div style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: '#bbb', marginBottom: 8,
          }}>
            Seed History
          </div>
          <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 2 }}>
            {Array.from({ length: HISTORY_LIMIT }).map((_, idx) => {
              const entry = history[idx]
              return entry ? (
                <button
                  key={entry.seed}
                  onClick={() => handleRecall(entry)}
                  onContextMenu={e => { e.preventDefault(); handleTogglePin(entry.seed) }}
                  title={`Seed ${entry.seed} · ${entry.gridSize}×${entry.gridSize}${entry.pinned ? ' · Pinned' : ''}`}
                  style={{
                    width: 46, height: 46, minWidth: 46, padding: 0,
                    border: entry.seed === seed
                      ? `2px solid ${ACCENT}`
                      : entry.pinned
                        ? `2px solid ${ACCENT}99`
                        : '1px solid #e4e4e4',
                    cursor: 'pointer', overflow: 'visible',
                    backgroundColor: 'white', position: 'relative', flexShrink: 0,
                  }}
                >
                  <img src={entry.thumbnail} alt="" style={{ width: '100%', height: '100%', display: 'block' }} />
                  {entry.pinned && (
                    <span style={{
                      position: 'absolute', bottom: -2, right: -2,
                      width: 7, height: 7, borderRadius: '50%',
                      backgroundColor: ACCENT, display: 'block',
                      border: '1.5px solid white', pointerEvents: 'none',
                    }} />
                  )}
                </button>
              ) : (
                <div key={idx} style={{
                  width: 46, height: 46, minWidth: 46,
                  backgroundColor: '#f3f3f3', border: '1px solid #e8e8e8', flexShrink: 0,
                }} />
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
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
      textTransform: 'uppercase', color: '#888',
    }}>
      {children}
    </span>
  )
}
