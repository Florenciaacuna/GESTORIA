import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message === 'Invalid login credentials'
      ? 'Email o contraseña incorrectos'
      : error.message)
    setLoading(false)
  }

  const s = {
    page: {
      minHeight: '100vh', background: '#EEF2F7',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    card: {
      background: '#fff', borderRadius: 16, padding: 40,
      width: 380, boxShadow: '0 4px 24px rgba(0,0,0,.08)',
    },
    logo: {
      width: 48, height: 48, background: '#0D1F30', borderRadius: 10,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 900, fontSize: 18, color: '#fff', marginBottom: 20,
    },
    title: { fontSize: '1.2rem', fontWeight: 700, marginBottom: 4, color: '#0D1F30' },
    sub: { fontSize: '.82rem', color: '#637B8D', marginBottom: 28 },
    label: { fontSize: '.78rem', fontWeight: 600, color: '#0D1F30', display: 'block', marginBottom: 6 },
    input: {
      width: '100%', border: '1.5px solid #D1DCE5', borderRadius: 7,
      padding: '10px 12px', fontSize: '.875rem', outline: 'none',
      marginBottom: 16, color: '#0D1F30',
      transition: 'border-color .15s',
    },
    btn: {
      width: '100%', background: '#0D1F30', color: '#fff',
      border: 'none', borderRadius: 7, padding: '11px 0',
      fontSize: '.875rem', fontWeight: 600, cursor: 'pointer',
      marginTop: 4,
    },
    error: {
      background: '#FDECEA', color: '#8b1413', border: '1px solid #f5a4a0',
      borderRadius: 6, padding: '10px 12px', fontSize: '.78rem', marginBottom: 16,
    },
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logo}>GR</div>
        <div style={s.title}>Conciliación TH</div>
        <div style={s.sub}>Grupo Randazzo · Área Finanzas</div>

        <form onSubmit={handleLogin}>
          {error && <div style={s.error}>{error}</div>}

          <label style={s.label}>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={s.input}
            placeholder="nombre@gruporandazzo.com.ar"
            required
          />

          <label style={s.label}>Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={s.input}
            placeholder="••••••••"
            required
          />

          <button type="submit" style={s.btn} disabled={loading}>
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}
