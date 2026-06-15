import { useCallback, useEffect, useRef, useState } from 'react'
import type { GenerationResult } from './algorithm'
import { generate } from './algorithm'
import { drawMark, renderThumbnail } from './draw'
import { exportSVG, exportPNG, exportAllAsZip } from './export'

// ── Design tokens ──────────────────────────────────────────────────────────────
const PANEL_BG = '#F4F3F0'   // warm off-white panel
const INK      = '#1A1A1A'   // near-black for all text and fills
const ACCENT   = '#143333'   // deep teal — active states only
const MUTED    = '#888888'   // secondary text
const HAIRLINE = 'rgba(0,0,0,0.08)'
const PANEL_W  = 312

// ── App constants ──────────────────────────────────────────────────────────────
const HISTORY_LIMIT = 20
const FAVS_PER_PAGE = 18
const FAVS_KEY      = 'somana-favourites'

// ── Shared type tokens (inline — no abstraction overhead) ─────────────────────
const LBL: React.CSSProperties = {
  fontSize: 11, fontWeight: 500, letterSpacing: '0.08em',
  textTransform: 'uppercase', color: INK,
}
const VAL: React.CSSProperties = {
  fontSize: 11, fontWeight: 400,
  fontVariantNumeric: 'tabular-nums', color: INK,
}
const DIM: React.CSSProperties = {
  fontSize: 10, fontWeight: 400,
  fontVariantNumeric: 'tabular-nums', color: MUTED,
}

// ── Data types ────────────────────────────────────────────────────────────────
interface HistoryEntry {
  seed: number; gridSize: 4 | 5; rRatio: number; sizeVariation: number
  thumbnail: string; pinned: boolean
}

interface FavouriteEntry {
  seed: number; gridSize: 4 | 5; rRatio: number; sizeVariation: number
  thumbnail: string; savedAt: number
}

function randomSeed() { return Math.floor(Math.random() * 1_000_000) }

function addToHistory(entry: HistoryEntry, prev: HistoryEntry[]): HistoryEntry[] {
  const filtered = prev.filter(e => e.seed !== entry.seed)
  const combined = [entry, ...filtered]
  if (combined.length <= HISTORY_LIMIT) return combined
  for (let i = combined.length - 1; i >= 0; i--) {
    if (!combined[i].pinned) return [...combined.slice(0, i), ...combined.slice(i + 1)]
  }
  return combined.slice(0, HISTORY_LIMIT)
}

// ── Segmented pill control ────────────────────────────────────────────────────
function Seg({ options, value, onChange }: {
  options: { value: unknown; label: string }[]
  value:   unknown
  onChange: (v: unknown) => void
}) {
  return (
    <div style={{
      display: 'flex', gap: 2, padding: 2, borderRadius: 3,
      backgroundColor: 'rgba(0,0,0,0.06)',
    }}>
      {options.map(opt => {
        const active = value === opt.value
        return (
          <button
            key={String(opt.value)}
            onClick={() => onChange(opt.value)}
            className="seg-btn"
            style={{
              flex: 1, padding: '7px 12px', border: 'none', cursor: 'pointer',
              borderRadius: 2,
              // LBL first, then explicit overrides so they win
              ...LBL,
              backgroundColor: active ? ACCENT      : 'transparent',
              color:           active ? 'white'     : MUTED,
              fontWeight:      active ? 600         : 500,
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

// ── Heart SVG icon ────────────────────────────────────────────────────────────
function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path
        d="M8 13.5C8 13.5 1.5 9.2 1.5 5.4C1.5 3.1 3.1 1.5 5 1.5C6.3 1.5 7.4 2.2 8 3.4C8.6 2.2 9.7 1.5 11 1.5C12.9 1.5 14.5 3.1 14.5 5.4C14.5 9.2 8 13.5 8 13.5Z"
        fill={filled ? ACCENT : 'none'}
        stroke={filled ? ACCENT : INK}
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ── FavCard ───────────────────────────────────────────────────────────────────
function FavCard({ entry, onRecall, onRemove }: {
  entry: FavouriteEntry; onRecall: () => void; onRemove: () => void
}) {
  return (
    <div className="fav-card" onClick={onRecall} style={{
      position: 'relative', cursor: 'pointer',
      backgroundColor: PANEL_BG,
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '6px 6px 4px', ...DIM, letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>
        {entry.seed}
      </div>
      <div style={{ aspectRatio: '1', overflow: 'hidden', backgroundColor: 'white' }}>
        <img src={entry.thumbnail} alt="" style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain' }} />
      </div>
      <button
        onClick={e => { e.stopPropagation(); onRemove() }}
        title="Remove"
        className="fav-remove"
        style={{
          position: 'absolute', top: 4, right: 4,
          width: 16, height: 16, borderRadius: '50%',
          backgroundColor: INK, color: 'white',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  )
}

// ── MarkCanvas ────────────────────────────────────────────────────────────────
function MarkCanvas({ result, showScaffold, canvasRef }: {
  result:       GenerationResult | null
  showScaffold: boolean
  canvasRef:    React.RefObject<HTMLCanvasElement | null>
}) {
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !result) return
    const dpr  = window.devicePixelRatio || 1
    const size = canvas.offsetWidth || 512
    canvas.width = size * dpr; canvas.height = size * dpr
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
      canvas.width = size * dpr; canvas.height = size * dpr
      const ctx = canvas.getContext('2d')!
      ctx.scale(dpr, dpr)
      drawMark(ctx, result, showScaffold, size)
    })
    if (canvas.parentElement) obs.observe(canvas.parentElement)
    return () => obs.disconnect()
  }, [result, showScaffold, canvasRef])

  return (
    <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
  )
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [seed, setSeed]             = useState<number>(() => randomSeed())
  const [gridSize, setGridSize]     = useState<4 | 5>(4)
  const [rRatio, setRRatio]         = useState(0.75)
  const [sizeVar, setSizeVar]       = useState(0)
  const [showScaffold, setScaffold] = useState(false)
  const [result, setResult]         = useState<GenerationResult | null>(null)
  const [history, setHistory]       = useState<HistoryEntry[]>([])
  const [isPlaying, setIsPlaying]   = useState(false)

  const [favourites,      setFavourites]      = useState<FavouriteEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem(FAVS_KEY) || '[]') } catch { return [] }
  })
  const [activeView,      setActiveView]      = useState<'generator' | 'favourites'>('generator')
  const [exportFormat,    setExportFormat]    = useState<'svg' | 'png'>('svg')
  const [favExportFormat, setFavExportFormat] = useState<'svg' | 'png'>('svg')
  const [favPage,         setFavPage]         = useState(0)

  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const isPlayingRef = useRef(false)
  const latestRef    = useRef({ seed, gridSize, rRatio, sizeVar, result })
  useEffect(() => { latestRef.current = { seed, gridSize, rRatio, sizeVar, result } })

  useEffect(() => {
    localStorage.setItem(FAVS_KEY, JSON.stringify(favourites))
  }, [favourites])

  const stopAutoplay = useCallback(() => {
    isPlayingRef.current = false
    if (intervalRef.current !== null) { clearInterval(intervalRef.current); intervalRef.current = null }
    setIsPlaying(false)
  }, [])

  const randomiseStep = useCallback(() => {
    const { seed: s, gridSize: g, rRatio: rr, sizeVar: sv, result: r } = latestRef.current
    if (r) {
      const thumb = renderThumbnail(r)
      setHistory(prev => addToHistory(
        { seed: s, gridSize: g, rRatio: rr, sizeVariation: sv, thumbnail: thumb, pinned: false }, prev
      ))
    }
    const newSeed = randomSeed()
    setSeed(newSeed)
    setResult(generate(newSeed, g, 0.1 + rr * 0.4, sv))
  }, [])

  useEffect(() => {
    setResult(generate(seed, gridSize, 0.1 + rRatio * 0.4, sizeVar))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleRandomise    = useCallback(() => { stopAutoplay(); randomiseStep() }, [stopAutoplay, randomiseStep])

  const handlePlayPause    = useCallback(() => {
    if (isPlayingRef.current) { stopAutoplay() }
    else { isPlayingRef.current = true; setIsPlaying(true); intervalRef.current = setInterval(randomiseStep, 750) }
  }, [stopAutoplay, randomiseStep])

  const handleGridChange   = useCallback((g: 4 | 5) => {
    stopAutoplay(); setGridSize(g)
    setResult(generate(latestRef.current.seed, g, 0.1 + latestRef.current.rRatio * 0.4, latestRef.current.sizeVar))
  }, [stopAutoplay])

  const handleRRatioChange = useCallback((rr: number) => {
    stopAutoplay(); setRRatio(rr)
    setResult(generate(latestRef.current.seed, latestRef.current.gridSize, 0.1 + rr * 0.4, latestRef.current.sizeVar))
  }, [stopAutoplay])

  const handleSizeVarChange = useCallback((sv: number) => {
    stopAutoplay(); setSizeVar(sv)
    setResult(generate(latestRef.current.seed, latestRef.current.gridSize, 0.1 + latestRef.current.rRatio * 0.4, sv))
  }, [stopAutoplay])

  const handleScaffoldSet  = useCallback((v: boolean) => { stopAutoplay(); setScaffold(v) }, [stopAutoplay])

  const handleRecall       = useCallback((entry: HistoryEntry) => {
    stopAutoplay()
    setSeed(entry.seed); setGridSize(entry.gridSize); setRRatio(entry.rRatio); setSizeVar(entry.sizeVariation)
    setResult(generate(entry.seed, entry.gridSize, 0.1 + entry.rRatio * 0.4, entry.sizeVariation))
  }, [stopAutoplay])

  const handleTogglePin    = useCallback((pinSeed: number) => {
    setHistory(prev => prev.map(e => e.seed === pinSeed ? { ...e, pinned: !e.pinned } : e))
  }, [])

  // ── Favourites ──────────────────────────────────────────────────────────────
  const isLiked = favourites.some(f => f.seed === seed)

  const handleToggleFavourite = useCallback(() => {
    const { result: r, seed: s, gridSize: g, rRatio: rr, sizeVar: sv } = latestRef.current
    if (!r) return
    setFavourites(prev => {
      if (prev.some(f => f.seed === s)) return prev.filter(f => f.seed !== s)
      const thumb = renderThumbnail(r, 200)
      return [{ seed: s, gridSize: g, rRatio: rr, sizeVariation: sv, thumbnail: thumb, savedAt: Date.now() }, ...prev]
    })
  }, [])

  const handleRemoveFavourite = useCallback((favSeed: number) => {
    setFavourites(prev => {
      const next = prev.filter(f => f.seed !== favSeed)
      setFavPage(p => Math.min(p, Math.max(0, Math.ceil(next.length / FAVS_PER_PAGE) - 1)))
      return next
    })
  }, [])

  const handleRecallFavourite = useCallback((entry: FavouriteEntry) => {
    stopAutoplay()
    setSeed(entry.seed); setGridSize(entry.gridSize); setRRatio(entry.rRatio); setSizeVar(entry.sizeVariation)
    setResult(generate(entry.seed, entry.gridSize, 0.1 + entry.rRatio * 0.4, entry.sizeVariation))
    setActiveView('generator')
  }, [stopAutoplay])

  const handleExportAll = useCallback(async () => {
    if (favourites.length === 0) return
    await exportAllAsZip(favourites, favExportFormat)
  }, [favourites, favExportFormat])

  const handleExport = useCallback(() => {
    if (!result) return
    if (exportFormat === 'svg') exportSVG(result)
    else exportPNG(result)
  }, [result, exportFormat])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.code === 'Space') { e.preventDefault(); handlePlayPause() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handlePlayPause])

  useEffect(() => () => stopAutoplay(), [stopAutoplay])

  const favPageCount  = Math.max(1, Math.ceil(favourites.length / FAVS_PER_PAGE))
  const favPageItems  = favourites.slice(favPage * FAVS_PER_PAGE, (favPage + 1) * FAVS_PER_PAGE)
  const circleFillPct = (rRatio / 0.98) * 100
  const sizeVarFillPct = sizeVar * 100

  // ── Shared button styles ────────────────────────────────────────────────────
  const primaryBtn: React.CSSProperties = {
    height: 32, padding: '0 16px',
    ...LBL, color: 'white', backgroundColor: INK,
    border: 'none', borderRadius: 2, cursor: 'pointer',
  }
  const secondaryBtn: React.CSSProperties = {
    height: 32, padding: '0 12px',
    ...LBL, color: INK, backgroundColor: 'transparent',
    border: `1px solid ${HAIRLINE}`, borderRadius: 2, cursor: 'pointer',
  }

  return (
    <div style={{
      display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden',
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    }}>

      {/* ── Left Panel ─────────────────────────────────────────────────────── */}
      <div style={{
        width: PANEL_W, minWidth: PANEL_W, height: '100%',
        backgroundColor: PANEL_BG,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        borderRight: `1px solid ${HAIRLINE}`,
      }}>

        {/* Logo */}
        <div style={{ padding: '32px 24px 32px' }}>
          <img
            src="/somana-logo-new.svg" alt="SOMANA"
            style={{ width: '100%', height: 'auto', display: 'block', filter: 'brightness(0)' }}
          />
        </div>

        {/* Controls */}
        <div style={{
          flex: 1, padding: '0 24px',
          display: 'flex', flexDirection: 'column', gap: 32,
          overflowY: 'auto',
        }}>

          {/* Grid Size */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={LBL}>Grid Size</span>
            <Seg
              options={[{ value: 4, label: '4×4' }, { value: 5, label: '5×5' }]}
              value={gridSize}
              onChange={v => handleGridChange(v as 4 | 5)}
            />
          </div>

          {/* Circle Size */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={LBL}>Circle Size</span>
              <span style={VAL}>{(rRatio / 0.98).toFixed(2)}</span>
            </div>
            <div style={{ position: 'relative', height: 12, display: 'flex', alignItems: 'center' }}>
              {/* Sweetspot band: 62–100% of the track range */}
              <div style={{
                position: 'absolute', left: '62%', right: 0, height: 2,
                backgroundColor: 'rgba(20,51,51,0.12)', pointerEvents: 'none',
              }} />
              <input
                type="range" className="slider"
                min={0} max={0.98} step={0.01} value={rRatio}
                onChange={e => handleRRatioChange(parseFloat(e.target.value))}
                style={{ '--v': `${circleFillPct}%`, position: 'relative', zIndex: 1, width: '100%' } as React.CSSProperties}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={DIM}>0</span>
              <span style={DIM}>1</span>
            </div>
          </div>

          {/* Size Variation */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={LBL}>Size Variation</span>
              <span style={VAL}>{sizeVar.toFixed(2)}</span>
            </div>
            <div style={{ height: 12, display: 'flex', alignItems: 'center' }}>
              <input
                type="range" className="slider"
                min={0} max={1} step={0.01} value={sizeVar}
                onChange={e => handleSizeVarChange(parseFloat(e.target.value))}
                style={{ '--v': `${sizeVarFillPct}%`, width: '100%' } as React.CSSProperties}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={DIM}>0</span>
              <span style={DIM}>1</span>
            </div>
          </div>

          {/* Grid (scaffold) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={LBL}>Grid</span>
            <Seg
              options={[{ value: true, label: 'On' }, { value: false, label: 'Off' }]}
              value={showScaffold}
              onChange={v => handleScaffoldSet(v as boolean)}
            />
          </div>

        </div>

        {/* Attribution */}
        <div style={{ padding: '0 24px 12px', flexShrink: 0 }}>
          <span style={{ ...DIM, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Tool by Rejouice</span>
        </div>

        {/* Export */}
        <div style={{
          padding: '16px 24px 24px',
          borderTop: `1px solid ${HAIRLINE}`,
          display: 'flex', gap: 8,
          flexShrink: 0,
        }}>
          <button
            onClick={handleExport}
            disabled={!result}
            className="btn-primary"
            style={{
              ...primaryBtn,
              flex: 1, height: 36,
              cursor: result ? 'pointer' : 'default',
              opacity: result ? 1 : 0.35,
            }}
          >
            Export
          </button>
          <button
            onClick={() => setExportFormat(f => f === 'svg' ? 'png' : 'svg')}
            className="btn-secondary"
            style={{ ...secondaryBtn, height: 36 }}
          >
            {exportFormat.toUpperCase()}
          </button>
        </div>

      </div>

      {/* ── Main Area ──────────────────────────────────────────────────────── */}
      <div style={{
        flex: 1, height: '100%', backgroundColor: 'white',
        display: 'flex', flexDirection: 'column', minWidth: 0,
      }}>

        {/* Top Bar */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center', padding: '0 24px', height: 56,
          borderBottom: `1px solid ${HAIRLINE}`,
          flexShrink: 0,
        }}>
          {/* Left: seed */}
          {activeView === 'generator' ? (
            <span style={{ ...LBL, color: MUTED, fontVariantNumeric: 'tabular-nums' }}>
              Seed&nbsp;&nbsp;{seed}
            </span>
          ) : <div />}

          {/* Center: view toggle */}
          <Seg
            options={[
              { value: 'generator',  label: 'Generator'  },
              { value: 'favourites', label: 'Favourites' },
            ]}
            value={activeView}
            onChange={v => setActiveView(v as 'generator' | 'favourites')}
          />

          {/* Right: controls */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
            {activeView === 'generator' ? (
              <>
                {/* Heart */}
                <button
                  onClick={handleToggleFavourite}
                  className="icon-btn"
                  title={isLiked ? 'Remove from favourites' : 'Save to favourites'}
                  style={{
                    width: 32, height: 32, padding: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'transparent',
                    border: `1px solid ${HAIRLINE}`,
                    borderRadius: 2, cursor: 'pointer', flexShrink: 0,
                  }}
                >
                  <HeartIcon filled={isLiked} />
                </button>
                {/* Play / Pause */}
                <button
                  onClick={handlePlayPause}
                  className="btn-secondary"
                  title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                  style={secondaryBtn}
                >
                  {isPlaying ? 'Pause' : 'Play'}
                </button>
                {/* Randomise */}
                <button
                  onClick={handleRandomise}
                  className="btn-primary"
                  style={primaryBtn}
                >
                  Randomise
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleExportAll}
                  disabled={favourites.length === 0}
                  className="btn-primary"
                  style={{
                    ...primaryBtn,
                    cursor: favourites.length === 0 ? 'default' : 'pointer',
                    opacity: favourites.length === 0 ? 0.35 : 1,
                  }}
                >
                  Export All
                </button>
                <button
                  onClick={() => setFavExportFormat(f => f === 'svg' ? 'png' : 'svg')}
                  className="btn-secondary"
                  style={secondaryBtn}
                >
                  {favExportFormat.toUpperCase()}
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Generator View ── */}
        {activeView === 'generator' && (
          <>
            {/* Canvas */}
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 32, minHeight: 0,
            }}>
              <div style={{
                height: 'min(calc(100vh - 208px), calc(100vw - 360px))',
                maxHeight: '100%', maxWidth: '100%', aspectRatio: '1',
              }}>
                <MarkCanvas result={result} showScaffold={showScaffold} canvasRef={canvasRef} />
              </div>
            </div>

            {/* History strip */}
            <div style={{ padding: '0 24px 24px', flexShrink: 0 }}>
              <div style={{ ...LBL, color: MUTED, marginBottom: 8 }}>History</div>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
                {Array.from({ length: HISTORY_LIMIT }).map((_, idx) => {
                  const entry = history[idx]
                  return entry ? (
                    <button
                      key={entry.seed}
                      onClick={() => handleRecall(entry)}
                      onContextMenu={e => { e.preventDefault(); handleTogglePin(entry.seed) }}
                      title={`${entry.seed} · ${entry.gridSize}×${entry.gridSize}${entry.pinned ? ' · pinned' : ''}`}
                      style={{
                        width: 40, height: 40, minWidth: 40, padding: 0, flexShrink: 0,
                        border: entry.seed === seed
                          ? `1.5px solid ${INK}`
                          : entry.pinned
                            ? `1.5px solid rgba(0,0,0,0.25)`
                            : `1px solid ${HAIRLINE}`,
                        cursor: 'pointer', overflow: 'visible',
                        backgroundColor: 'white', position: 'relative',
                      }}
                    >
                      <img src={entry.thumbnail} alt="" style={{ width: '100%', height: '100%', display: 'block' }} />
                      {entry.pinned && (
                        <span style={{
                          position: 'absolute', bottom: -2, right: -2,
                          width: 6, height: 6, borderRadius: '50%',
                          backgroundColor: ACCENT, display: 'block',
                          border: '1.5px solid white', pointerEvents: 'none',
                        }} />
                      )}
                    </button>
                  ) : (
                    <div key={idx} style={{
                      width: 40, height: 40, minWidth: 40, flexShrink: 0,
                      backgroundColor: 'rgba(0,0,0,0.03)',
                      border: `1px solid ${HAIRLINE}`,
                    }} />
                  )
                })}
              </div>
            </div>
          </>
        )}

        {/* ── Favourites View ── */}
        {activeView === 'favourites' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {favourites.length === 0 ? (
              <div style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                ...LBL, color: MUTED,
              }}>
                No favourites yet — save a mark with ♡
              </div>
            ) : (
              <>
                <div style={{ flex: 1, overflow: 'auto', padding: '24px 24px 16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
                    {favPageItems.map(entry => (
                      <FavCard
                        key={entry.seed}
                        entry={entry}
                        onRecall={() => handleRecallFavourite(entry)}
                        onRemove={() => handleRemoveFavourite(entry.seed)}
                      />
                    ))}
                  </div>
                </div>

                {favPageCount > 1 && (
                  <div style={{
                    padding: '16px 24px 24px', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    ...LBL, color: MUTED,
                  }}>
                    <span>Page</span>
                    {Array.from({ length: favPageCount }, (_, i) => (
                      <button
                        key={i}
                        onClick={() => setFavPage(i)}
                        className="btn-secondary"
                        style={{
                          width: 24, height: 24, padding: 0,
                          ...LBL,
                          color:           favPage === i ? 'white' : MUTED,
                          backgroundColor: favPage === i ? INK    : 'transparent',
                          border: `1px solid ${favPage === i ? INK : HAIRLINE}`,
                          borderRadius: 2, cursor: 'pointer',
                        }}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
