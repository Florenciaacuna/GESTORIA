import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import {
  detectFileType, parseMayor, parseMov, parseOperaciones, buildMatches,
  formatDate, formatMonto,
} from '../lib/conciliacion'

const EMPRESAS = ['MOVILIS', 'KIARA', 'CIARA', 'PEARA', 'INV4', 'SALRA']

// ── ESTILOS BASE ────────────────────────────────────────────
const S = {
  wrap:  { maxWidth: 1400, margin: '0 auto', padding: '24px 20px 56px' },
  card:  { background: '#fff', borderRadius: 10, border: '1px solid #D1DCE5', padding: 20, marginBottom: 16 },
  label: { fontSize: '.74rem', fontWeight: 600, color: '#0D1F30', display: 'block', marginBottom: 5 },
  input: { border: '1.5px solid #D1DCE5', borderRadius: 7, padding: '9px 12px', fontSize: '.82rem', outline: 'none', color: '#0D1F30', background: '#fff' },
  btn:   (color = '#0D1F30', bg = '#fff') => ({
    border: `1.5px solid ${color === '#fff' ? 'transparent' : '#D1DCE5'}`,
    background: bg, color,
    borderRadius: 7, padding: '9px 18px', fontSize: '.82rem', fontWeight: 600, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 6,
  }),
  btnPrimary: { background: '#0D1F30', color: '#fff', border: 'none', borderRadius: 7, padding: '9px 22px', fontSize: '.82rem', fontWeight: 600, cursor: 'pointer' },
  btnGreen: { background: '#1DB863', color: '#fff', border: 'none', borderRadius: 7, padding: '9px 22px', fontSize: '.82rem', fontWeight: 600, cursor: 'pointer' },
  th: { background: '#1A3347', color: 'rgba(255,255,255,.9)', padding: '9px 10px', fontSize: '.72rem', fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap' },
  td: { padding: '8px 10px', borderBottom: '1px solid #EEF2F7', fontSize: '.76rem', verticalAlign: 'middle' },
  pill: (bg, txt) => ({ background: bg, color: txt, display: 'inline-block', padding: '2px 7px', borderRadius: 4, fontSize: '.68rem', fontWeight: 700 }),
}

export default function Conciliacion() {
  const { id } = useParams()
  const navigate = useNavigate()

  // Upload state
  const [workbooks, setWorkbooks] = useState([null, null, null])
  const [fileNames, setFileNames]  = useState(['', '', ''])
  const [empresa, setEmpresa]      = useState('')
  const [periodoDesde, setPeriodoDesde] = useState('')
  const [periodoHasta, setPeriodoHasta] = useState('')

  // Results state
  const [results,    setResults]    = useState(null)
  const [concilId,   setConcilId]   = useState(id || null)
  const [processing, setProcessing] = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [activeTab,  setActiveTab]  = useState(0)

  // Si hay id en la URL, cargar desde Supabase
  useEffect(() => {
    if (id) loadFromSupabase(id)
  }, [id])

  async function loadFromSupabase(concilId) {
    setProcessing(true)
    const [{ data: concil }, { data: deps }, { data: pags }, { data: pends }] = await Promise.all([
      supabase.from('conciliaciones').select('*').eq('id', concilId).single(),
      supabase.from('depositos').select('*').eq('conciliacion_id', concilId),
      supabase.from('pagos').select('*').eq('conciliacion_id', concilId),
      supabase.from('pendientes').select('*').eq('conciliacion_id', concilId),
    ])
    if (concil) {
      setEmpresa(concil.empresa)
      setPeriodoDesde(concil.periodo_desde)
      setPeriodoHasta(concil.periodo_hasta)
      // Reconstruir estructura de resultados desde Supabase
      setResults({
        depositos:    (deps || []).map(d => ({ mayor: { ref: d.op_ref, fecha: d.fecha_mayor, monto: d.monto_mayor, desc: d.desc_mayor }, th: { fecha: d.fecha_th, monto: d.monto_th, desc: d.desc_th }, dias: d.dias_diferencia, estado: d.estado })),
        pagos:        (pags || []).map(p => ({ _dbId: p.id, mayor: { referencia: p.rm_ref, th_num: p.th_num, fecha: p.fecha_mayor, monto: p.monto_mayor, desc: p.desc_mayor }, th: { fecha: p.fecha_th, monto: p.monto_th }, op: p.minuta ? { minuta: p.minuta, seccRPA: p.secc_rpa, tarjetahabiente: p.tarjetahabiente, motivoPago: p.motivo_pago } : null, diferencia: parseFloat(p.diferencia), lote: p.lote || '', estado: p.estado })),
        pendMayor:    (pends || []).filter(p => p.origen === 'mayor').map(p => ({ item: { tipo: p.tipo_movimiento, fecha: p.fecha, monto: p.monto, descripcion: p.descripcion, referencia: p.referencia }, razon: p.motivo })),
        pendCredits:  (pends || []).filter(p => p.origen === 'th' && p.tipo_movimiento === 'CREDIT').map(p => ({ codRef: p.referencia, fecha: p.fecha, monto: p.monto, descripcion: p.descripcion })),
        pendDebits:   (pends || []).filter(p => p.origen === 'th' && p.tipo_movimiento === 'DEBIT').map(p => ({ codRef: p.referencia, fecha: p.fecha, monto: p.monto, descripcion: p.descripcion })),
      })
      setConcilId(concilId)
    }
    setProcessing(false)
  }

  // ── UPLOAD DE ARCHIVOS ───────────────────────────────────
  function handleDrop(e, hint) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) readFile(file, hint)
  }

  async function readFile(file, hint) {
    const buf = await file.arrayBuffer()
    const wb  = XLSX.read(buf, { type: 'array', cellDates: true })
    const tipo = detectFileType(wb)
    const slot = tipo === 'mayor' ? 0 : tipo === 'mov' ? 1 : tipo === 'operaciones' ? 2 : hint

    setWorkbooks(prev => { const n = [...prev]; n[slot] = wb; return n })
    setFileNames(prev => { const n = [...prev]; n[slot] = file.name; return n })
  }

  const allLoaded = workbooks.every(Boolean) && empresa

  // ── PROCESAR ─────────────────────────────────────────────
  async function procesar() {
    setProcessing(true)
    try {
      const mayor      = parseMayor(workbooks[0])
      const mov        = parseMov(workbooks[1])
      const ops        = parseOperaciones(workbooks[2])
      const res        = buildMatches(mayor, mov, ops)
      setResults(res)
      setActiveTab(0)
    } catch (err) {
      alert('Error al procesar: ' + err.message)
    }
    setProcessing(false)
  }

  // ── GUARDAR EN SUPABASE ───────────────────────────────────
  async function guardarEnSupabase() {
    if (!results || !empresa) return
    setSaving(true)
    try {
      // 1. Crear o actualizar la conciliación
      let cId = concilId
      if (!cId) {
        const { data, error } = await supabase.from('conciliaciones').insert({
          empresa,
          periodo_desde: periodoDesde || null,
          periodo_hasta: periodoHasta || null,
          estado: 'borrador',
        }).select('id').single()
        if (error) throw error
        cId = data.id
        setConcilId(cId)
        navigate(`/conciliacion/${cId}`, { replace: true })
      }

      // 2. Borrar datos previos (si se está sobreescribiendo)
      await Promise.all([
        supabase.from('depositos').delete().eq('conciliacion_id', cId),
        supabase.from('pagos').delete().eq('conciliacion_id', cId),
        supabase.from('pendientes').delete().eq('conciliacion_id', cId),
      ])

      // 3. Insertar depósitos
      if (results.depositos.length) {
        await supabase.from('depositos').insert(results.depositos.map(d => ({
          conciliacion_id: cId,
          op_ref:          d.mayor.referencia || d.mayor.ref,
          fecha_mayor:     formatDate(d.mayor.fecha) || null,
          monto_mayor:     d.mayor.monto,
          desc_mayor:      d.mayor.descripcion || d.mayor.desc,
          fecha_th:        formatDate(d.th.fecha) || null,
          monto_th:        d.th.monto,
          desc_th:         d.th.descripcion || d.th.desc,
          estado:          d.estado || 'conciliado',
          dias_diferencia: d.dias || 0,
        })))
      }

      // 4. Insertar pagos
      if (results.pagos.length) {
        const { data: pagosInserted } = await supabase.from('pagos').insert(results.pagos.map(p => ({
          conciliacion_id: cId,
          rm_ref:          p.mayor.referencia || p.mayor.rm_ref,
          th_num:          p.mayor.th_num || p.mayor.referencia,
          fecha_mayor:     formatDate(p.mayor.fecha) || null,
          monto_mayor:     p.mayor.monto,
          desc_mayor:      p.mayor.descripcion || p.mayor.desc,
          fecha_th:        formatDate(p.th.fecha) || null,
          monto_th:        p.th.monto,
          nro_pago_th:     p.th.pagoNum || null,
          nro_operacion:   p.op?.nroOp  || null,
          minuta:          p.op?.minuta || p.op?.minuta || null,
          secc_rpa:        p.op?.seccRPA || null,
          tarjetahabiente: p.op?.tarjetahabiente || null,
          motivo_pago:     p.op?.motivoPago || null,
          lote:            p.lote || null,
          diferencia:      p.diferencia || 0,
          estado:          p.estado || 'sin_lote',
        }))).select('id')

        // Actualizar _dbId en el state para saves posteriores de lotes
        if (pagosInserted) {
          setResults(prev => ({
            ...prev,
            pagos: prev.pagos.map((p, i) => ({ ...p, _dbId: pagosInserted[i]?.id }))
          }))
        }
      }

      // 5. Insertar pendientes
      const pendAll = [
        ...results.pendMayor.map(p => ({ conciliacion_id: cId, origen: 'mayor', tipo_movimiento: p.item.tipo, fecha: formatDate(p.item.fecha) || null, monto: p.item.monto, descripcion: p.item.descripcion || p.item.desc, referencia: p.item.referencia, motivo: p.razon })),
        ...results.pendCredits.map(p => ({ conciliacion_id: cId, origen: 'th', tipo_movimiento: 'CREDIT', fecha: formatDate(p.fecha) || null, monto: p.monto, descripcion: p.descripcion, referencia: p.codRef })),
        ...results.pendDebits.map(p => ({ conciliacion_id: cId, origen: 'th', tipo_movimiento: 'DEBIT', fecha: formatDate(p.fecha) || null, monto: p.monto, descripcion: p.descripcion, referencia: p.codRef })),
      ]
      if (pendAll.length) await supabase.from('pendientes').insert(pendAll)

      alert('✓ Guardado en Supabase correctamente')
    } catch (err) {
      alert('Error al guardar: ' + err.message)
      console.error(err)
    }
    setSaving(false)
  }

  // ── ACTUALIZAR LOTE (auto-save a Supabase) ────────────────
  async function updateLote(idx, value) {
    const pago = results.pagos[idx]
    const nuevoEstado = value.trim()
      ? (Math.abs(pago.diferencia) > 50 ? 'revisar' : 'ok')
      : 'sin_lote'

    setResults(prev => ({
      ...prev,
      pagos: prev.pagos.map((p, i) => i === idx
        ? { ...p, lote: value, estado: nuevoEstado }
        : p
      )
    }))

    // Guardar en Supabase si hay ID
    if (pago._dbId) {
      await supabase.from('pagos')
        .update({ lote: value || null, estado: nuevoEstado, updated_at: new Date().toISOString() })
        .eq('id', pago._dbId)
    }
  }

  // ── EXPORT EXCEL ─────────────────────────────────────────
  function exportExcel() {
    if (!results) return
    const { depositos, pagos, pendMayor, pendCredits, pendDebits } = results
    const wb = XLSX.utils.book_new()

    const ws1 = XLSX.utils.aoa_to_sheet([
      ['Tipo', 'Ref. Mayor', 'Fecha Mayor', 'Monto Mayor', 'Fecha TH', 'Descripción TH', 'Monto TH', 'Estado', 'Días'],
      ...depositos.map(r => ['Depósito', r.mayor.referencia || r.mayor.ref, formatDate(r.mayor.fecha), r.mayor.monto, formatDate(r.th.fecha), r.th.descripcion || r.th.desc, r.th.monto, r.estado, r.dias]),
      ...pagos.map(r => ['Pago', r.mayor.referencia || r.mayor.rm_ref, formatDate(r.mayor.fecha), r.mayor.monto, formatDate(r.th.fecha), r.th.descripcion || r.th.desc, r.th.monto, r.op?.minuta || '', r.lote || '']),
    ])
    XLSX.utils.book_append_sheet(wb, ws1, 'Conciliado')

    const ws2 = XLSX.utils.aoa_to_sheet([
      ['Origen', 'Tipo', 'Fecha', 'Monto', 'Descripción', 'Ref', 'Motivo'],
      ...pendMayor.map(p => ['Mayor', p.item.tipo, formatDate(p.item.fecha), p.item.monto, p.item.descripcion || p.item.desc, p.item.referencia, p.razon]),
      ...pendCredits.map(p => ['TH', 'CREDIT', formatDate(p.fecha), p.monto, p.descripcion, p.codRef, 'OP a conciliar']),
      ...pendDebits.map(p => ['TH', 'DEBIT', formatDate(p.fecha), p.monto, p.descripcion, p.codRef, '']),
    ])
    XLSX.utils.book_append_sheet(wb, ws2, 'Pendientes')

    XLSX.writeFile(wb, `Conciliacion_${empresa}_${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  // ── RENDER ───────────────────────────────────────────────
  if (processing && id) {
    return <div style={{ textAlign: 'center', padding: 60, color: '#637B8D' }}>Cargando conciliación…</div>
  }

  return (
    <div style={S.wrap}>
      {/* HEADER */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 3 }}>
          {concilId ? `Conciliación ${empresa}` : 'Nueva conciliación'}
        </div>
        <div style={{ fontSize: '.78rem', color: '#637B8D' }}>
          {concilId ? `ID: ${concilId}` : 'Cargá los archivos y procesá'}
        </div>
      </div>

      {/* CONFIG + UPLOAD */}
      {!results && (
        <div style={S.card}>
          {/* Empresa + período */}
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div>
              <label style={S.label}>Empresa *</label>
              <select style={{ ...S.input, width: '100%' }} value={empresa} onChange={e => setEmpresa(e.target.value)}>
                <option value="">Seleccioná</option>
                {EMPRESAS.map(e => <option key={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Período desde</label>
              <input type="date" style={{ ...S.input, width: '100%' }} value={periodoDesde} onChange={e => setPeriodoDesde(e.target.value)} />
            </div>
            <div>
              <label style={S.label}>Período hasta</label>
              <input type="date" style={{ ...S.input, width: '100%' }} value={periodoHasta} onChange={e => setPeriodoHasta(e.target.value)} />
            </div>
          </div>

          {/* Zonas de upload */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Mayor Autodealer (K1)', hint: '📊', slot: 0 },
              { label: 'Movimientos de Cuenta TH', hint: '💳', slot: 1 },
              { label: 'Operaciones de Pago TH', hint: '📋', slot: 2 },
            ].map(({ label, hint, slot }) => (
              <div
                key={slot}
                onDragOver={e => e.preventDefault()}
                onDrop={e => handleDrop(e, slot)}
                style={{
                  border: `1.5px dashed ${workbooks[slot] ? '#1DB863' : '#D1DCE5'}`,
                  background: workbooks[slot] ? '#E8F9EE' : '#fff',
                  borderRadius: 10, padding: '20px 16px', textAlign: 'center',
                  cursor: 'pointer', position: 'relative',
                }}
              >
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
                  onChange={e => e.target.files[0] && readFile(e.target.files[0], slot)}
                />
                <div style={{ fontSize: '1.6rem', marginBottom: 7 }}>{hint}</div>
                <div style={{ fontSize: '.82rem', fontWeight: 600, marginBottom: 4 }}>{label}</div>
                {fileNames[slot]
                  ? <div style={{ fontSize: '.72rem', color: '#1DB863', fontWeight: 600 }}>✓ {fileNames[slot]}</div>
                  : <div style={{ fontSize: '.72rem', color: '#637B8D' }}>Arrastrá o hacé click</div>
                }
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              style={{ ...S.btnPrimary, opacity: (!allLoaded || processing) ? .5 : 1 }}
              disabled={!allLoaded || processing}
              onClick={procesar}
            >
              {processing ? '⏳ Procesando…' : '⚡ Conciliar'}
            </button>
            {!allLoaded && (
              <span style={{ fontSize: '.78rem', color: '#637B8D', alignSelf: 'center' }}>
                {!empresa ? 'Seleccioná la empresa' : 'Cargá los 3 archivos'}
              </span>
            )}
          </div>
        </div>
      )}

      {/* RESULTADOS */}
      {results && <ResultsSection
        results={results}
        empresa={empresa}
        concilId={concilId}
        saving={saving}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onGuardar={guardarEnSupabase}
        onExport={exportExcel}
        onNueva={() => { setResults(null); setWorkbooks([null,null,null]); setFileNames(['','','']); setConcilId(null); navigate('/nueva') }}
        onUpdateLote={updateLote}
      />}
    </div>
  )
}

// ── SECCIÓN DE RESULTADOS ────────────────────────────────────
function ResultsSection({ results, empresa, concilId, saving, activeTab, setActiveTab, onGuardar, onExport, onNueva, onUpdateLote }) {
  const { depositos, pagos, pendMayor, pendCredits, pendDebits } = results
  const totDep  = depositos.reduce((s, r) => s + r.mayor.monto, 0)
  const totPag  = pagos.reduce((s, r) => s + r.mayor.monto, 0)
  const sinLote = pagos.filter(p => !p.lote).length
  const conDiff = pagos.filter(p => Math.abs(p.diferencia) > 50).length
  const pendTotal = pendMayor.length + pendCredits.length + pendDebits.length

  const kpis = [
    { label: 'Depósitos', value: depositos.length, sub: `$ ${formatMonto(totDep)}`, color: '#1DB863' },
    { label: 'Pagos conciliados', value: pagos.length, sub: `$ ${formatMonto(totPag)}`, color: '#1A73E8' },
    { label: 'Sin lote', value: sinLote, sub: sinLote ? 'Completar desde CELER' : 'Todos asignados', color: sinLote ? '#E8960A' : '#1DB863' },
    { label: 'Dif. > $50', value: conDiff, sub: conDiff ? 'Revisar urgente' : 'Sin diferencias', color: conDiff ? '#D93025' : '#1DB863' },
    { label: 'Pendientes', value: pendTotal, sub: pendCredits.length ? `${pendCredits.length} OP a conciliar` : 'Sin pendientes', color: pendTotal ? '#E8960A' : '#1DB863' },
  ]

  return (
    <>
      {/* ACCIONES */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {!concilId && (
          <button style={S.btnGreen} onClick={onGuardar} disabled={saving}>
            {saving ? '⏳ Guardando…' : '💾 Guardar en Supabase'}
          </button>
        )}
        {concilId && (
          <button style={{ ...S.btnGreen, background: '#0D1F30' }} onClick={onGuardar} disabled={saving}>
            {saving ? '⏳ Actualizando…' : '💾 Actualizar'}
          </button>
        )}
        <button style={S.btn()} onClick={onExport}>⬇ Descargar Excel</button>
        <button style={S.btn()} onClick={onNueva}>↺ Nueva conciliación</button>
        {concilId && <span style={{ fontSize: '.72rem', color: '#637B8D', alignSelf: 'center' }}>Los lotes se guardan automáticamente</span>}
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ background: '#fff', borderRadius: 9, padding: '14px 16px', borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: '.68rem', color: '#637B8D', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 900, color: k.color, fontVariantNumeric: 'tabular-nums' }}>{k.value}</div>
            <div style={{ fontSize: '.72rem', color: '#637B8D', marginTop: 2 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '2px solid #D1DCE5', marginBottom: 16 }}>
        {[
          `💰 Depósitos (${depositos.length})`,
          `📋 Pagos y Lotes (${pagos.length})`,
          `⚠ Pendientes (${pendTotal})`,
        ].map((label, i) => (
          <button key={i} onClick={() => setActiveTab(i)} style={{
            padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '.8rem', fontWeight: 600,
            color: activeTab === i ? '#0D1F30' : '#637B8D',
            borderBottom: `3px solid ${activeTab === i ? '#0D1F30' : 'transparent'}`,
            marginBottom: -2,
          }}>{label}</button>
        ))}
      </div>

      {/* TAB 0: DEPÓSITOS */}
      {activeTab === 0 && (
        <>
          {pendCredits.length > 0 && (
            <div style={{ background: '#FEF4DC', border: '1px solid #f5c75a', borderRadius: 8, padding: '12px 16px', marginBottom: 14, fontSize: '.78rem', color: '#7a4d00' }}>
              <strong>⚠ {pendCredits.length} OP a conciliar</strong> — Estos CREDIT están en TH pero no tienen OP en el Mayor. Anotarlos en B7 de la pestaña Conciliación.
            </div>
          )}
          <div style={{ overflow: 'auto', borderRadius: 8, border: '1px solid #D1DCE5' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                {['Ref. OP', 'Fecha Mayor', 'Monto Mayor', 'Fecha TH', 'Descripción TH', 'Monto TH', 'Días', 'Estado'].map(h => <th key={h} style={S.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {depositos.map((r, i) => (
                  <tr key={i}>
                    <td style={S.td}><strong>{r.mayor.referencia || r.mayor.ref}</strong></td>
                    <td style={S.td}>{formatDate(r.mayor.fecha)}</td>
                    <td style={{ ...S.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatMonto(r.mayor.monto)}</td>
                    <td style={S.td}>{formatDate(r.th.fecha)}</td>
                    <td style={{ ...S.td, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.th.descripcion || r.th.desc}</td>
                    <td style={{ ...S.td, textAlign: 'right' }}>{formatMonto(r.th.monto)}</td>
                    <td style={{ ...S.td, textAlign: 'right', color: r.dias > 3 ? '#E8960A' : '#1DB863', fontWeight: 600 }}>{r.dias}</td>
                    <td style={S.td}><span style={S.pill('#E8F9EE', '#0a7538')}>Conciliado</span></td>
                  </tr>
                ))}
                {pendCredits.map((r, i) => (
                  <tr key={'c'+i}>
                    <td style={S.td}>—</td>
                    <td style={S.td}>—</td>
                    <td style={{ ...S.td, textAlign: 'right' }}>—</td>
                    <td style={S.td}>{formatDate(r.fecha)}</td>
                    <td style={{ ...S.td, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.descripcion}</td>
                    <td style={{ ...S.td, textAlign: 'right', color: '#D93025', fontWeight: 600 }}>{formatMonto(r.monto)}</td>
                    <td style={S.td}>—</td>
                    <td style={S.td}><span style={S.pill('#FEF4DC', '#7a4d00')}>OP a conciliar</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* TAB 1: PAGOS Y LOTES */}
      {activeTab === 1 && (
        <>
          {sinLote > 0 && (
            <div style={{ background: '#FEF4DC', border: '1px solid #f5c75a', borderRadius: 8, padding: '12px 16px', marginBottom: 14, fontSize: '.78rem', color: '#7a4d00' }}>
              <strong>ℹ {sinLote} pago{sinLote > 1 ? 's' : ''} sin lote asignado.</strong> Completá la columna Lote con el número de rendición de CELER.
              {!concilId && <span style={{ marginLeft: 8 }}>Guardá primero en Supabase para que los lotes se guarden automáticamente.</span>}
            </div>
          )}
          <div style={{ overflow: 'auto', borderRadius: 8, border: '1px solid #D1DCE5' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                {['Fecha Mayor', 'RM Ref.', 'Monto Mayor', 'Minuta', 'Seccional', 'Tarjetahabiente', 'Fecha TH', 'Monto TH', 'Diferencia', 'Lote'].map(h => <th key={h} style={S.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {pagos.map((r, i) => (
                  <tr key={i}>
                    <td style={S.td}>{formatDate(r.mayor.fecha)}</td>
                    <td style={S.td}>{r.mayor.referencia || r.mayor.rm_ref}</td>
                    <td style={{ ...S.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatMonto(r.mayor.monto)}</td>
                    <td style={S.td}><strong>{r.op?.minuta || '—'}</strong></td>
                    <td style={{ ...S.td, fontSize: '.7rem' }}>{r.op?.seccRPA || ''}</td>
                    <td style={{ ...S.td, fontSize: '.7rem', whiteSpace: 'nowrap' }}>{r.op?.tarjetahabiente || ''}</td>
                    <td style={S.td}>{formatDate(r.th.fecha)}</td>
                    <td style={{ ...S.td, textAlign: 'right' }}>{formatMonto(r.th.monto)}</td>
                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 600, color: Math.abs(r.diferencia) > 50 ? '#D93025' : Math.abs(r.diferencia) > 0 ? '#E8960A' : '#1DB863' }}>
                      {Math.abs(r.diferencia) < 0.01 ? '—' : formatMonto(r.diferencia)}
                    </td>
                    <td style={S.td}>
                      <input
                        value={r.lote}
                        onChange={e => onUpdateLote(i, e.target.value)}
                        placeholder="Nro lote"
                        style={{
                          width: 90, border: `1.5px solid ${r.lote ? '#1DB863' : '#E8960A'}`,
                          background: r.lote ? '#E8F9EE' : '#FEF4DC',
                          borderRadius: 5, padding: '4px 7px', fontSize: '.75rem',
                          fontWeight: 600, color: '#0D1F30', outline: 'none',
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* TAB 2: PENDIENTES */}
      {activeTab === 2 && (
        pendTotal === 0
          ? <div style={{ textAlign: 'center', padding: '40px 20px', color: '#637B8D' }}>✅ Sin pendientes — todo conciliado.</div>
          : <>
            {pendMayor.length > 0 && <>
              <div style={{ fontSize: '.82rem', fontWeight: 700, color: '#0D1F30', marginBottom: 10 }}>
                📌 En Mayor sin match en TH ({pendMayor.length})
              </div>
              <div style={{ overflow: 'auto', borderRadius: 8, border: '1px solid #D1DCE5', marginBottom: 20 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>{['Tipo','Fecha','Descripción','Ref.','Monto','Motivo'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                  <tbody>{pendMayor.map((r,i)=>(
                    <tr key={i}>
                      <td style={S.td}><span style={S.pill('#FEF4DC','#7a4d00')}>{r.item.tipo}</span></td>
                      <td style={S.td}>{formatDate(r.item.fecha)}</td>
                      <td style={{ ...S.td, maxWidth: 280 }}>{r.item.descripcion || r.item.desc}</td>
                      <td style={S.td}>{r.item.referencia}</td>
                      <td style={{ ...S.td, textAlign: 'right', color: '#E8960A', fontWeight: 600 }}>{formatMonto(r.item.monto)}</td>
                      <td style={{ ...S.td, fontSize: '.72rem', color: '#E8960A' }}>{r.razon}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </>}
            {pendDebits.length > 0 && <>
              <div style={{ fontSize: '.82rem', fontWeight: 700, color: '#0D1F30', marginBottom: 10 }}>
                🔴 DEBIT en TH sin match en Mayor ({pendDebits.length})
              </div>
              <div style={{ overflow: 'auto', borderRadius: 8, border: '1px solid #D1DCE5' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>{['Cod Ref','Fecha','Descripción','Monto'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                  <tbody>{pendDebits.map((r,i)=>(
                    <tr key={i}>
                      <td style={S.td}>{r.codRef}</td>
                      <td style={S.td}>{formatDate(r.fecha)}</td>
                      <td style={{ ...S.td, maxWidth: 320 }}>{r.descripcion}</td>
                      <td style={{ ...S.td, textAlign: 'right', color: '#D93025', fontWeight: 600 }}>{formatMonto(r.monto)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </>}
          </>
      )}
    </>
  )
}
