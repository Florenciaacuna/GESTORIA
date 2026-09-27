import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Historial from './pages/Historial'
import Conciliacion from './pages/Conciliacion'

export default function App() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) return <Loader />

  if (!session) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar session={session} />
      <div style={{ flex: 1, marginLeft: 220, background: 'var(--bg)', minHeight: '100vh' }}>
        <Routes>
          <Route path="/"                    element={<Historial />} />
          <Route path="/nueva"               element={<Conciliacion />} />
          <Route path="/conciliacion/:id"    element={<Conciliacion />} />
          <Route path="*"                    element={<Navigate to="/" />} />
        </Routes>
      </div>
    </div>
  )
}

function Sidebar({ session }) {
  const navigate = useNavigate()

  async function logout() {
    await supabase.auth.signOut()
    navigate('/')
  }

  const navItems = [
    { to: '/',      label: 'Historial',         icon: '📋' },
    { to: '/nueva', label: 'Nueva conciliación', icon: '➕' },
  ]

  return (
    <aside style={{
      width: 220,
      background: 'var(--sidebar)',
      borderRight: '1px solid var(--bdr)',
      position: 'fixed',
      top: 0, left: 0, bottom: 0,
      display: 'flex', flexDirection: 'column',
      zIndex: 100,
    }}>
      {/* LOGO */}
      <div style={{
        padding: '24px 20px 20px',
        borderBottom: '1px solid var(--bdr)',
      }}>
        <img
          src="/logo.png"
          alt="Grupo Randazzo"
          style={{ width: '100%', maxWidth: 160, height: 'auto', display: 'block' }}
          onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block' }}
        />
        {/* Fallback si no hay logo todavía */}
        <div style={{ display: 'none', fontSize: '.85rem', fontWeight: 700, color: 'var(--green)', letterSpacing: '.05em' }}>
          GRUPO RANDAZZO
        </div>
        <div style={{ fontSize: '.65rem', color: 'var(--txt2)', marginTop: 6, letterSpacing: '.08em', textTransform: 'uppercase' }}>
          Gestoría · Finanzas
        </div>
      </div>

      {/* NAV */}
      <nav style={{ flex: 1, padding: '16px 0' }}>
        <div style={{ fontSize: '.62rem', color: 'var(--txt3)', letterSpacing: '.1em', textTransform: 'uppercase', padding: '0 20px 8px' }}>
          Principal
        </div>
        {navItems.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 20px',
              fontSize: '.82rem',
              fontWeight: isActive ? 600 : 400,
              color: isActive ? 'var(--green)' : 'var(--txt2)',
              background: isActive ? 'var(--green-dim)' : 'transparent',
              borderLeft: isActive ? '3px solid var(--green)' : '3px solid transparent',
              textDecoration: 'none',
              transition: 'all .15s',
            })}
          >
            <span style={{ fontSize: '1rem' }}>{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      {/* USER */}
      <div style={{ borderTop: '1px solid var(--bdr)', padding: '16px 20px' }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: 'var(--green)', color: '#000',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: '.82rem', marginBottom: 8,
        }}>
          {session.user.email[0].toUpperCase()}
        </div>
        <div style={{ fontSize: '.72rem', color: 'var(--txt2)', marginBottom: 2, wordBreak: 'break-all' }}>
          {session.user.email}
        </div>
        <button
          onClick={logout}
          style={{
            marginTop: 10, width: '100%',
            background: 'transparent', border: '1px solid var(--bdr2)',
            color: 'var(--txt2)', borderRadius: 6,
            padding: '7px 0', fontSize: '.75rem', fontWeight: 500,
            transition: 'all .15s',
          }}
          onMouseEnter={e => { e.target.style.color = 'var(--txt)'; e.target.style.borderColor = '#444' }}
          onMouseLeave={e => { e.target.style.color = 'var(--txt2)'; e.target.style.borderColor = 'var(--bdr2)' }}
        >
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}

function Loader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#111' }}>
      <div style={{ textAlign: 'center', color: '#555' }}>
        <div style={{ fontSize: '2rem', marginBottom: 12 }}>📊</div>
        <div style={{ fontSize: '.82rem' }}>Cargando…</div>
      </div>
    </div>
  )
}
