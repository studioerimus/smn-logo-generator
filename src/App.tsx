import { useCallback, useEffect, useRef, useState } from 'react'
import { Canvas, renderThumbnail } from './Canvas'
import type { CanvasHandle } from './Canvas'
import { useGenerator } from './useGenerator'
import { exportSVG, exportPNG } from './export'
import { generate } from './algorithm'

const ACCENT = '#143333'

function Slider({
  label,
  value,
  min,
  max,
  step = 0.01,
  format,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  format?: (v: number) => string
  onChange: (v: number) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-baseline">
        <span className="text-[10px] font-bold tracking-widest uppercase text-stone-500">{label}</span>
        <span className="text-[10px] font-mono text-stone-400">{format ? format(value) : value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1 cursor-pointer"
        style={{ accentColor: ACCENT }}
      />
    </div>
  )
}

function LockToggle({
  label,
  locked,
  onToggle,
}: {
  label: string
  locked: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center justify-between w-full px-3 py-2 text-[10px] font-bold tracking-widest uppercase transition-colors cursor-pointer border"
      style={locked
        ? { backgroundColor: ACCENT, color: 'white', borderColor: ACCENT }
        : { backgroundColor: 'white', color: '#a8a29e', borderColor: '#e7e5e4' }
      }
    >
      <span>{label}</span>
      <span className="ml-2">{locked ? '⚙' : '○'}</span>
    </button>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[9px] font-bold tracking-widest uppercase text-stone-400 pt-4 pb-1 border-t border-stone-200 mt-1">
      {children}
    </div>
  )
}

export default function App() {
  const {
    params,
    locks,
    result,
    history,
    randomise,
    updateParam,
    toggleLock,
    recallSeed,
  } = useGenerator()

  const [showScaffold, setShowScaffold] = useState(true)
  const canvasRef = useRef<CanvasHandle>(null)

  const makeThumbnail = useCallback(
    (seed: number) => {
      const r = generate({ ...params, seed })
      return renderThumbnail(r, 80)
    },
    [params]
  )

  const handleRandomise = useCallback(() => {
    randomise(makeThumbnail)
  }, [randomise, makeThumbnail])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.code === 'Space') {
        e.preventDefault()
        handleRandomise()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleRandomise])

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', backgroundColor: '#EEEEEE' }}>
      {/* Left Panel */}
      <div style={{ display: 'flex', flexDirection: 'column', width: 300, minWidth: 300, height: '100%', backgroundColor: '#EEEEEE', overflowY: 'auto' }}>
        {/* Wordmark */}
        <div style={{ padding: '20px 20px 12px' }}>
          <img src="/wordmark.svg" alt="SOMANA" style={{ width: '80%' }} />
        </div>

        {/* Controls */}
        <div style={{ flex: 1, padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SectionLabel>Generation</SectionLabel>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold tracking-widest uppercase text-stone-500">Seed</span>
            <input
              type="number"
              value={params.seed}
              onChange={e => updateParam('seed', Number(e.target.value))}
              style={{
                width: '100%',
                border: '1px solid #d6d3d1',
                background: 'white',
                padding: '4px 8px',
                fontSize: 11,
                fontFamily: 'monospace',
                outline: 'none',
              }}
            />
          </div>
          <Slider
            label="Node Count"
            value={params.nodeCount}
            min={4}
            max={9}
            step={1}
            format={v => String(Math.round(v))}
            onChange={v => updateParam('nodeCount', Math.round(v))}
          />

          <SectionLabel>Grid</SectionLabel>
          <Slider
            label="Grid Size"
            value={params.gridSize}
            min={4}
            max={6}
            step={1}
            format={v => `${Math.round(v)}×${Math.round(v)}`}
            onChange={v => updateParam('gridSize', Math.round(v))}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="text-[10px] font-bold tracking-widest uppercase text-stone-500">Show Scaffold</span>
            <button
              onClick={() => setShowScaffold(s => !s)}
              style={{
                width: 40,
                height: 20,
                borderRadius: 10,
                backgroundColor: showScaffold ? ACCENT : '#d6d3d1',
                border: 'none',
                cursor: 'pointer',
                position: 'relative',
                transition: 'background 0.15s',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: 2,
                  left: showScaffold ? 22 : 2,
                  width: 16,
                  height: 16,
                  backgroundColor: 'white',
                  borderRadius: '50%',
                  transition: 'left 0.15s',
                }}
              />
            </button>
          </div>

          <SectionLabel>Geometry</SectionLabel>
          <Slider
            label="Contrast"
            value={params.contrast}
            min={0}
            max={1}
            step={0.01}
            format={v => v.toFixed(2)}
            onChange={v => updateParam('contrast', v)}
          />
          <Slider
            label="Size Variation"
            value={params.sizeVariation}
            min={0}
            max={1}
            step={0.01}
            format={v => v.toFixed(2)}
            onChange={v => updateParam('sizeVariation', v)}
          />

          <SectionLabel>Locks</SectionLabel>
          <LockToggle label="Grid Size" locked={locks.gridSize} onToggle={() => toggleLock('gridSize')} />
          <LockToggle label="Node Count" locked={locks.nodeCount} onToggle={() => toggleLock('nodeCount')} />
          <LockToggle label="Contrast" locked={locks.contrast} onToggle={() => toggleLock('contrast')} />
          <LockToggle label="Size Variation" locked={locks.sizeVariation} onToggle={() => toggleLock('sizeVariation')} />
        </div>

        {/* Export Buttons */}
        <div style={{ padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={() => exportSVG(result, params.seed)}
            style={{
              width: '100%',
              padding: '10px 0',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'white',
              backgroundColor: ACCENT,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Export SVG
          </button>
          <button
            onClick={() => exportPNG(params)}
            style={{
              width: '100%',
              padding: '10px 0',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: ACCENT,
              backgroundColor: 'white',
              border: `1px solid ${ACCENT}`,
              cursor: 'pointer',
            }}
          >
            Export PNG
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'white', minWidth: 0, height: '100%' }}>
        {/* Top bar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '20px 24px 12px' }}>
          <button
            onClick={handleRandomise}
            style={{
              padding: '10px 20px',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.1em',
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

        {/* Canvas centered */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, minHeight: 0 }}>
          <div
            style={{
              aspectRatio: '1',
              height: 'min(calc(100vh - 200px), calc(100vw - 380px))',
              maxHeight: '100%',
              maxWidth: '100%',
              backgroundColor: 'white',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
          >
            <Canvas ref={canvasRef} result={result} showScaffold={showScaffold} size={512} />
          </div>
        </div>

        {/* Seed History Strip */}
        <div style={{ padding: '0 24px 20px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#a8a29e', marginBottom: 8 }}>
            Seed History
          </div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {history.length === 0
              ? Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    style={{ width: 56, height: 56, minWidth: 56, backgroundColor: '#f5f5f4', border: '1px solid #e7e5e4' }}
                  />
                ))
              : history.map(entry => (
                  <button
                    key={entry.seed}
                    onClick={() => recallSeed(entry)}
                    title={`Seed ${entry.seed}`}
                    style={{
                      width: 56,
                      height: 56,
                      minWidth: 56,
                      border: entry.seed === params.seed ? `2px solid ${ACCENT}` : '1px solid #e7e5e4',
                      cursor: 'pointer',
                      padding: 0,
                      overflow: 'hidden',
                      backgroundColor: 'white',
                    }}
                  >
                    <img src={entry.thumbnail} alt={`Seed ${entry.seed}`} style={{ width: '100%', height: '100%', display: 'block' }} />
                  </button>
                ))}
          </div>
        </div>
      </div>
    </div>
  )
}
