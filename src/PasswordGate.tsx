import { useState, useEffect, useRef, type ReactNode } from 'react'

const PANEL_BG = '#F4F3F0'
const INK      = '#1A1A1A'
const DANGER   = '#C62828'
const SESSION_KEY = 'somana-unlocked'

const LBL: React.CSSProperties = {
  fontSize: 11, fontWeight: 500, letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

export default function PasswordGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(() =>
    sessionStorage.getItem(SESSION_KEY) === '1'
  )
  const [value,   setValue]   = useState('')
  const [error,   setError]   = useState<'empty' | 'incorrect' | null>(null)
  const [shaking, setShaking] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!unlocked) inputRef.current?.focus()
  }, [unlocked])

  if (unlocked) return <>{children}</>

  const shake = () => {
    setShaking(true)
    setTimeout(() => setShaking(false), 420)
  }

  const submit = () => {
    const trimmed = value.trim()
    if (!trimmed) {
      setError('empty')
      shake()
      return
    }
    if (trimmed === import.meta.env.VITE_ACCESS_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, '1')
      setUnlocked(true)
    } else {
      setError('incorrect')
      setValue('')
      shake()
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      backgroundColor: PANEL_BG,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 232 }}>
        <input
          ref={inputRef}
          type="password"
          value={value}
          placeholder="Enter password"
          onChange={e => { setValue(e.target.value); setError(null) }}
          onKeyDown={e => e.key === 'Enter' && submit()}
          className={`gate-input${shaking ? ' gate-shake' : ''}`}
          style={{
            height: 36, padding: '0 12px',
            ...LBL, fontWeight: 400, letterSpacing: '0.04em',
            color: INK, backgroundColor: 'transparent',
            border: '1px solid rgba(0,0,0,0.14)',
            borderRadius: 2, outline: 'none',
          }}
        />
        <button
          onClick={submit}
          className="btn-primary gate-submit"
          style={{
            height: 36, padding: '0 16px',
            ...LBL, color: 'white', backgroundColor: INK,
            border: 'none', borderRadius: 2, cursor: 'pointer',
          }}
        >
          Enter
        </button>
        {/* fixed-height slot so layout never shifts */}
        <div style={{ height: 16, display: 'flex', alignItems: 'center' }}>
          {error === 'incorrect' && (
            <span style={{ ...LBL, color: DANGER }}>Incorrect password</span>
          )}
          {error === 'empty' && (
            <span style={{ ...LBL, color: DANGER }}>Enter a password</span>
          )}
        </div>
      </div>
    </div>
  )
}
