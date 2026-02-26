import { useState } from 'react'
import { supabase } from './supabase'

export default function AuthPage() {
  const [mode, setMode] = useState('login') // login | signup | reset
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)
    setMessage(null)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    } else if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setMessage('Check your email for a confirmation link!')
    } else if (mode === 'reset') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      })
      if (error) setError(error.message)
      else setMessage('Password reset email sent!')
    }
    setLoading(false)
  }

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin:0; padding:0; }
    body { background:#0a0e1a; }
    input { outline:none; }
    button { cursor:pointer; border:none; }
  `

  return (
    <div style={{ fontFamily: "'Syne', sans-serif", minHeight: '100vh', background: '#0a0e1a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <style>{css}</style>

      {/* Background glow */}
      <div style={{ position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)', width: 500, height: 500, background: 'radial-gradient(circle, #3b82f620 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 400, position: 'relative' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ width: 52, height: 52, background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', borderRadius: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, marginBottom: 16 }}>🔨</div>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.8px', color: '#fff' }}>ContractorCRM</div>
          <div style={{ fontSize: 13, color: '#4b5563', marginTop: 4, fontFamily: "'DM Mono', monospace" }}>Manage your home contractors</div>
        </div>

        {/* Card */}
        <div style={{ background: '#0d1221', border: '1px solid #1e2a45', borderRadius: 16, padding: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 24, color: '#fff' }}>
            {mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Reset Password'}
          </h2>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 6, display: 'block', fontFamily: "'DM Mono', monospace" }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="you@example.com"
              style={{ width: '100%', background: '#111827', border: '1px solid #1e2a45', borderRadius: 8, padding: '10px 14px', color: '#e2e8f0', fontSize: 14, fontFamily: "'Syne', sans-serif' " }}
            />
          </div>

          {mode !== 'reset' && (
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 6, display: 'block', fontFamily: "'DM Mono', monospace" }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder="••••••••"
                style={{ width: '100%', background: '#111827', border: '1px solid #1e2a45', borderRadius: 8, padding: '10px 14px', color: '#e2e8f0', fontSize: 14, fontFamily: "'Syne', sans-serif'" }}
              />
            </div>
          )}

          {error && (
            <div style={{ background: '#ef444418', border: '1px solid #ef444440', borderRadius: 8, padding: '10px 14px', color: '#ef4444', fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}
          {message && (
            <div style={{ background: '#10b98118', border: '1px solid #10b98140', borderRadius: 8, padding: '10px 14px', color: '#10b981', fontSize: 13, marginBottom: 16 }}>
              {message}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{ width: '100%', padding: '11px', borderRadius: 9, background: loading ? '#1e2a45' : 'linear-gradient(135deg,#3b82f6,#6366f1)', color: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', transition: 'opacity .15s' }}
          >
            {loading ? 'Loading…' : mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Reset Email'}
          </button>

          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
            {mode === 'login' && (
              <>
                <button onClick={() => { setMode('signup'); setError(null); setMessage(null) }} style={{ background: 'none', color: '#64748b', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Don't have an account? <span style={{ color: '#3b82f6', fontWeight: 700 }}>Sign up</span>
                </button>
                <button onClick={() => { setMode('reset'); setError(null); setMessage(null) }} style={{ background: 'none', color: '#4b5563', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Forgot password?
                </button>
              </>
            )}
            {mode !== 'login' && (
              <button onClick={() => { setMode('login'); setError(null); setMessage(null) }} style={{ background: 'none', color: '#64748b', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                ← Back to sign in
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
