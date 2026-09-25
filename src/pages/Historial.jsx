import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const EMPRESAS = ['MOVILIS', 'KIARA', 'CIARA', 'PEARA', 'INV4', 'SALRA']

export default function Historial() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroEmpresa, setFiltroEmpresa] = useState('')
  const navigate = useNavigate()

  useEffect(() => { fetchData() }, [filtroEmpresa])

  async function fetchData() {
    setLoading(true)
    let q = supabase
      .from('v_resumen')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (filtroEmpresa) q = q.eq('empresa', filtroEmpresa)

    const { data, error } = await q
    if (!error) setRows(data || [])
    setLoading(false)
  }

  const s = {
    wrap: { maxWidth: 1200, margin: '0 auto', padding: '28px 20px' },
    head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
    title: { fontSize: '1.05rem', fontWeight: 700 },
    sub: { fontSize: '.78rem', color: '#637B8D', marginTop: 3 },
    filter: {
      border: '1.5px solid #D1DCE5', borderRadius: 7, padding: '8px 12px',
      fontSize: '.82rem', color: '#0D1F30', background: '#fff', outline: 'none',
    },
    btnNueva: {
      background: '#1DB863', color: '#fff', border: 'none', borderRadius: 7,
      padding: '9px 20px', fontSize: '.82rem', fontWeight: 600,
    },
    tbox: {
      background: '#fff', borderRadius: 10, border: '1px solid #D1DCE5', overflow: 'hidden',
    },
    th: {
      background: '#1A3347', color: 'rgba(255,255,255,.9)',
      padding: '10px 14px', fontSize: '.74rem', fontWeight: 600,
      textAlign: 'left', whiteSpace: 'nowrap',
    },
    td: { padding: '10px 14px', fontSize: '.78rem', borderBottom: '1px solid #EEF2F7', verticalAlign: 'middle' },
    badge: { display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: '.68rem', fontWeight: 600 },
    empty: { textAlign: 'center', padding: '48px 20px', color: '#637B8D' },
  }

  function estadoBadge(row) {
    const pend = (row.pag_sin_lote || 0) + (row.pendientes_total || 0)
    if (pend === 0 && row.estado === 'completa') {
      return <span style={{ ...s.badge, background: '#E8F9EE', color: '#0a7538' }}>Completa</span>
    }
    if (pend > 0) {
      return <span style={{ ...s.badge, background: '#FEF4DC', color: '#7a4d00' }}>En proceso</span>
    }
    return <span style={{ ...s.badge, background: '#EEF2F7', color: '#637B8D' }}>Borrador</span>
  }

  return (
    <div style={s.wrap}>
      <div style={s.head}>
        <div>
          <div style={s.title}>Historial de conciliaciones</div>
          <div style={s.sub}>Todas las conciliaciones guardadas</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <select
            style={s.filter}
            value={filtroEmpresa}
            onChange={e => setFiltroEmpresa(e.target.value)}
          >
            <option value="">Todas las empresas</option>
            {EMPRESAS.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          <button style={s.btnNueva} onClick={() => navigate('/nueva')}>
            + Nueva conciliación
          </button>
        </div>
      </div>

      <div style={s.tbox}>
        {loading ? (
          <div style={s.empty}>Cargando…</div>
        ) : rows.length === 0 ? (
          <div style={s.empty}>
            <div style={{ fontSize: '2rem', marginBottom: 10 }}>📋</div>
            No hay conciliaciones guardadas aún.
            <br />
            <button
              style={{ ...s.btnNueva, marginTop: 16, cursor: 'pointer' }}
              onClick={() => navigate('/nueva')}
            >
              Crear la primera
            </button>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Empresa', 'Período', 'Depósitos', 'Pagos', 'Sin lote', 'Diferencias', 'Pendientes', 'Estado', ''].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr
                  key={row.id}
                  onClick={() => navigate(`/conciliacion/${row.id}`)}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.querySelectorAll('td').forEach(td => td.style.background = '#F5F9FF')}
                  onMouseLeave={e => e.currentTarget.querySelectorAll('td').forEach(td => td.style.background = '')}
                >
                  <td style={{ ...s.td, fontWeight: 700 }}>{row.empresa}</td>
                  <td style={s.td}>
                    {row.periodo_desde} → {row.periodo_hasta}
                  </td>
                  <td style={{ ...s.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {row.dep_total || 0}
                  </td>
                  <td style={{ ...s.td, textAlign: 'right' }}>{row.pag_total || 0}</td>
                  <td style={{ ...s.td, textAlign: 'right', color: row.pag_sin_lote > 0 ? '#E8960A' : '#1DB863', fontWeight: 600 }}>
                    {row.pag_sin_lote || 0}
                  </td>
                  <td style={{ ...s.td, textAlign: 'right', color: row.pag_con_diff > 0 ? '#D93025' : '#1DB863', fontWeight: 600 }}>
                    {row.pag_con_diff || 0}
                  </td>
                  <td style={{ ...s.td, textAlign: 'right', color: row.pendientes_total > 0 ? '#E8960A' : '#637B8D' }}>
                    {row.pendientes_total || 0}
                  </td>
                  <td style={s.td}>{estadoBadge(row)}</td>
                  <td style={{ ...s.td, color: '#1A73E8', fontSize: '.74rem' }}>Ver →</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
