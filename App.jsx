import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useNavigate, Link, useLocation } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Historial from './pages/Historial'
import Conciliacion from './pages/Conciliacion'

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = cargando, null = sin sesión

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) return <LoadingScreen />

  return (
    <>
      {session && <TopBar session={session} />}
      <Routes>
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />
        <Route path="/" element={session ? <Historial /> : <Navigate to="/login" />} />
        <Route path="/nueva" element={session ? <Conciliacion /> : <Navigate to="/login" />} />
        <Route path="/conciliacion/:id" element={session ? <Conciliacion /> : <Navigate to="/login" />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </>
  )
}

function TopBar({ session }) {
  const navigate = useNavigate()
  const location = useLocation()

  async function logout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const s = {
    bar: {
      background: '#0D1F30', color: '#fff',
      height: 52, display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', padding: '0 24px',
      position: 'sticky', top: 0, zIndex: 100,
      boxShadow: '0 2px 8px rgba(0,0,0,.3)',
    },
    brand: { display: 'flex', alignItems: 'center', gap: 12 },
    logo: {
      width: 28, height: 28, background: '#1DB863', borderRadius: 6,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 900, fontSize: 12,
    },
    sub: { fontSize: '.65rem', opacity: .5, letterSpacing: '.07em', textTransform: 'uppercase' },
    title: { fontSize: '.9rem', fontWeight: 700 },
    nav: { display: 'flex', alignItems: 'center', gap: 8 },
    link: {
      color: 'rgba(255,255,255,.75)', fontSize: '.8rem', fontWeight: 500,
      padding: '5px 12px', borderRadius: 6, textDecoration: 'none',
      background: 'transparent', border: 'none',
    },
    linkActive: {
      color: '#fff', background: 'rgba(255,255,255,.12)',
    },
    btn: {
      color: '#0D1F30', background: '#1DB863', fontSize: '.78rem',
      fontWeight: 600, padding: '5px 14px', borderRadius: 6, border: 'none',
    },
  }

  return (
    <div style={s.bar}>
      <div style={s.brand}>
        <div style={s.logo}>GR</div>
        <div>
          <div style={s.sub}>Grupo Randazzo · Finanzas</div>
          <div style={s.title}>Conciliación Tarjeta Habitualista</div>
        </div>
      </div>
      <div style={s.nav}>
        <Link
          to="/"
          style={{ ...s.link, ...(location.pathname === '/' ? s.linkActive : {}) }}
        >
          Historial
        </Link>
        <Link
          to="/nueva"
          style={{ ...s.link, ...(location.pathname === '/nueva' ? s.linkActive : {}) }}
        >
          + Nueva
        </Link>
        <span style={{ ...s.link, opacity: .5 }}>{session.user.email}</span>
        <button style={s.btn} onClick={logout}>Salir</button>
      </div>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#EEF2F7',
    }}>
      <div style={{ textAlign: 'center', color: '#637B8D' }}>
        <div style={{ fontSize: '2rem', marginBottom: 12 }}>📊</div>
        <div style={{ fontSize: '.85rem' }}>Cargando…</div>
      </div>
    </div>
  )
}
