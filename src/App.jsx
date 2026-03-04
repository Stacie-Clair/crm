import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import AuthPage from './AuthPage.jsx'

// ─── Constants ────────────────────────────────────────────────────────────────
const TRADES = ['Electrical','Plumbing','HVAC','Roofing','Carpentry','Painting','Landscaping','Flooring','Concrete','Drywall','Masonry','General Contractor','Other']
const STATUS_COLORS = { 'in-progress':'#F59E0B', 'completed':'#10B981', 'planning':'#3B82F6', 'on-hold':'#EF4444' }
const STATUS_BG     = { 'in-progress':'#FEF3C7', 'completed':'#D1FAE5', 'planning':'#DBEAFE', 'on-hold':'#FEE2E2' }
const STATUS_LABELS = { 'in-progress':'In Progress', 'completed':'Completed', 'planning':'Planning', 'on-hold':'On Hold' }
const PRIORITY_COLORS = { high:'#EF4444', medium:'#F59E0B', low:'#10B981' }
const PRIORITY_BG     = { high:'#FEF2F2', medium:'#FFFBEB', low:'#ECFDF5' }
const BID_COLORS = { pending:'#6B7280', accepted:'#10B981', rejected:'#EF4444' }
const BID_BG     = { pending:'#F3F4F6', accepted:'#D1FAE5', rejected:'#FEE2E2' }
const DOC_TYPES  = ['Quote','Invoice','Contract','Permit','Receipt','Photo','Other']
const DOC_ICONS  = { Quote:'📄', Invoice:'🧾', Contract:'📝', Permit:'🏛️', Receipt:'🧾', Photo:'📸', Other:'📎' }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2,10) }
function fmtCurrency(n) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n||0) }
function fmtDate(d) { if (!d) return '—'; return new Date(d+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) }
function fmtTs(ts) { return new Date(ts).toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) }
function calcPriorityScore(p) {
  const s = p.priority_scores || {}
  const vals = [s.urgency||0, s.safety||0, s.cost_impact||0, s.time_sensitivity||0]
  return vals.reduce((a,b)=>a+b,0)
}
function priorityLabel(score) {
  if (score >= 14) return 'high'
  if (score >= 8)  return 'medium'
  return 'low'
}
function calcProgress(milestones) {
  if (!milestones?.length) return 0
  return Math.round(milestones.reduce((a,m) => a + (m.weight||0) * ((m.progress||0)/100), 0))
}

function StarRating({ value, onChange }) {
  const [hov, setHov] = useState(0)
  return (
    <div style={{display:'flex',gap:1,alignItems:'center'}}>
      {[1,2,3,4,5].map(s => (
        <span key={s} onClick={()=>onChange&&onChange(s===value?0:s)}
          onMouseEnter={()=>onChange&&setHov(s)} onMouseLeave={()=>setHov(0)}
          style={{cursor:onChange?'pointer':'default',fontSize:16,color:(hov||value)>=s?'#F59E0B':'#D1D5DB',transition:'color .1s',userSelect:'none'}}>★</span>
      ))}
      {onChange && value>0 && <span onClick={()=>onChange(0)} style={{fontSize:11,color:'#D1D5DB',cursor:'pointer',marginLeft:4,userSelect:'none'}}>clear</span>}
    </div>
  )
}

function ScoreSlider({ label, value, onChange, hint }) {
  return (
    <div style={{marginBottom:14}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
        <label style={{fontSize:13,fontWeight:600,color:'#374151'}}>{label}</label>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          {hint && <span style={{fontSize:11,color:'#9CA3AF'}}>{hint}</span>}
          <span style={{fontSize:13,fontWeight:700,color:'#1D1D1F',minWidth:16,textAlign:'right'}}>{value}</span>
        </div>
      </div>
      <input type="range" min={1} max={5} value={value} onChange={e=>onChange(+e.target.value)}
        style={{width:'100%',accentColor:'#1D1D1F',cursor:'pointer'}} />
      <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'#9CA3AF',marginTop:2}}>
        <span>Low</span><span>High</span>
      </div>
    </div>
  )
}

// ─── Global CSS ───────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Figtree:wght@300;400;500;600;700;800&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin:0; padding:0; }
  body { background:#F5F5F7; font-family:'Figtree',sans-serif; -webkit-font-smoothing:antialiased; }
  ::-webkit-scrollbar { width:5px; height:5px; }
  ::-webkit-scrollbar-track { background:transparent; }
  ::-webkit-scrollbar-thumb { background:#D1D5DB; border-radius:3px; }
  input, textarea, select { outline:none; border:none; background:transparent; font-family:'Figtree',sans-serif; }
  button { cursor:pointer; border:none; background:none; font-family:'Figtree',sans-serif; }
  input[type=range] { -webkit-appearance:none; height:4px; background:#E5E7EB; border-radius:2px; }
  input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; width:16px; height:16px; border-radius:50%; background:#1D1D1F; cursor:pointer; }
  @keyframes fadeUp { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
  @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
`

// ─── Design Tokens ────────────────────────────────────────────────────────────
const T = {
  card:    { background:'#FFFFFF', border:'1px solid #E5E7EB', borderRadius:14, padding:20, boxShadow:'0 1px 3px rgba(0,0,0,0.04)' },
  cardHov: { background:'#FFFFFF', border:'1px solid #E5E7EB', borderRadius:14, padding:20, cursor:'pointer', transition:'all .18s ease', boxShadow:'0 1px 3px rgba(0,0,0,0.04)' },
  badge:   (s) => ({ display:'inline-flex', alignItems:'center', padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600, background:STATUS_BG[s], color:STATUS_COLORS[s] }),
  bidBadge:(s) => ({ display:'inline-flex', alignItems:'center', padding:'2px 9px', borderRadius:20, fontSize:11, fontWeight:600, background:BID_BG[s]||'#F3F4F6', color:BID_COLORS[s]||'#6B7280' }),
  priLabel:(score) => { const l=priorityLabel(score); return { display:'inline-flex', alignItems:'center', padding:'2px 9px', borderRadius:20, fontSize:11, fontWeight:600, background:PRIORITY_BG[l], color:PRIORITY_COLORS[l] }},
  tradePill:{ display:'inline-flex', alignItems:'center', padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:500, background:'#F3F4F6', color:'#6B7280' },
  btnPrimary:   { display:'inline-flex', alignItems:'center', gap:6, padding:'8px 18px', borderRadius:9, background:'#1D1D1F', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' },
  btnSecondary: { display:'inline-flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:9, background:'#F3F4F6', color:'#374151', fontSize:13, fontWeight:500, cursor:'pointer', border:'none' },
  btnDanger:    { display:'inline-flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:8, background:'#FEF2F2', color:'#EF4444', fontSize:12, fontWeight:600, cursor:'pointer' },
  label:   { fontSize:11, fontWeight:600, color:'#9CA3AF', letterSpacing:'0.4px', textTransform:'uppercase', marginBottom:6, display:'block' },
  input:   { width:'100%', background:'#F9FAFB', border:'1px solid #E5E7EB', borderRadius:9, padding:'9px 13px', color:'#1D1D1F', fontSize:14 },
  select:  { width:'100%', background:'#F9FAFB', border:'1px solid #E5E7EB', borderRadius:9, padding:'9px 13px', color:'#1D1D1F', fontSize:14 },
  textarea:{ width:'100%', background:'#F9FAFB', border:'1px solid #E5E7EB', borderRadius:9, padding:'9px 13px', color:'#1D1D1F', fontSize:14, resize:'vertical', minHeight:72 },
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState(undefined)
  const [contractors, setContractors] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('dashboard')
  const [modal, setModal] = useState(null)
  const [search, setSearch] = useState('')
  const [tradeFilter, setTradeFilter] = useState('All')
  const [toast, setToast] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session) loadAll()
    else if (session === null) setLoading(false)
  }, [session])

  async function loadAll() {
    setLoading(true)
    const [{ data: c }, { data: p }] = await Promise.all([
      supabase.from('contractors').select('*').order('created_at', { ascending: false }),
      supabase.from('projects').select('*, project_contractors(contractor_id)').order('created_at', { ascending: false }),
    ])
    setContractors(c || [])
    setProjects((p||[]).map(proj => ({ ...proj, contractors:(proj.project_contractors||[]).map(pc=>pc.contractor_id) })))
    setLoading(false)
  }

  const showToast = useCallback((msg, type='success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2800)
  }, [])

  if (session === undefined) return <Loader />
  if (session === null) return <AuthPage />
  if (loading) return <Loader />

  const filteredContractors = contractors.filter(c => {
    const q = search.toLowerCase()
    return (!q || c.name?.toLowerCase().includes(q) || c.trade?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q))
      && (tradeFilter === 'All' || c.trade === tradeFilter)
  })

  // ── Contractor CRUD ──
  async function saveContractor(data) {
    const { id } = data
    const payload = {
      name:data.name, trade:data.trade, phone:data.phone, email:data.email,
      website:data.website, rating:data.rating||null,
      referred_by:data.referredBy||data.referred_by,
      notes:data.notes, tags:data.tags||[], documents:data.documents||[], emails:data.emails||[],
      user_id:session.user.id,
    }
    if (id) {
      const { data:u, error } = await supabase.from('contractors').update(payload).eq('id',id).select().single()
      if (error) return showToast('Error: '+error.message,'warn')
      setContractors(cs => cs.map(c => c.id===id ? u : c))
      showToast('Contractor updated')
    } else {
      const { data:u, error } = await supabase.from('contractors').insert(payload).select().single()
      if (error) return showToast('Error: '+error.message,'warn')
      setContractors(cs => [u,...cs])
      showToast('Contractor added')
    }
    setModal(null)
  }

  async function deleteContractor(id) {
    const { error } = await supabase.from('contractors').delete().eq('id',id)
    if (error) return showToast('Error: '+error.message,'warn')
    setContractors(cs => cs.filter(c=>c.id!==id))
    setProjects(ps => ps.map(p=>({...p,contractors:p.contractors.filter(cid=>cid!==id)})))
    showToast('Contractor deleted','warn')
    setModal(null)
  }

  // ── Project CRUD ──
  async function saveProject(data) {
    const { id, contractors:assignedIds, tasks, milestones, bids, activity_log, priority_scores, ...rest } = data
    const payload = {
      name:rest.name, property:rest.property, status:rest.status,
      start_date:rest.startDate||rest.start_date||null,
      end_date:rest.endDate||rest.end_date||null,
      budget:rest.budget||0, spent:rest.spent||0,
      description:rest.description, notes:rest.notes,
      tasks:tasks||[], milestones:milestones||[], bids:bids||[],
      activity_log:activity_log||[], priority_scores:priority_scores||{},
      user_id:session.user.id,
    }
    if (id) {
      const { data:u, error } = await supabase.from('projects').update(payload).eq('id',id).select().single()
      if (error) return showToast('Error: '+error.message,'warn')
      await supabase.from('project_contractors').delete().eq('project_id',id)
      if (assignedIds?.length) await supabase.from('project_contractors').insert(assignedIds.map(cid=>({project_id:id,contractor_id:cid})))
      setProjects(ps => ps.map(p => p.id===id ? {...u,contractors:assignedIds||[]} : p))
      showToast('Project updated')
    } else {
      const { data:u, error } = await supabase.from('projects').insert(payload).select().single()
      if (error) return showToast('Error: '+error.message,'warn')
      if (assignedIds?.length) await supabase.from('project_contractors').insert(assignedIds.map(cid=>({project_id:u.id,contractor_id:cid})))
      setProjects(ps => [{...u,contractors:assignedIds||[]},...ps])
      showToast('Project added')
    }
    setModal(null)
  }

  async function deleteProject(id) {
    const { error } = await supabase.from('projects').delete().eq('id',id)
    if (error) return showToast('Error: '+error.message,'warn')
    setProjects(ps => ps.filter(p=>p.id!==id))
    showToast('Project deleted','warn')
    setModal(null)
  }

  async function updateProjectField(projectId, fields) {
    const { data, error } = await supabase.from('projects').update(fields).eq('id',projectId).select().single()
    if (error) return showToast('Error updating','warn')
    setProjects(ps => ps.map(p => p.id===projectId ? {...data,contractors:p.contractors} : p))
    return data
  }

  async function updateContractorField(contractorId, field, value) {
    const { data, error } = await supabase.from('contractors').update({[field]:value}).eq('id',contractorId).select().single()
    if (error) return showToast('Error updating','warn')
    setContractors(cs => cs.map(c => c.id===contractorId ? data : c))
    return data
  }

  // ── Stats ──
  const totalBudget = projects.reduce((a,p)=>a+(p.budget||0),0)
  const totalSpent  = projects.reduce((a,p)=>a+(p.spent||0),0)
  const activeProjects = projects.filter(p=>p.status==='in-progress')
  const avgRating = contractors.length ? (contractors.reduce((a,c)=>a+(c.rating||0),0)/contractors.length).toFixed(1) : '—'

  return (
    <div style={{ fontFamily:"'Figtree',sans-serif", background:'#F5F5F7', minHeight:'100vh', color:'#1D1D1F' }}>
      <style>{GLOBAL_CSS}</style>

      {/* Nav */}
      <nav style={{ background:'rgba(255,255,255,0.9)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', borderBottom:'1px solid #E5E7EB', height:52, display:'flex', alignItems:'center', padding:'0 28px', position:'sticky', top:0, zIndex:100 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginRight:28 }}>
          <div style={{ width:26, height:26, background:'#1D1D1F', borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13 }}>🔨</div>
          <span style={{ fontWeight:700, fontSize:15, letterSpacing:'-0.3px' }}>ContractorCRM</span>
        </div>
        <div style={{ display:'flex', gap:2 }}>
          {[['dashboard','Dashboard'],['contractors','Contractors'],['projects','Projects']].map(([v,l])=>(
            <button key={v} onClick={()=>{setView(v);setSearch('');setTradeFilter('All')}}
              style={{ padding:'5px 13px', borderRadius:7, fontSize:13, fontWeight:500, color:view===v?'#1D1D1F':'#9CA3AF', background:view===v?'#F3F4F6':'transparent', cursor:'pointer', border:'none', transition:'all .15s' }}>
              {l}
            </button>
          ))}
        </div>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:12, color:'#9CA3AF' }}>{session.user.email}</span>
          <button onClick={()=>supabase.auth.signOut()} style={{ ...T.btnSecondary, padding:'6px 13px', fontSize:12 }}>Sign out</button>
        </div>
      </nav>

      <div style={{ maxWidth:1300, margin:'0 auto', padding:'32px 28px', display:'flex', flexDirection:'column', gap:24 }}>
        <h1 style={{ fontSize:26, fontWeight:700, letterSpacing:'-0.6px' }}>
          {view==='dashboard'?'Overview':view==='contractors'?'Contractors':'Projects'}
        </h1>

        {view==='dashboard' && <DashboardView contractors={contractors} projects={projects} activeProjects={activeProjects} totalBudget={totalBudget} totalSpent={totalSpent} avgRating={avgRating} setView={setView} setModal={setModal} />}
        {view==='contractors' && <ContractorsView contractors={filteredContractors} allCount={contractors.length} search={search} setSearch={setSearch} tradeFilter={tradeFilter} setTradeFilter={setTradeFilter} setModal={setModal} />}
        {view==='projects' && <ProjectsView projects={projects} contractors={contractors} setModal={setModal} />}
      </div>

      {modal?.type==='contractor-form'   && <ContractorForm initial={modal.data} onSave={saveContractor} onClose={()=>setModal(null)} />}
      {modal?.type==='contractor-detail' && <ContractorDetail contractor={modal.data} projects={projects} onEdit={c=>setModal({type:'contractor-form',data:c})} onDelete={deleteContractor} onClose={()=>setModal(null)} updateField={updateContractorField} showToast={showToast} />}
      {modal?.type==='project-form'      && <ProjectForm initial={modal.data} contractors={contractors} onSave={saveProject} onClose={()=>setModal(null)} />}
      {modal?.type==='project-detail'    && <ProjectDetail project={modal.data} contractors={contractors} onEdit={p=>setModal({type:'project-form',data:p})} onDelete={deleteProject} onClose={()=>setModal(null)} updateProjectField={updateProjectField} showToast={showToast} />}

      {toast && (
        <div style={{ position:'fixed', bottom:24, right:24, background:toast.type==='warn'?'#FEF2F2':'#F0FDF4', border:`1px solid ${toast.type==='warn'?'#FECACA':'#BBF7D0'}`, color:toast.type==='warn'?'#EF4444':'#16A34A', padding:'10px 18px', borderRadius:10, fontWeight:600, fontSize:13, zIndex:2000, boxShadow:'0 4px 20px rgba(0,0,0,0.08)', animation:'fadeUp .2s ease' }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}

function Loader() {
  return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#F5F5F7', color:'#9CA3AF', fontFamily:"'Figtree',sans-serif", fontSize:14 }}>Loading…</div>
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function DashboardView({ contractors, projects, activeProjects, totalBudget, totalSpent, avgRating, setView, setModal }) {
  const sorted = [...projects].sort((a,b) => calcPriorityScore(b) - calcPriorityScore(a))
  const topPriority = sorted.slice(0,3)
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:22, animation:'fadeUp .3s ease' }}>
      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
        {[
          { num:contractors.length, lbl:'Contractors',    color:'#3B82F6', bg:'#EFF6FF', icon:'👷' },
          { num:projects.length,    lbl:'Total Projects', color:'#8B5CF6', bg:'#F5F3FF', icon:'🏗️' },
          { num:activeProjects.length, lbl:'In Progress', color:'#F59E0B', bg:'#FFFBEB', icon:'⚡' },
          { num:avgRating+'★',      lbl:'Avg Rating',     color:'#10B981', bg:'#ECFDF5', icon:'⭐' },
        ].map(s => (
          <div key={s.lbl} style={{ ...T.card, display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ width:42, height:42, borderRadius:11, background:s.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize:24, fontWeight:700, letterSpacing:'-0.5px', lineHeight:1 }}>{s.num}</div>
              <div style={{ fontSize:12, color:'#9CA3AF', fontWeight:500, marginTop:3 }}>{s.lbl}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Budget + Priority */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <div style={T.card}>
          <div style={{ fontSize:12, fontWeight:600, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:14 }}>Budget Overview</div>
          <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:14 }}>
            <span style={{ fontSize:28, fontWeight:700, letterSpacing:'-1px' }}>{fmtCurrency(totalSpent)}</span>
            <span style={{ color:'#9CA3AF', fontSize:14 }}>of {fmtCurrency(totalBudget)}</span>
          </div>
          <div style={{ height:5, background:'#F3F4F6', borderRadius:3, overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${totalBudget?Math.min(100,(totalSpent/totalBudget)*100):0}%`, background:'#1D1D1F', borderRadius:3, transition:'width .6s ease' }} />
          </div>
          <div style={{ marginTop:7, fontSize:12, color:'#9CA3AF' }}>{totalBudget?Math.round((totalSpent/totalBudget)*100):0}% of total budget used</div>
        </div>
        <div style={T.card}>
          <div style={{ fontSize:12, fontWeight:600, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:14 }}>🔥 Top Priority Projects</div>
          {topPriority.length===0 ? <div style={{ fontSize:13, color:'#9CA3AF' }}>No projects yet</div> : topPriority.map((p,i) => {
            const score = calcPriorityScore(p)
            const lbl = priorityLabel(score)
            return (
              <div key={p.id} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:i<topPriority.length-1?10:0 }}>
                <span style={{ fontSize:13, fontWeight:700, color:'#D1D5DB', minWidth:16 }}>#{i+1}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</div>
                  <div style={{ fontSize:11, color:'#9CA3AF' }}>{p.property}</div>
                </div>
                <span style={T.priLabel(score)}>{lbl} · {score}/20</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Active projects */}
      <div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <h2 style={{ fontSize:15, fontWeight:700 }}>Active Projects</h2>
          <button style={T.btnSecondary} onClick={()=>setView('projects')}>View all</button>
        </div>
        {activeProjects.length===0
          ? <div style={{ ...T.card, textAlign:'center', color:'#9CA3AF', fontSize:14, padding:36 }}>No active projects</div>
          : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:12 }}>
              {activeProjects.slice(0,4).map(p=><ProjectCard key={p.id} project={p} onClick={()=>setModal({type:'project-detail',data:p})} />)}
            </div>
        }
      </div>

      {/* Contractors */}
      <div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <h2 style={{ fontSize:15, fontWeight:700 }}>Contractors</h2>
          <button style={T.btnSecondary} onClick={()=>setView('contractors')}>View all</button>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:12 }}>
          {contractors.slice(0,4).map(c=><ContractorCard key={c.id} contractor={c} onClick={()=>setModal({type:'contractor-detail',data:c})} />)}
        </div>
      </div>
    </div>
  )
}

// ─── Views ────────────────────────────────────────────────────────────────────
function ContractorsView({ contractors, allCount, search, setSearch, tradeFilter, setTradeFilter, setModal }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16, animation:'fadeUp .3s ease' }}>
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
        <input style={{ ...T.input, maxWidth:260, flex:1 }} placeholder="Search contractors…" value={search} onChange={e=>setSearch(e.target.value)} />
        <select style={{ ...T.select, width:'auto' }} value={tradeFilter} onChange={e=>setTradeFilter(e.target.value)}>
          <option value="All">All Trades</option>
          {TRADES.map(t=><option key={t}>{t}</option>)}
        </select>
        <span style={{ fontSize:12, color:'#9CA3AF' }}>{contractors.length} of {allCount}</span>
        <button style={{ ...T.btnPrimary, marginLeft:'auto' }} onClick={()=>setModal({type:'contractor-form',data:null})}>+ Add Contractor</button>
      </div>
      {contractors.length===0
        ? <div style={{ ...T.card, textAlign:'center', color:'#9CA3AF', fontSize:14, padding:48 }}>No contractors found</div>
        : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:12 }}>
            {contractors.map(c=><ContractorCard key={c.id} contractor={c} onClick={()=>setModal({type:'contractor-detail',data:c})} />)}
          </div>
      }
    </div>
  )
}

function ProjectsView({ projects, contractors, setModal }) {
  const [statusF, setStatusF] = useState('all')
  const [sortBy, setSortBy] = useState('priority')
  const filtered = projects.filter(p=>statusF==='all'||p.status===statusF)
  const sorted = [...filtered].sort((a,b) => {
    if (sortBy==='priority') return calcPriorityScore(b)-calcPriorityScore(a)
    if (sortBy==='budget')   return (b.budget||0)-(a.budget||0)
    if (sortBy==='progress') return calcProgress(b.milestones)-calcProgress(a.milestones)
    return new Date(b.created_at)-new Date(a.created_at)
  })
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16, animation:'fadeUp .3s ease' }}>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ display:'flex', gap:4, background:'#F3F4F6', borderRadius:10, padding:3 }}>
          {[['all','All'],['in-progress','In Progress'],['planning','Planning'],['completed','Completed'],['on-hold','On Hold']].map(([v,l])=>(
            <button key={v} onClick={()=>setStatusF(v)}
              style={{ padding:'5px 12px', borderRadius:8, fontSize:12, fontWeight:statusF===v?600:500, cursor:'pointer', background:statusF===v?'#fff':'transparent', color:statusF===v?'#1D1D1F':'#6B7280', boxShadow:statusF===v?'0 1px 3px rgba(0,0,0,0.08)':'none', border:'none', transition:'all .15s' }}>
              {l}
            </button>
          ))}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6, marginLeft:'auto' }}>
          <span style={{ fontSize:12, color:'#9CA3AF' }}>Sort:</span>
          <select style={{ ...T.select, width:'auto', padding:'6px 10px', fontSize:12 }} value={sortBy} onChange={e=>setSortBy(e.target.value)}>
            <option value="priority">Priority Score</option>
            <option value="budget">Budget</option>
            <option value="progress">Progress</option>
            <option value="date">Date Added</option>
          </select>
        </div>
        <button style={T.btnPrimary} onClick={()=>setModal({type:'project-form',data:null})}>+ New Project</button>
      </div>
      {sorted.length===0
        ? <div style={{ ...T.card, textAlign:'center', color:'#9CA3AF', fontSize:14, padding:48 }}>No projects</div>
        : <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {sorted.map(p=><ProjectRow key={p.id} project={p} contractors={contractors} onClick={()=>setModal({type:'project-detail',data:p})} />)}
          </div>
      }
    </div>
  )
}

// ─── Cards ────────────────────────────────────────────────────────────────────
function ContractorCard({ contractor: c, onClick }) {
  return (
    <div style={T.cardHov} onClick={onClick}
      onMouseEnter={e=>{e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,0.08)';e.currentTarget.style.borderColor='#D1D5DB'}}
      onMouseLeave={e=>{e.currentTarget.style.boxShadow='0 1px 3px rgba(0,0,0,0.04)';e.currentTarget.style.borderColor='#E5E7EB'}}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
        <div>
          <div style={{ fontWeight:700, fontSize:15, letterSpacing:'-0.3px', marginBottom:5 }}>{c.name}</div>
          <span style={T.tradePill}>{c.trade}</span>
        </div>
        <StarRating value={c.rating||0} />
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:3, marginTop:10 }}>
        {c.phone && <div style={{ fontSize:13, color:'#6B7280' }}>{c.phone}</div>}
        {c.email && <div style={{ fontSize:12, color:'#3B82F6' }}>{c.email}</div>}
        {c.referred_by && <div style={{ fontSize:12, color:'#9CA3AF' }}>Referred by {c.referred_by}</div>}
      </div>
      {c.tags?.length>0 && (
        <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginTop:10 }}>
          {c.tags.map(t=><span key={t} style={{ fontSize:10, fontWeight:600, padding:'2px 7px', borderRadius:4, background:'#ECFDF5', color:'#16A34A', textTransform:'uppercase' }}>{t}</span>)}
        </div>
      )}
    </div>
  )
}

function ProjectCard({ project: p, onClick }) {
  const pct = p.budget ? Math.round((p.spent/p.budget)*100) : 0
  const score = calcPriorityScore(p)
  const progress = calcProgress(p.milestones)
  return (
    <div style={T.cardHov} onClick={onClick}
      onMouseEnter={e=>{e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,0.08)';e.currentTarget.style.borderColor='#D1D5DB'}}
      onMouseLeave={e=>{e.currentTarget.style.boxShadow='0 1px 3px rgba(0,0,0,0.04)';e.currentTarget.style.borderColor='#E5E7EB'}}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
        <div style={{ flex:1, marginRight:10 }}>
          <div style={{ fontWeight:700, fontSize:14, letterSpacing:'-0.2px', marginBottom:3 }}>{p.name}</div>
          <div style={{ fontSize:12, color:'#9CA3AF' }}>{p.property}</div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
          <span style={T.badge(p.status)}>{STATUS_LABELS[p.status]}</span>
          {score>0 && <span style={T.priLabel(score)}>{priorityLabel(score)}</span>}
        </div>
      </div>
      {p.milestones?.length>0 && (
        <div style={{ marginBottom:10 }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#9CA3AF', marginBottom:4 }}>
            <span>Progress</span><span>{progress}%</span>
          </div>
          <div style={{ height:4, background:'#F3F4F6', borderRadius:2, overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${progress}%`, background:'#10B981', borderRadius:2 }} />
          </div>
        </div>
      )}
      <div style={{ height:4, background:'#F3F4F6', borderRadius:2, overflow:'hidden', marginBottom:6 }}>
        <div style={{ height:'100%', width:`${Math.min(100,pct)}%`, background:pct>100?'#EF4444':'#1D1D1F', borderRadius:2 }} />
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#9CA3AF' }}>
        <span>{fmtCurrency(p.spent)} spent</span><span>{fmtCurrency(p.budget)} budget</span>
      </div>
      {(p.bids||[]).length>0 && (
        <div style={{ marginTop:10, fontSize:11, color:'#9CA3AF' }}>
          {(p.bids||[]).length} bid{p.bids.length!==1?'s':''} · {(p.bids||[]).filter(b=>b.status==='pending').length} pending
        </div>
      )}
    </div>
  )
}

function ProjectRow({ project: p, contractors, onClick }) {
  const pct = p.budget ? Math.round((p.spent/p.budget)*100) : 0
  const score = calcPriorityScore(p)
  const progress = calcProgress(p.milestones)
  const pendingBids = (p.bids||[]).filter(b=>b.status==='pending').length
  return (
    <div style={{ ...T.cardHov, display:'flex', alignItems:'center', gap:16, padding:'13px 18px' }} onClick={onClick}
      onMouseEnter={e=>{e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,0.08)';e.currentTarget.style.borderColor='#D1D5DB'}}
      onMouseLeave={e=>{e.currentTarget.style.boxShadow='0 1px 3px rgba(0,0,0,0.04)';e.currentTarget.style.borderColor='#E5E7EB'}}>
      <div style={{ width:7, height:7, borderRadius:2, background:STATUS_COLORS[p.status], flexShrink:0 }} />
      <div style={{ flex:2, minWidth:0 }}>
        <div style={{ fontWeight:600, fontSize:14, marginBottom:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</div>
        <div style={{ fontSize:12, color:'#9CA3AF' }}>{p.property}</div>
      </div>
      <span style={{ ...T.badge(p.status), flexShrink:0 }}>{STATUS_LABELS[p.status]}</span>
      {score>0 && <span style={{ ...T.priLabel(score), flexShrink:0, textTransform:'capitalize' }}>{priorityLabel(score)}</span>}
      {p.milestones?.length>0 && (
        <div style={{ width:80 }}>
          <div style={{ fontSize:11, color:'#9CA3AF', marginBottom:3, textAlign:'right' }}>{progress}%</div>
          <div style={{ height:3, background:'#F3F4F6', borderRadius:2 }}>
            <div style={{ height:'100%', width:`${progress}%`, background:'#10B981', borderRadius:2 }} />
          </div>
        </div>
      )}
      <div style={{ flex:1, textAlign:'right' }}>
        <div style={{ fontSize:13, fontWeight:600 }}>{fmtCurrency(p.spent)}<span style={{ color:'#9CA3AF', fontWeight:400 }}> / {fmtCurrency(p.budget)}</span></div>
        <div style={{ height:3, background:'#F3F4F6', borderRadius:2, marginTop:4 }}>
          <div style={{ height:'100%', width:`${Math.min(100,pct)}%`, background:'#1D1D1F', borderRadius:2 }} />
        </div>
      </div>
      {pendingBids>0 && <div style={{ fontSize:11, color:'#F59E0B', whiteSpace:'nowrap', fontWeight:600 }}>{pendingBids} bid{pendingBids!==1?'s':''}</div>}
    </div>
  )
}

// ─── Project Detail (full) ────────────────────────────────────────────────────
function ProjectDetail({ project: initP, contractors, onEdit, onDelete, onClose, updateProjectField, showToast }) {
  const [p, setP] = useState({ ...initP, milestones:initP.milestones||[], bids:initP.bids||[], activity_log:initP.activity_log||[], priority_scores:initP.priority_scores||{urgency:1,safety:1,cost_impact:1,time_sensitivity:1} })
  const [tab, setTab] = useState('progress')
  const [newTask, setNewTask] = useState('')
  const [logNote, setLogNote] = useState('')
  const [newBid, setNewBid] = useState({ contractor_id:'', amount:'', notes:'', documents:[] })
  const [showAddBid, setShowAddBid] = useState(false)

  const pct = p.budget ? Math.round((p.spent/p.budget)*100) : 0
  const progress = calcProgress(p.milestones)
  const score = calcPriorityScore(p)
  const projectContractors = contractors.filter(c=>p.contractors?.includes(c.id))

  const save = async (fields) => {
    const data = await updateProjectField(p.id, fields)
    if (data) setP(prev => ({ ...prev, ...data }))
    return data
  }

  // Tasks
  const saveTasks = async (tasks) => { await save({tasks}) }
  const addTask   = async () => { if (!newTask.trim()) return; await saveTasks([...(p.tasks||[]),{id:uid(),text:newTask.trim(),done:false}]); setNewTask('') }
  const toggleTask = id => saveTasks((p.tasks||[]).map(t=>t.id===id?{...t,done:!t.done}:t))
  const removeTask = id => saveTasks((p.tasks||[]).filter(t=>t.id!==id))

  // Milestones
  const updateMilestoneProgress = async (id, val) => {
    const milestones = p.milestones.map(m => m.id===id ? {...m, progress:val} : m)
    const data = await save({milestones})
    if (data) setP(prev => ({ ...prev, milestones }))
    addLogEntry(`Milestone updated`)
  }
  const addMilestone = async () => {
    const name = prompt('Milestone name (e.g. Demo, Rough-in, Finish Work)')
    if (!name) return
    const weightStr = prompt('Weight % (all milestones should add up to 100)')
    const weight = Math.min(100, Math.max(0, parseInt(weightStr)||20))
    const milestones = [...p.milestones, { id:uid(), name, weight, progress:0 }]
    await save({milestones})
    setP(prev => ({ ...prev, milestones }))
  }
  const removeMilestone = async (id) => {
    const milestones = p.milestones.filter(m=>m.id!==id)
    await save({milestones})
    setP(prev => ({ ...prev, milestones }))
  }

  // Activity log
  const addLogEntry = async (text, type='note') => {
    if (!text?.trim()) return
    const entry = { id:uid(), text:text.trim(), type, ts: new Date().toISOString() }
    const activity_log = [entry, ...(p.activity_log||[])]
    await save({activity_log})
    setP(prev => ({ ...prev, activity_log }))
    setLogNote('')
  }

  // Bids
  const addBid = async () => {
    if (!newBid.contractor_id || !newBid.amount) return
    const contractor = contractors.find(c=>c.id===newBid.contractor_id)
    const bid = { id:uid(), contractor_id:newBid.contractor_id, contractor_name:contractor?.name||'', amount:parseFloat(newBid.amount.replace(/[^0-9.]/g,'')), notes:newBid.notes, status:'pending', created_at:new Date().toISOString(), documents:[] }
    const bids = [...(p.bids||[]), bid]
    await save({bids})
    setP(prev => ({ ...prev, bids }))
    await addLogEntry(`Bid received from ${contractor?.name} for ${fmtCurrency(bid.amount)}`, 'bid')
    setNewBid({ contractor_id:'', amount:'', notes:'' })
    setShowAddBid(false)
    showToast('Bid added')
  }
  const updateBidStatus = async (bidId, status) => {
    const bids = (p.bids||[]).map(b => b.id===bidId ? {...b,status} : b)
    // If accepting, also assign that contractor
    const bid = (p.bids||[]).find(b=>b.id===bidId)
    let contractors_update = p.contractors
    if (status==='accepted' && bid && !p.contractors.includes(bid.contractor_id)) {
      contractors_update = [...p.contractors, bid.contractor_id]
      await supabase.from('project_contractors').insert({project_id:p.id, contractor_id:bid.contractor_id})
    }
    await save({bids})
    setP(prev => ({ ...prev, bids, contractors: contractors_update }))
    await addLogEntry(`Bid from ${bid?.contractor_name} ${status}`, 'bid')
    showToast(`Bid ${status}`)
  }
  const removeBid = async (bidId) => {
    const bids = (p.bids||[]).filter(b=>b.id!==bidId)
    await save({bids})
    setP(prev => ({ ...prev, bids }))
  }

  // Priority scores
  const updatePriorityScore = async (key, val) => {
    const priority_scores = { ...p.priority_scores, [key]:val }
    await save({priority_scores})
    setP(prev => ({ ...prev, priority_scores }))
  }

  const inS = { width:'100%', background:'#F9FAFB', border:'1px solid #E5E7EB', borderRadius:8, padding:'8px 11px', color:'#1D1D1F', fontSize:13, fontFamily:"'Figtree',sans-serif" }

  return (
    <ModalShell title={null} onClose={onClose} maxWidth={680}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:700, letterSpacing:'-0.5px', marginBottom:4 }}>{p.name}</h2>
          <div style={{ fontSize:13, color:'#9CA3AF' }}>{p.property}</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <span style={T.badge(p.status)}>{STATUS_LABELS[p.status]}</span>
          {score>0 && <span style={T.priLabel(score)}>{priorityLabel(score)} · {score}/20</span>}
          <button onClick={()=>onEdit(p)} style={T.btnSecondary}>Edit</button>
          <button onClick={onClose} style={{ color:'#9CA3AF', fontSize:20, lineHeight:1, background:'none', border:'none', cursor:'pointer', padding:4 }}>✕</button>
        </div>
      </div>

      {/* Budget bar */}
      <div style={{ background:'#F9FAFB', borderRadius:10, padding:'13px 15px', marginBottom:16, border:'1px solid #F3F4F6' }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:9 }}>
          <span style={{ fontSize:11, fontWeight:600, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'0.4px' }}>Budget</span>
          <span style={{ fontSize:13, fontWeight:600, color:pct>100?'#EF4444':'#374151' }}>{fmtCurrency(p.spent)} / {fmtCurrency(p.budget)} · {pct}%</span>
        </div>
        <div style={{ height:5, background:'#E5E7EB', borderRadius:3, overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${Math.min(100,pct)}%`, background:pct>100?'#EF4444':'#1D1D1F', borderRadius:3 }} />
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:7, fontSize:11, color:'#9CA3AF' }}>
          <span>Remaining: {fmtCurrency((p.budget||0)-(p.spent||0))}</span>
          <span>{fmtDate(p.start_date)} → {fmtDate(p.end_date)}</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:'1px solid #F3F4F6', marginBottom:18 }}>
        {[['progress','Progress'],['bids',`Bids${(p.bids||[]).length>0?' ('+p.bids.length+')':''}`],['priority','Priority'],['tasks','Tasks'],['activity','Activity']].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)}
            style={{ padding:'7px 14px', fontSize:13, fontWeight:tab===k?600:500, color:tab===k?'#1D1D1F':'#9CA3AF', borderBottom:tab===k?'2px solid #1D1D1F':'2px solid transparent', background:'none', cursor:'pointer', marginBottom:'-1px', border:'none', transition:'all .15s' }}>
            {l}{tab!==k && k==='bids' && (p.bids||[]).filter(b=>b.status==='pending').length>0 && <span style={{ marginLeft:4, width:6, height:6, borderRadius:'50%', background:'#F59E0B', display:'inline-block', verticalAlign:'middle', marginBottom:1 }} />}
          </button>
        ))}
      </div>

      {/* ── PROGRESS TAB ── */}
      {tab==='progress' && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <div>
              <div style={{ fontSize:28, fontWeight:700, letterSpacing:'-1px', color:'#1D1D1F' }}>{progress}%</div>
              <div style={{ fontSize:12, color:'#9CA3AF', marginTop:2 }}>Overall project progress</div>
            </div>
            <button onClick={addMilestone} style={T.btnSecondary}>+ Add Phase</button>
          </div>
          <div style={{ height:8, background:'#F3F4F6', borderRadius:4, overflow:'hidden', marginBottom:20 }}>
            <div style={{ height:'100%', width:`${progress}%`, background:'linear-gradient(90deg,#10B981,#059669)', borderRadius:4, transition:'width .4s ease' }} />
          </div>
          {p.milestones.length===0
            ? <div style={{ textAlign:'center', color:'#9CA3AF', fontSize:13, padding:24, background:'#F9FAFB', borderRadius:10 }}>No phases yet. Add phases like "Planning", "Demo", "Rough-in", "Finish Work", "Inspection".</div>
            : p.milestones.map(m => (
                <div key={m.id} style={{ background:'#F9FAFB', borderRadius:10, padding:'12px 14px', marginBottom:10, border:'1px solid #F3F4F6' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                    <div>
                      <span style={{ fontSize:13, fontWeight:600 }}>{m.name}</span>
                      <span style={{ fontSize:11, color:'#9CA3AF', marginLeft:8 }}>{m.weight}% weight</span>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <span style={{ fontSize:13, fontWeight:700, color:'#1D1D1F', minWidth:30, textAlign:'right' }}>{m.progress}%</span>
                      <button onClick={()=>removeMilestone(m.id)} style={{ color:'#D1D5DB', fontSize:16, background:'none', border:'none', cursor:'pointer', lineHeight:1 }}>×</button>
                    </div>
                  </div>
                  <div style={{ position:'relative', height:20, display:'flex', alignItems:'center' }}>
                    <div style={{ position:'absolute', left:0, right:0, height:4, background:'#E5E7EB', borderRadius:2, overflow:'hidden', pointerEvents:'none' }}>
                      <div style={{ height:'100%', width:`${m.progress}%`, background:'#10B981', borderRadius:2, transition:'width .1s' }} />
                    </div>
                    <input type="range" min={0} max={100} value={m.progress}
                      onChange={e=>{ const milestones=p.milestones.map(x=>x.id===m.id?{...x,progress:+e.target.value}:x); setP(prev=>({...prev,milestones})) }}
                      onMouseUp={e=>updateMilestoneProgress(m.id,+e.target.value)}
                      onTouchEnd={()=>updateMilestoneProgress(m.id,m.progress)}
                      style={{ position:'absolute', left:0, right:0, width:'100%', opacity:0, cursor:'pointer', height:20, margin:0 }} />
                  </div>
                </div>
              ))
          }

          {/* Assigned contractors */}
          {projectContractors.length>0 && (
            <div style={{ marginTop:16 }}>
              <div style={T.label}>Assigned Contractors</div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {projectContractors.map(c=>(
                  <div key={c.id} style={{ background:'#F9FAFB', borderRadius:9, padding:'7px 12px', border:'1px solid #F3F4F6' }}>
                    <div style={{ fontSize:13, fontWeight:600 }}>{c.name}</div>
                    <div style={{ fontSize:11, color:'#9CA3AF' }}>{c.trade}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── BIDS TAB ── */}
      {tab==='bids' && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <div style={{ fontSize:13, color:'#6B7280' }}>
              {(p.bids||[]).length===0 ? 'No bids yet' : `${(p.bids||[]).length} bid${p.bids.length!==1?'s':''} · ${(p.bids||[]).filter(b=>b.status==='accepted').length} accepted`}
            </div>
            <button onClick={()=>setShowAddBid(!showAddBid)} style={T.btnPrimary}>+ Add Bid</button>
          </div>

          {showAddBid && (
            <div style={{ background:'#F9FAFB', borderRadius:10, padding:14, marginBottom:14, border:'1px solid #E5E7EB' }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
                <div>
                  <label style={T.label}>Contractor</label>
                  <select style={inS} value={newBid.contractor_id} onChange={e=>setNewBid(b=>({...b,contractor_id:e.target.value}))}>
                    <option value="">Select contractor…</option>
                    {contractors.map(c=><option key={c.id} value={c.id}>{c.name} ({c.trade})</option>)}
                  </select>
                </div>
                <div>
                  <label style={T.label}>Bid Amount</label>
                  <input style={inS} placeholder="$0" value={newBid.amount} onChange={e=>setNewBid(b=>({...b,amount:e.target.value}))} />
                </div>
              </div>
              <div style={{ marginBottom:10 }}>
                <label style={T.label}>Notes</label>
                <input style={inS} placeholder="Scope details, conditions, timeline…" value={newBid.notes} onChange={e=>setNewBid(b=>({...b,notes:e.target.value}))} />
              </div>
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                <button onClick={()=>setShowAddBid(false)} style={T.btnSecondary}>Cancel</button>
                <button onClick={addBid} style={T.btnPrimary}>Save Bid</button>
              </div>
            </div>
          )}

          {(p.bids||[]).length===0 && !showAddBid && (
            <div style={{ textAlign:'center', color:'#9CA3AF', fontSize:13, padding:32, background:'#F9FAFB', borderRadius:10 }}>
              No bids yet. Add bids from contractors to compare and accept the best one.
            </div>
          )}

          {[...(p.bids||[])].sort((a,b)=>(a.amount||0)-(b.amount||0)).map(bid => (
            <div key={bid.id} style={{ background:'#F9FAFB', borderRadius:10, padding:'12px 14px', marginBottom:10, border:`1px solid ${bid.status==='accepted'?'#BBF7D0':bid.status==='rejected'?'#FECACA':'#F3F4F6'}` }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:700 }}>{bid.contractor_name}</div>
                  <div style={{ fontSize:20, fontWeight:800, letterSpacing:'-0.5px', color:'#1D1D1F', marginTop:2 }}>{fmtCurrency(bid.amount)}</div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={T.bidBadge(bid.status)}>{bid.status.charAt(0).toUpperCase()+bid.status.slice(1)}</span>
                  <button onClick={()=>removeBid(bid.id)} style={{ color:'#D1D5DB', fontSize:16, background:'none', border:'none', cursor:'pointer' }}>×</button>
                </div>
              </div>
              {bid.notes && <div style={{ fontSize:12, color:'#6B7280', marginBottom:8 }}>{bid.notes}</div>}
              <div style={{ fontSize:11, color:'#9CA3AF', marginBottom:bid.status==='pending'?10:0 }}>{fmtTs(bid.created_at)}</div>
              {bid.status==='pending' && (
                <div style={{ display:'flex', gap:8, marginTop:8 }}>
                  <button onClick={()=>updateBidStatus(bid.id,'accepted')} style={{ flex:1, padding:'7px', borderRadius:8, background:'#D1FAE5', color:'#059669', fontSize:12, fontWeight:600, cursor:'pointer', border:'none' }}>✓ Accept</button>
                  <button onClick={()=>updateBidStatus(bid.id,'rejected')} style={{ flex:1, padding:'7px', borderRadius:8, background:'#FEE2E2', color:'#EF4444', fontSize:12, fontWeight:600, cursor:'pointer', border:'none' }}>✗ Reject</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── PRIORITY TAB ── */}
      {tab==='priority' && (
        <div>
          <div style={{ background:'#F9FAFB', borderRadius:10, padding:'14px 16px', marginBottom:16, border:'1px solid #F3F4F6', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ fontSize:28, fontWeight:800, letterSpacing:'-1px' }}>{score}<span style={{ fontSize:16, fontWeight:500, color:'#9CA3AF' }}>/20</span></div>
              <div style={{ fontSize:12, color:'#9CA3AF', marginTop:2 }}>Priority Score</div>
            </div>
            <span style={{ ...T.priLabel(score), fontSize:14, padding:'6px 14px' }}>{priorityLabel(score).toUpperCase()} PRIORITY</span>
          </div>
          <ScoreSlider label="Urgency" value={p.priority_scores?.urgency||1} onChange={v=>updatePriorityScore('urgency',v)} hint="How soon does this need to start?" />
          <ScoreSlider label="Safety Risk" value={p.priority_scores?.safety||1} onChange={v=>updatePriorityScore('safety',v)} hint="Risk if left unaddressed?" />
          <ScoreSlider label="Cost Impact" value={p.priority_scores?.cost_impact||1} onChange={v=>updatePriorityScore('cost_impact',v)} hint="Will delay increase cost?" />
          <ScoreSlider label="Time Sensitivity" value={p.priority_scores?.time_sensitivity||1} onChange={v=>updatePriorityScore('time_sensitivity',v)} hint="Weather, permits, contractor availability?" />
          <div style={{ background:'#FFFBEB', borderRadius:9, padding:'10px 14px', border:'1px solid #FDE68A', fontSize:12, color:'#92400E' }}>
            💡 Projects are automatically sorted by priority score in the Projects view.
          </div>
        </div>
      )}

      {/* ── TASKS TAB ── */}
      {tab==='tasks' && (
        <div>
          <div style={{ display:'flex', gap:8, marginBottom:10 }}>
            <input style={{ ...T.input, fontSize:13 }} placeholder="Add a task…" value={newTask} onChange={e=>setNewTask(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addTask()} />
            <button onClick={addTask} style={T.btnSecondary}>Add</button>
          </div>
          {(p.tasks||[]).length===0
            ? <div style={{ textAlign:'center', color:'#9CA3AF', fontSize:13, padding:24, background:'#F9FAFB', borderRadius:10 }}>No tasks yet</div>
            : (p.tasks||[]).map(t => (
                <div key={t.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 11px', background:'#F9FAFB', borderRadius:8, marginBottom:5, border:'1px solid #F3F4F6' }}>
                  <div onClick={()=>toggleTask(t.id)} style={{ width:17, height:17, borderRadius:5, border:t.done?'none':'1.5px solid #D1D5DB', background:t.done?'#1D1D1F':'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, cursor:'pointer', transition:'all .15s' }}>
                    {t.done&&<span style={{ fontSize:9, color:'#fff', fontWeight:800 }}>✓</span>}
                  </div>
                  <span onClick={()=>toggleTask(t.id)} style={{ flex:1, fontSize:13, color:t.done?'#9CA3AF':'#1D1D1F', textDecoration:t.done?'line-through':'none', cursor:'pointer' }}>{t.text}</span>
                  <button onClick={()=>removeTask(t.id)} style={{ color:'#D1D5DB', fontSize:16, background:'none', border:'none', cursor:'pointer' }}>×</button>
                </div>
              ))
          }
          <div style={{ marginTop:8, fontSize:12, color:'#9CA3AF' }}>
            {(p.tasks||[]).filter(t=>t.done).length} of {(p.tasks||[]).length} tasks complete
          </div>
        </div>
      )}

      {/* ── ACTIVITY TAB ── */}
      {tab==='activity' && (
        <div>
          <div style={{ display:'flex', gap:8, marginBottom:16 }}>
            <input style={{ ...T.input, flex:1, fontSize:13 }} placeholder="Add a note…" value={logNote} onChange={e=>setLogNote(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addLogEntry(logNote)} />
            <button onClick={()=>addLogEntry(logNote)} style={T.btnPrimary}>Log</button>
          </div>
          {(p.activity_log||[]).length===0
            ? <div style={{ textAlign:'center', color:'#9CA3AF', fontSize:13, padding:32, background:'#F9FAFB', borderRadius:10 }}>No activity yet</div>
            : (p.activity_log||[]).map(entry => (
                <div key={entry.id} style={{ display:'flex', gap:12, marginBottom:12 }}>
                  <div style={{ width:28, height:28, borderRadius:8, background:entry.type==='bid'?'#DBEAFE':entry.type==='status'?'#D1FAE5':'#F3F4F6', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, flexShrink:0, marginTop:1 }}>
                    {entry.type==='bid'?'💰':entry.type==='status'?'📋':'📝'}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, color:'#1D1D1F', lineHeight:1.5 }}>{entry.text}</div>
                    <div style={{ fontSize:11, color:'#9CA3AF', marginTop:2 }}>{fmtTs(entry.ts)}</div>
                  </div>
                </div>
              ))
          }
        </div>
      )}

      <div style={{ display:'flex', justifyContent:'flex-end', paddingTop:12, borderTop:'1px solid #F3F4F6', marginTop:16 }}>
        <button onClick={()=>{if(window.confirm('Delete this project?'))onDelete(p.id)}} style={T.btnDanger}>Delete project</button>
      </div>
    </ModalShell>
  )
}

// ─── Contractor Form ──────────────────────────────────────────────────────────
const DRAFT_KEY = 'contractorFormDraft'
function ContractorForm({ initial, onSave, onClose }) {
  const isNew = !initial?.id
  const norm = c => c ? {...c, referredBy:c.referred_by||c.referredBy||'', tags:c.tags||[], documents:c.documents||[], emails:c.emails||[]} : null
  const blank = { id:null, name:'', trade:'Electrical', phone:'', email:'', website:'', rating:0, referredBy:'', notes:'', tags:[], documents:[], emails:[] }
  const getInitial = () => {
    if (!isNew) return norm(initial)
    try { const saved = localStorage.getItem(DRAFT_KEY); return saved ? JSON.parse(saved) : blank } catch { return blank }
  }
  const [form, setForm] = useState(getInitial)
  const [tagInput, setTagInput] = useState('')
  const set = (k,v) => setForm(f => {
    const next = {...f,[k]:v}
    if (isNew) { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(next)) } catch {} }
    return next
  })
  const clearDraft = () => { try { localStorage.removeItem(DRAFT_KEY) } catch {} }
  const addTag = () => { if (tagInput.trim()&&!form.tags.includes(tagInput.trim())) { set('tags',[...form.tags,tagInput.trim()]); setTagInput('') } }

  return (
    <ModalShell title={`${form.id?'Edit':'Add'} Contractor`} onClose={onClose}>
      <Row2>
        <Field label="Name *"><input style={T.input} value={form.name} onChange={e=>set('name',e.target.value)} placeholder="Company or person name" /></Field>
        <Field label="Trade"><select style={T.select} value={form.trade} onChange={e=>set('trade',e.target.value)}>{TRADES.map(t=><option key={t}>{t}</option>)}</select></Field>
      </Row2>
      <Row2>
        <Field label="Phone"><input style={T.input} value={form.phone} onChange={e=>set('phone',e.target.value)} placeholder="(555) 000-0000" /></Field>
        <Field label="Email"><input style={T.input} value={form.email} onChange={e=>set('email',e.target.value)} placeholder="email@example.com" /></Field>
      </Row2>
      <Row2>
        <Field label="Website"><input style={T.input} value={form.website} onChange={e=>set('website',e.target.value)} placeholder="example.com" /></Field>
        <Field label="Referred By"><input style={T.input} value={form.referredBy} onChange={e=>set('referredBy',e.target.value)} placeholder="Who referred them?" /></Field>
      </Row2>
      <div style={{ marginBottom:14 }}>
        <label style={T.label}>Rating</label>
        <StarRating value={form.rating} onChange={v=>set('rating',v)} />
      </div>
      <div style={{ marginBottom:14 }}>
        <label style={T.label}>Tags</label>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
          {form.tags.map(t=>(
            <span key={t} style={{ fontSize:11, padding:'3px 9px', background:'#F3F4F6', borderRadius:5, color:'#374151', display:'flex', alignItems:'center', gap:5, fontWeight:500 }}>
              {t}<span onClick={()=>set('tags',form.tags.filter(x=>x!==t))} style={{ cursor:'pointer', color:'#9CA3AF' }}>×</span>
            </span>
          ))}
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <input style={{ ...T.input, flex:1 }} value={tagInput} onChange={e=>setTagInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addTag()} placeholder="licensed, bonded, insured…" />
          <button onClick={addTag} style={T.btnSecondary}>Add</button>
        </div>
      </div>
      <div style={{ marginBottom:20 }}>
        <label style={T.label}>Notes</label>
        <textarea style={T.textarea} value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Notes about this contractor…" />
      </div>
      <ModalFooter onClose={()=>{clearDraft();onClose()}} onSave={()=>{if(form.name.trim()){clearDraft();onSave(form)}}} label="Save Contractor" />
    </ModalShell>
  )
}

// ─── Contractor Detail ────────────────────────────────────────────────────────
function ContractorDetail({ contractor: initC, projects, onEdit, onDelete, onClose, updateField, showToast }) {
  const [c, setC] = useState(initC)
  const [tab, setTab] = useState('info')
  const [newEmail, setNewEmail] = useState({ subject:'', date:'', summary:'' })
  const [newDoc, setNewDoc] = useState({ name:'', type:'Quote', date:'', amount:'' })
  const [showAddEmail, setShowAddEmail] = useState(false)
  const [showAddDoc, setShowAddDoc] = useState(false)
  const relatedProjects = projects.filter(p=>p.contractors?.includes(c.id))

  const addDoc = async () => {
    if (!newDoc.name) return
    const data = await updateField(c.id,'documents',[...(c.documents||[]),{id:uid(),...newDoc}])
    if (data) { setC(data); setNewDoc({name:'',type:'Quote',date:'',amount:''}); setShowAddDoc(false); showToast('Document linked') }
  }
  const removeDoc = async (id) => {
    const data = await updateField(c.id,'documents',(c.documents||[]).filter(d=>d.id!==id))
    if (data) { setC(data); showToast('Removed','warn') }
  }
  const addEmail = async () => {
    if (!newEmail.subject) return
    const data = await updateField(c.id,'emails',[...(c.emails||[]),{id:uid(),...newEmail}])
    if (data) { setC(data); setNewEmail({subject:'',date:'',summary:''}); setShowAddEmail(false); showToast('Email logged') }
  }
  const removeEmail = async (id) => {
    const data = await updateField(c.id,'emails',(c.emails||[]).filter(e=>e.id!==id))
    if (data) { setC(data); showToast('Removed','warn') }
  }

  const inS = { width:'100%', background:'#F9FAFB', border:'1px solid #E5E7EB', borderRadius:8, padding:'8px 11px', color:'#1D1D1F', fontSize:13, fontFamily:"'Figtree',sans-serif" }

  return (
    <ModalShell title={null} onClose={onClose} maxWidth={620}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:4 }}>
        <div>
          <h2 style={{ fontSize:21, fontWeight:700, letterSpacing:'-0.5px', marginBottom:6 }}>{c.name}</h2>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={T.tradePill}>{c.trade}</span>
            <StarRating value={c.rating||0} />
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={()=>onEdit(c)} style={T.btnSecondary}>Edit</button>
          <button onClick={onClose} style={{ color:'#9CA3AF', fontSize:20, lineHeight:1, background:'none', border:'none', cursor:'pointer', padding:4 }}>✕</button>
        </div>
      </div>

      <div style={{ display:'flex', borderBottom:'1px solid #F3F4F6', marginTop:18, marginBottom:18 }}>
        {[['info','Info'],['documents',`Documents${(c.documents||[]).length>0?' ('+c.documents.length+')':''}`],['emails',`Emails${(c.emails||[]).length>0?' ('+c.emails.length+')':''}`],['projects',`Projects${relatedProjects.length>0?' ('+relatedProjects.length+')':''}`]].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)}
            style={{ padding:'7px 14px', fontSize:13, fontWeight:tab===k?600:500, color:tab===k?'#1D1D1F':'#9CA3AF', borderBottom:tab===k?'2px solid #1D1D1F':'2px solid transparent', background:'none', cursor:'pointer', marginBottom:'-1px', border:'none', transition:'all .15s' }}>
            {l}
          </button>
        ))}
      </div>

      {tab==='info' && (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:9 }}>
            {[['Phone',c.phone],['Email',c.email],['Website',c.website],['Referred By',c.referred_by||c.referredBy]].map(([lbl,val])=>val?(
              <div key={lbl} style={{ background:'#F9FAFB', borderRadius:9, padding:'9px 13px', border:'1px solid #F3F4F6' }}>
                <div style={{ fontSize:10, color:'#9CA3AF', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:3 }}>{lbl}</div>
                <div style={{ fontSize:13, color:'#1D1D1F', fontWeight:500 }}>{val}</div>
              </div>
            ):null)}
          </div>
          {c.tags?.length>0 && (
            <div>
              <div style={T.label}>Tags</div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {c.tags.map(t=><span key={t} style={{ fontSize:11, padding:'3px 9px', background:'#ECFDF5', border:'1px solid #BBF7D0', borderRadius:5, color:'#16A34A', fontWeight:600 }}>{t}</span>)}
              </div>
            </div>
          )}
          {c.notes && <div><div style={T.label}>Notes</div><div style={{ background:'#F9FAFB', borderRadius:9, padding:'11px 13px', fontSize:13, color:'#374151', lineHeight:1.6, border:'1px solid #F3F4F6' }}>{c.notes}</div></div>}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop:10, borderTop:'1px solid #F3F4F6', marginTop:2 }}>
            <span style={{ fontSize:11, color:'#D1D5DB' }}>Added {fmtDate(c.created_at)}</span>
            <button onClick={()=>{if(window.confirm('Delete this contractor?'))onDelete(c.id)}} style={T.btnDanger}>Delete contractor</button>
          </div>
        </div>
      )}

      {tab==='documents' && (
        <div>
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:12 }}>
            <button onClick={()=>setShowAddDoc(!showAddDoc)} style={T.btnPrimary}>+ Link Document</button>
          </div>
          {showAddDoc && (
            <div style={{ background:'#F9FAFB', borderRadius:10, padding:14, marginBottom:12, border:'1px solid #E5E7EB' }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
                <input style={inS} placeholder="Name / description" value={newDoc.name} onChange={e=>setNewDoc(d=>({...d,name:e.target.value}))} />
                <select style={inS} value={newDoc.type} onChange={e=>setNewDoc(d=>({...d,type:e.target.value}))}>{DOC_TYPES.map(t=><option key={t}>{t}</option>)}</select>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
                <input style={inS} type="date" value={newDoc.date} onChange={e=>setNewDoc(d=>({...d,date:e.target.value}))} />
                <input style={inS} placeholder="Amount" value={newDoc.amount} onChange={e=>setNewDoc(d=>({...d,amount:e.target.value}))} />
              </div>
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                <button onClick={()=>setShowAddDoc(false)} style={T.btnSecondary}>Cancel</button>
                <button onClick={addDoc} style={T.btnPrimary}>Add</button>
              </div>
            </div>
          )}
          {(c.documents||[]).length===0 ? <div style={{ textAlign:'center', color:'#9CA3AF', fontSize:13, padding:32 }}>No documents linked yet</div>
            : (c.documents||[]).map(doc=>(
                <div key={doc.id} style={{ display:'flex', alignItems:'center', gap:11, background:'#F9FAFB', borderRadius:9, padding:'10px 13px', marginBottom:7, border:'1px solid #F3F4F6' }}>
                  <span style={{ fontSize:18 }}>{DOC_ICONS[doc.type]||'📎'}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:600 }}>{doc.name}</div>
                    <div style={{ fontSize:11, color:'#9CA3AF' }}>{doc.type}{doc.date?' · '+fmtDate(doc.date):''}{doc.amount?' · '+doc.amount:''}</div>
                  </div>
                  <button onClick={()=>removeDoc(doc.id)} style={{ color:'#D1D5DB', fontSize:18, background:'none', border:'none', cursor:'pointer' }}>×</button>
                </div>
              ))
          }
        </div>
      )}

      {tab==='emails' && (
        <div>
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:12 }}>
            <button onClick={()=>setShowAddEmail(!showAddEmail)} style={T.btnPrimary}>+ Log Email</button>
          </div>
          {showAddEmail && (
            <div style={{ background:'#F9FAFB', borderRadius:10, padding:14, marginBottom:12, border:'1px solid #E5E7EB', display:'flex', flexDirection:'column', gap:8 }}>
              <input style={inS} placeholder="Subject" value={newEmail.subject} onChange={e=>setNewEmail(n=>({...n,subject:e.target.value}))} />
              <input style={inS} type="date" value={newEmail.date} onChange={e=>setNewEmail(n=>({...n,date:e.target.value}))} />
              <input style={inS} placeholder="Summary / notes" value={newEmail.summary} onChange={e=>setNewEmail(n=>({...n,summary:e.target.value}))} />
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                <button onClick={()=>setShowAddEmail(false)} style={T.btnSecondary}>Cancel</button>
                <button onClick={addEmail} style={T.btnPrimary}>Log</button>
              </div>
            </div>
          )}
          {(c.emails||[]).length===0 ? <div style={{ textAlign:'center', color:'#9CA3AF', fontSize:13, padding:32 }}>No emails logged yet</div>
            : (c.emails||[]).map(em=>(
                <div key={em.id} style={{ display:'flex', alignItems:'center', gap:11, background:'#F9FAFB', borderRadius:9, padding:'10px 13px', marginBottom:7, border:'1px solid #F3F4F6' }}>
                  <span style={{ fontSize:18 }}>✉️</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:600 }}>{em.subject}</div>
                    <div style={{ fontSize:11, color:'#9CA3AF' }}>{em.date?fmtDate(em.date):''}{em.summary?' — '+em.summary:''}</div>
                  </div>
                  <button onClick={()=>removeEmail(em.id)} style={{ color:'#D1D5DB', fontSize:18, background:'none', border:'none', cursor:'pointer' }}>×</button>
                </div>
              ))
          }
        </div>
      )}

      {tab==='projects' && (
        relatedProjects.length===0 ? <div style={{ textAlign:'center', color:'#9CA3AF', fontSize:13, padding:32 }}>Not assigned to any projects yet</div>
          : relatedProjects.map(p=>(
              <div key={p.id} style={{ display:'flex', alignItems:'center', gap:12, background:'#F9FAFB', borderRadius:9, padding:'10px 13px', marginBottom:7, border:'1px solid #F3F4F6' }}>
                <div style={{ width:7, height:7, borderRadius:2, background:STATUS_COLORS[p.status], flexShrink:0 }} />
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:600 }}>{p.name}</div>
                  <div style={{ fontSize:11, color:'#9CA3AF' }}>{p.property}</div>
                </div>
                <span style={T.badge(p.status)}>{STATUS_LABELS[p.status]}</span>
                <span style={{ fontSize:12, color:'#9CA3AF' }}>{fmtCurrency(p.budget)}</span>
              </div>
            ))
      )}
    </ModalShell>
  )
}

// ─── Project Form ─────────────────────────────────────────────────────────────
function ProjectForm({ initial, contractors, onSave, onClose }) {
  const norm = p => p ? {...p, startDate:p.start_date||p.startDate||'', endDate:p.end_date||p.endDate||'', contractors:p.contractors||[], tasks:p.tasks||[], milestones:p.milestones||[], bids:p.bids||[], activity_log:p.activity_log||[], priority_scores:p.priority_scores||{}} : null
  const blank = { id:null, name:'', property:'', status:'planning', startDate:'', endDate:'', budget:0, spent:0, contractors:[], description:'', tasks:[], milestones:[], bids:[], activity_log:[], priority_scores:{}, notes:'' }
  const [form, setForm] = useState(norm(initial)||blank)
  const set = (k,v) => setForm(f=>({...f,[k]:v}))
  const toggleC = id => set('contractors', form.contractors.includes(id)?form.contractors.filter(c=>c!==id):[...form.contractors,id])

  return (
    <ModalShell title={`${form.id?'Edit':'New'} Project`} onClose={onClose}>
      <div style={{ marginBottom:14 }}>
        <label style={T.label}>Project Name *</label>
        <input style={T.input} value={form.name} onChange={e=>set('name',e.target.value)} placeholder="e.g. Kitchen Remodel — Oak St" />
      </div>
      <Row2>
        <Field label="Property"><input style={T.input} value={form.property} onChange={e=>set('property',e.target.value)} placeholder="123 Oak St" /></Field>
        <Field label="Status"><select style={T.select} value={form.status} onChange={e=>set('status',e.target.value)}>{Object.entries(STATUS_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></Field>
      </Row2>
      <Row2>
        <Field label="Start Date"><input style={T.input} type="date" value={form.startDate} onChange={e=>set('startDate',e.target.value)} /></Field>
        <Field label="End Date"><input style={T.input} type="date" value={form.endDate} onChange={e=>set('endDate',e.target.value)} /></Field>
      </Row2>
      <Row2>
        <Field label="Budget ($)"><input style={T.input} type="number" value={form.budget} onChange={e=>set('budget',+e.target.value)} /></Field>
        <Field label="Spent ($)"><input style={T.input} type="number" value={form.spent} onChange={e=>set('spent',+e.target.value)} /></Field>
      </Row2>
      <div style={{ marginBottom:14 }}>
        <label style={T.label}>Assign Contractors</label>
        <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
          {contractors.map(c=>(
            <div key={c.id} onClick={()=>toggleC(c.id)}
              style={{ padding:'6px 13px', borderRadius:8, cursor:'pointer', background:form.contractors.includes(c.id)?'#1D1D1F':'#F3F4F6', color:form.contractors.includes(c.id)?'#fff':'#6B7280', fontSize:12, fontWeight:500, transition:'all .15s', userSelect:'none' }}>
              {form.contractors.includes(c.id)?'✓ ':''}{c.name}
            </div>
          ))}
          {contractors.length===0&&<div style={{ fontSize:12, color:'#9CA3AF' }}>No contractors added yet</div>}
        </div>
      </div>
      <div style={{ marginBottom:14 }}>
        <label style={T.label}>Description</label>
        <textarea style={T.textarea} value={form.description} onChange={e=>set('description',e.target.value)} placeholder="Brief project description…" />
      </div>
      <div style={{ marginBottom:20 }}>
        <label style={T.label}>Notes</label>
        <textarea style={T.textarea} value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Additional notes…" />
      </div>
      <ModalFooter onClose={onClose} onSave={()=>{if(form.name.trim())onSave(form)}} label="Save Project" />
    </ModalShell>
  )
}

// ─── Shared Primitives ────────────────────────────────────────────────────────
function ModalShell({ title, onClose, children, maxWidth=560 }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.25)', backdropFilter:'blur(8px)', WebkitBackdropFilter:'blur(8px)', display:'flex', alignItems:'flex-start', justifyContent:'center', zIndex:1000, overflowY:'auto', padding:'40px 16px', animation:'fadeIn .15s ease' }}>
      <div style={{ background:'#fff', borderRadius:16, width:'100%', maxWidth, padding:28, boxShadow:'0 20px 60px rgba(0,0,0,0.1)', animation:'fadeUp .2s ease' }}>
        {title && (
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
            <h2 style={{ fontSize:17, fontWeight:700, letterSpacing:'-0.3px' }}>{title}</h2>
            <button onClick={onClose} style={{ color:'#9CA3AF', fontSize:20, lineHeight:1, background:'none', border:'none', cursor:'pointer', padding:4 }}>✕</button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
function Row2({ children }) { return <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>{children}</div> }
function Field({ label, children }) { return <div><label style={T.label}>{label}</label>{children}</div> }
function ModalFooter({ onClose, onSave, label }) {
  return (
    <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
      <button onClick={onClose} style={T.btnSecondary}>Cancel</button>
      <button onClick={onSave} style={T.btnPrimary}>{label}</button>
    </div>
  )
}
