import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function LoginScreen({ onLogin, showToast }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      setError('Incorrect email or password.')
    } else {
      onLogin(data.session)
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-logo">Major Picks</div>
      <div className="login-tagline">PGA · Masters · Players · US Open · The Open</div>

      <form className="login-card" onSubmit={handleLogin}>
        <div style={{ marginBottom: '1rem' }}>
          <label className="field-label">Email</label>
          <input
            className="field-input"
            type="email"
            placeholder="you@email.com"
            autoComplete="username"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label className="field-label">Password</label>
          <input
            className="field-input"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
        </div>
        <button className="btn-primary" type="submit" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
        {error && <div className="login-error">{error}</div>}
      </form>

      <div style={{ marginTop: '1.5rem', fontSize: '11px', color: 'rgba(255,255,255,0.18)', textAlign: 'center', lineHeight: 1.7 }}>
        Access by invitation only.<br />All three members must approve new members.
      </div>
    </div>
  )
}
