import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import AuthPage from './AuthPage'

// ─── Constants ────────────────────────────────────────────────────────────────
const TRADES = ['Electrical','Plumbing','HVAC','Roofing','Carpentry','Painting','Landscaping','Flooring','Concrete','Drywall','Masonry','General Contractor','Other']
const STATUS_COLORS = { 'in-progress': '#f59e0b', 'completed': '#10b981', 'planning': '#6366f1', 'on-hold': '#ef4444' }
const STATUS_LABELS = { 'in-progress': 'In Progress', 'completed': 'Completed', 'planning': 'Planning', 'on-hold': 'On Hold' }
const DOC_TYPES = ['Quote','Invoice','Contract','Permit','Receipt','Photo','Other']
const DOC_ICONS = { Quote:'📄', Invoice:'🧾', Contract:'📝', Permit:'🏛️', Receipt:'🧾', Photo:'📸', Other:'📎' }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2,10) }
function fmtCurrency(n) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n||0) }
function fmtDate(d) { if (!d) return '—'; return new Date(d+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) }

function StarRating({ value, onChange }) {
  const [hov, setHov] = useState(0)
  return (
    <div style={{display:'flex',gap:2}}>
      {[1,2,3,4,5].map(s => (
        <span key={s}
          onClick={()=>onChange&&onChange(s)}
          onMouseEnter={()=>onChange&&setHov(s)}
          onMouseLeave={()=>setHov(0)}
          style={{cursor:onChange?'pointer':'default',fontSize:18,color:(hov||value)>=s?'#f59e0b':'#374151',transition:'color .1s',userSelect:'none'}}>★</span>
      ))}
    </div>
  )
}

// ─── Global Styles ────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin:0; padding:0; }
  body { background:#0a0e1a; }
  ::-webkit-scrollbar { width:6px; height:6px; }
  ::-webkit-scrollbar-track { background:transparent; }
  ::-webkit-scrollbar-thumb { background:#1e2535; border-radius:3px; }
  input, textarea, select { outline:none; border:none; background:transparent; }
  button { cursor:pointer; border:none; background:none; }
`

// ─── Shared style tokens ──────────────────────────────────────────────────────
const T = {
  card: { background:'#0d1221', border:'1px solid #1a2035', borderRadius:12, padding:20 },
  cardHov: { background:'#0d1221', border:'1px solid #1e2a45', borderRadius:12, padding:20, cursor:'pointer', transition:'border-color .2s' },
  badge: (color) => ({ display:'inline-flex',alignItems:'center',padding:'2px 8px',borderRadius:4,fontSize:11,fontWeight:700,letterSpacing:'0.4px',textTransform:'uppercase',background:color+'22',color,border:`1px solid ${color}44` }),
  tradeBadge: { display:'inline-flex',alignItems:'center',padding:'2px 10px',borderRadius:20,fontSize:11,fontWeight:600,background:'#1e2a45',color:'#7c9cbf',border:'1px solid #253450' },
  btnPrimary: { display:'inline-flex',alignItems:'center',gap:6,padding:'8px 18px',borderRadius:8,background:'#3b82f6',color:'#fff',fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:700,cursor:'pointer' },
  btnSecondary: { display:'inline-flex',alignItems:'center',gap:6,padding:'8px 16px',borderRadius:8,background:'#1a2035',color:'#94a3b8',fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:600,cursor:'pointer',border:'1px solid #253450' },
  label: { fontSize:11,fontWeight:700,color:'#64748b',letterSpacing:'0.5px',textTransform:'uppercase',marginBottom:6,display:'block',fontFamily:"'DM Mono',monospace" },
  input: { width:'100%',background:'#111827',border:'1px solid #1e2a45',borderRadius:8,padding:'9px 12px',color:'#e2e8f0',fontSize:14,fontFamily:"'Syne',sans-serif" },
  select: { width:'100%',background:'#111827',border:'1px solid #1e2a45',borderRadius:8,padding:'9px 12px',color:'#e2e8f0',fontSize:14,fontFamily:"'Syne',sans-serif" },
  textarea: { width:'100%',background:'#111827',border:'1px solid #1e2a45',borderRadius:8,padding:'9px 12px',color:'#e2e8f0',fontSize:14,fontFamily:"'Syne',sans-serif",resize:'vertical',minHeight:70 },
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState(undefined) // undefined = loading
  const [contractors, setContractors] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('dashboard')
  const [modal, setModal] = useState(null)
  const [search, setSearch] = useState('')
  const [tradeFilter, setTradeFilter] = useState('All')
  const [toast, setToast] = useState(null)

  // ── Auth listener ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setSession(session))
    return () => subscription.unsubscribe()
  }, [])

  // ── Load data when session is ready ──
  useEffect(() => {
    if (session) {
      loadAll()
    } else if (session === null) {
      setLoading(false)
    }
  }, [session])

  async function loadAll() {
    setLoading(true)
    const [{ data: c }, { data: p }] = await Promise.all([
      supabase.from('contractors').select('*').order('created_at', { ascending: false }),
      supabase.from('projects').select('*, project_contractors(contractor_id)').order('created_at', { ascending: false }),
    ])
    setContractors(c || [])
    setProjects((p || []).map(proj => ({
      ...proj,
      contractors: (proj.project_contractors || []).map(pc => pc.contractor_id),
    })))
    setLoading(false)
  }

  const showToast = useCallback((msg, type='success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2800)
  }, [])

  // ── Auth states ──
  if (session === undefined) return <Loader />
  if (session === null) return <AuthPage />
  if (loading) return <Loader />

  // ── Derived ──
  const filteredContractors = contractors.filter(c => {
    const q = search.toLowerCase()
    return (!q || c.name?.toLowerCase().includes(q) || c.trade?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q))
      && (tradeFilter === 'All' || c.trade === tradeFilter)
  })

  // ── Contractor CRUD ──
  async function saveContractor(data) {
    const { id, contractors: _c, ...rest } = data
    const payload = {
      name: rest.name, trade: rest.trade, phone: rest.phone, email: rest.email,
      website: rest.website, rating: rest.rating, referred_by: rest.referredBy || rest.referred_by,
      notes: rest.notes, tags: rest.tags || [], documents: rest.documents || [], emails: rest.emails || [],
      user_id: session.user.id,
    }
    if (id) {
      const { data: updated, error } = await supabase.from('contractors').update(payload).eq('id', id).select().single()
      if (error) return showToast('Error saving: ' + error.message, 'warn')
      setContractors(cs => cs.map(c => c.id === id ? updated : c))
      showToast('Contractor updated')
    } else {
      const { data: created, error } = await supabase.from('contractors').insert(payload).select().single()
      if (error) return showToast('Error saving: ' + error.message, 'warn')
      setContractors(cs => [created, ...cs])
      showToast('Contractor added')
    }
    setModal(null)
  }

  async function deleteContractor(id) {
    const { error } = await supabase.from('contractors').delete().eq('id', id)
    if (error) return showToast('Error deleting: ' + error.message, 'warn')
    setContractors(cs => cs.filter(c => c.id !== id))
    setProjects(ps => ps.map(p => ({ ...p, contractors: p.contractors.filter(cid => cid !== id) })))
    showToast('Contractor deleted', 'warn')
    setModal(null)
  }

  // ── Project CRUD ──
  async function saveProject(data) {
    const { id, contractors: assignedIds, tasks, ...rest } = data
    const payload = {
      name: rest.name, property: rest.property, status: rest.status,
      start_date: rest.startDate || rest.start_date || null,
      end_date: rest.endDate || rest.end_date || null,
      budget: rest.budget || 0, spent: rest.spent || 0,
      description: rest.description, notes: rest.notes,
      tasks: tasks || [],
      user_id: session.user.id,
    }

    if (id) {
      const { data: updated, error } = await supabase.from('projects').update(payload).eq('id', id).select().single()
      if (error) return showToast('Error saving: ' + error.message, 'warn')
      // Sync junction table
      await supabase.from('project_contractors').delete().eq('project_id', id)
      if (assignedIds?.length) {
        await supabase.from('project_contractors').insert(assignedIds.map(cid => ({ project_id: id, contractor_id: cid })))
      }
      setProjects(ps => ps.map(p => p.id === id ? { ...updated, contractors: assignedIds || [] } : p))
      showToast('Project updated')
    } else {
      const { data: created, error } = await supabase.from('projects').insert(payload).select().single()
      if (error) return showToast('Error saving: ' + error.message, 'warn')
      if (assignedIds?.length) {
        await supabase.from('project_contractors').insert(assignedIds.map(cid => ({ project_id: created.id, contractor_id: cid })))
      }
      setProjects(ps => [{ ...created, contractors: assignedIds || [] }, ...ps])
      showToast('Project added')
    }
    setModal(null)
  }

  async function deleteProject(id) {
    const { error } = await supabase.from('projects').delete().eq('id', id)
    if (error) return showToast('Error deleting: ' + error.message, 'warn')
    setProjects(ps => ps.filter(p => p.id !== id))
    showToast('Project deleted', 'warn')
    setModal(null)
  }

  // ── Update contractor documents/emails in place ──
  async function updateContractorField(contractorId, field, value) {
    const { data, error } = await supabase.from('contractors').update({ [field]: value }).eq('id', contractorId).select().single()
    if (error) return showToast('Error updating', 'warn')
    setContractors(cs => cs.map(c => c.id === contractorId ? data : c))
    return data
  }

  // ── Update project tasks in place ──
  async function updateProjectTasks(projectId, tasks) {
    const { data, error } = await supabase.from('projects').update({ tasks }).eq('id', projectId).select().single()
    if (error) return showToast('Error updating tasks', 'warn')
    setProjects(ps => ps.map(p => p.id === projectId ? { ...data, contractors: p.contractors } : p))
    return data
  }

  // ─── Views ────────────────────────────────────────────────────────────────
  const totalBudget = projects.reduce((a,p)=>a+(p.budget||0),0)
  const totalSpent = projects.reduce((a,p)=>a+(p.spent||0),0)
  const activeProjects = projects.filter(p=>p.status==='in-progress')
  const avgRating = contractors.length ? (contractors.reduce((a,c)=>a+(c.rating||0),0)/contractors.length).toFixed(1) : '—'

  return (
    <div style={{ fontFamily:"'Syne',sans-serif", background:'#0a0e1a', minHeight:'100vh', color:'#e2e8f0', display:'flex', flexDirection:'column' }}>
      <style>{GLOBAL_CSS}</style>

      {/* Nav */}
      <nav style={{ display:'flex', alignItems:'center', padding:'0 24px', background:'#0d1221', borderBottom:'1px solid #1a2035', height:56, flexShrink:0, gap:4 }}>
        <div style={{ fontWeight:800, fontSize:18, letterSpacing:'-0.5px', color:'#fff', marginRight:32, display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:28, height:28, background:'linear-gradient(135deg,#3b82f6,#8b5cf6)', borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>🔨</div>
          ContractorCRM
        </div>
        {[['dashboard','Dashboard'],['contractors','Contractors'],['projects','Projects']].map(([v,l])=>(
          <button key={v}
            onClick={()=>{setView(v);setSearch('');setTradeFilter('All')}}
            style={{ padding:'0 16px', height:56, fontFamily:'inherit', fontSize:13, fontWeight:600, color:view===v?'#fff':'#64748b', borderBottom:view===v?'2px solid #3b82f6':'2px solid transparent', background:'none', cursor:'pointer', letterSpacing:'0.3px' }}>
            {l}
          </button>
        ))}
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:12, color:'#374151', fontFamily:"'DM Mono',monospace" }}>{session.user.email}</span>
          <button onClick={() => supabase.auth.signOut()} style={{ ...T.btnSecondary, padding:'6px 14px', fontSize:12 }}>Sign Out</button>
        </div>
      </nav>

      {/* Main */}
      <div style={{ flex:1, padding:24, maxWidth:1400, margin:'0 auto', width:'100%', display:'flex', flexDirection:'column', gap:24 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <h1 style={{ fontSize:24, fontWeight:800, letterSpacing:'-0.8px' }}>
            {view==='dashboard'?'Overview':view==='contractors'?'Contractors':'Projects'}
          </h1>
        </div>

        {view === 'dashboard' && (
          <DashboardView
            contractors={contractors} projects={projects} activeProjects={activeProjects}
            totalBudget={totalBudget} totalSpent={totalSpent} avgRating={avgRating}
            setView={setView} setModal={setModal}
          />
        )}
        {view === 'contractors' && (
          <ContractorsView
            contractors={filteredContractors} allCount={contractors.length}
            search={search} setSearch={setSearch} tradeFilter={tradeFilter} setTradeFilter={setTradeFilter}
            setModal={setModal}
          />
        )}
        {view === 'projects' && (
          <ProjectsView projects={projects} contractors={contractors} setModal={setModal} />
        )}
      </div>

      {/* Modals */}
      {modal?.type === 'contractor-form' && (
        <ContractorForm initial={modal.data} onSave={saveContractor} onClose={()=>setModal(null)} />
      )}
      {modal?.type === 'contractor-detail' && (
        <ContractorDetail
          contractor={modal.data} projects={projects}
          onEdit={c=>setModal({type:'contractor-form',data:c})}
          onDelete={deleteContractor} onClose={()=>setModal(null)}
          updateField={updateContractorField} showToast={showToast}
        />
      )}
      {modal?.type === 'project-form' && (
        <ProjectForm initial={modal.data} contractors={contractors} onSave={saveProject} onClose={()=>setModal(null)} />
      )}
      {modal?.type === 'project-detail' && (
        <ProjectDetail
          project={modal.data} contractors={contractors}
          onEdit={p=>setModal({type:'project-form',data:p})}
          onDelete={deleteProject} onClose={()=>setModal(null)}
          updateTasks={updateProjectTasks} showToast={showToast}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position:'fixed', bottom:24, right:24, background:toast.type==='warn'?'#ef444420':'#10b98120', border:`1px solid ${toast.type==='warn'?'#ef444440':'#10b98140'}`, color:toast.type==='warn'?'#ef4444':'#10b981', padding:'10px 18px', borderRadius:10, fontWeight:600, fontSize:13, zIndex:2000, boxShadow:'0 4px 24px rgba(0,0,0,0.4)', animation:'fadeIn .2s ease' }}>
          {toast.msg}
        </div>
      )}
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  )
}

function Loader() {
  return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#0a0e1a', color:'#4b5563', fontFamily:"'DM Mono',monospace", fontSize:13 }}>Loading…</div>
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function DashboardView({ contractors, projects, activeProjects, totalBudget, totalSpent, avgRating, setView, setModal }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16 }}>
        {[
          { num: contractors.length, lbl: 'Contractors', color:'#3b82f6' },
          { num: projects.length, lbl: 'Total Projects', color:'#8b5cf6' },
          { num: activeProjects.length, lbl: 'Active Projects', color:'#f59e0b' },
          { num: avgRating+'★', lbl: 'Avg Rating', color:'#10b981' },
        ].map(s => (
          <div key={s.lbl} style={T.card}>
            <div style={{ fontSize:32, fontWeight:800, lineHeight:1, letterSpacing:'-1px', color:s.color }}>{s.num}</div>
            <div style={{ fontSize:12, color:'#64748b', fontWeight:600, letterSpacing:'0.5px', textTransform:'uppercase', marginTop:4, fontFamily:"'DM Mono',monospace" }}>{s.lbl}</div>
          </div>
        ))}
      </div>

      {/* Budget + Status */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <div style={T.card}>
          <div style={{ fontSize:12, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:12, fontFamily:"'DM Mono',monospace" }}>Budget vs Spent</div>
          <div style={{ display:'flex', alignItems:'baseline', gap:12, marginBottom:12 }}>
            <span style={{ fontSize:28, fontWeight:800, color:'#fff', letterSpacing:'-1px' }}>{fmtCurrency(totalSpent)}</span>
            <span style={{ color:'#64748b', fontSize:13 }}>/ {fmtCurrency(totalBudget)}</span>
          </div>
          <div style={{ height:8, background:'#1a2035', borderRadius:4, overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${totalBudget?Math.min(100,(totalSpent/totalBudget)*100):0}%`, background:'linear-gradient(90deg,#3b82f6,#8b5cf6)', borderRadius:4, transition:'width .5s' }} />
          </div>
          <div style={{ marginTop:8, fontSize:12, color:'#64748b', fontFamily:"'DM Mono',monospace" }}>{totalBudget?Math.round((totalSpent/totalBudget)*100):0}% utilized</div>
        </div>
        <div style={T.card}>
          <div style={{ fontSize:12, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:12, fontFamily:"'DM Mono',monospace" }}>Projects by Status</div>
          {Object.entries(STATUS_LABELS).map(([k,v]) => {
            const cnt = projects.filter(p=>p.status===k).length
            return (
              <div key={k} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                <div style={{ width:8, height:8, borderRadius:2, background:STATUS_COLORS[k], flexShrink:0 }} />
                <div style={{ fontSize:13, flex:1, color:'#94a3b8' }}>{v}</div>
                <div style={{ fontWeight:700, fontSize:14, color:'#fff', fontFamily:"'DM Mono',monospace" }}>{cnt}</div>
                <div style={{ width:80, height:4, background:'#1a2035', borderRadius:2, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${projects.length?cnt/projects.length*100:0}%`, background:STATUS_COLORS[k], borderRadius:2 }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Active projects */}
      <div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <div style={{ fontSize:15, fontWeight:800, letterSpacing:'-0.3px' }}>Active Projects</div>
          <button style={T.btnSecondary} onClick={()=>setView('projects')}>View All →</button>
        </div>
        {activeProjects.length === 0
          ? <div style={{ color:'#374151', fontSize:14, textAlign:'center', padding:32 }}>No active projects</div>
          : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:16 }}>
              {activeProjects.slice(0,4).map(p => <ProjectCard key={p.id} project={p} contractors={contractors} onClick={()=>setModal({type:'project-detail',data:p})} />)}
            </div>
        }
      </div>

      {/* Contractors */}
      <div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <div style={{ fontSize:15, fontWeight:800, letterSpacing:'-0.3px' }}>Contractor Roster</div>
          <button style={T.btnSecondary} onClick={()=>setView('contractors')}>View All →</button>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:16 }}>
          {contractors.slice(0,4).map(c => <ContractorCard key={c.id} contractor={c} onClick={()=>setModal({type:'contractor-detail',data:c})} />)}
        </div>
      </div>
    </div>
  )
}

// ─── Contractors View ─────────────────────────────────────────────────────────
function ContractorsView({ contractors, allCount, search, setSearch, tradeFilter, setTradeFilter, setModal }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
        <input style={{ ...T.input, maxWidth:280, flex:1 }} placeholder="Search contractors…" value={search} onChange={e=>setSearch(e.target.value)} />
        <select style={{ ...T.select, width:'auto' }} value={tradeFilter} onChange={e=>setTradeFilter(e.target.value)}>
          <option value="All">All Trades</option>
          {TRADES.map(t=><option key={t}>{t}</option>)}
        </select>
        <span style={{ fontSize:12, color:'#4b5563', fontFamily:"'DM Mono',monospace" }}>{contractors.length} of {allCount}</span>
        <button style={{ ...T.btnPrimary, marginLeft:'auto' }} onClick={()=>setModal({type:'contractor-form',data:null})}>+ Add Contractor</button>
      </div>
      {contractors.length === 0
        ? <div style={{ color:'#374151', textAlign:'center', padding:48, fontSize:14 }}>No contractors found</div>
        : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:16 }}>
            {contractors.map(c => <ContractorCard key={c.id} contractor={c} onClick={()=>setModal({type:'contractor-detail',data:c})} />)}
          </div>
      }
    </div>
  )
}

// ─── Projects View ────────────────────────────────────────────────────────────
function ProjectsView({ projects, contractors, setModal }) {
  const [statusF, setStatusF] = useState('all')
  const filtered = projects.filter(p => statusF==='all' || p.status===statusF)
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:6 }}>
          {[['all','All'],['in-progress','In Progress'],['planning','Planning'],['completed','Completed'],['on-hold','On Hold']].map(([v,l])=>(
            <button key={v} onClick={()=>setStatusF(v)}
              style={{ ...T.btnSecondary, ...(statusF===v?{background:'#1e2a45',color:'#fff',border:'1px solid #3b82f6'}:{}) }}>
              {l}
            </button>
          ))}
        </div>
        <button style={{ ...T.btnPrimary, marginLeft:'auto' }} onClick={()=>setModal({type:'project-form',data:null})}>+ New Project</button>
      </div>
      {filtered.length === 0
        ? <div style={{ color:'#374151', textAlign:'center', padding:48, fontSize:14 }}>No projects</div>
        : <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {filtered.map(p => <ProjectRow key={p.id} project={p} contractors={contractors} onClick={()=>setModal({type:'project-detail',data:p})} />)}
          </div>
      }
    </div>
  )
}

// ─── Cards ────────────────────────────────────────────────────────────────────
function ContractorCard({ contractor: c, onClick }) {
  return (
    <div style={T.cardHov} onClick={onClick}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:12 }}>
        <div>
          <div style={{ fontWeight:800, fontSize:15, letterSpacing:'-0.3px', marginBottom:4 }}>{c.name}</div>
          <span style={T.tradeBadge}>{c.trade}</span>
        </div>
        <StarRating value={c.rating||0} />
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:4, marginTop:8 }}>
        {c.phone && <div style={{ fontSize:13, color:'#64748b', fontFamily:"'DM Mono',monospace" }}>{c.phone}</div>}
        {c.email && <div style={{ fontSize:12, color:'#4a90e2' }}>{c.email}</div>}
        {c.referred_by && <div style={{ fontSize:12, color:'#6b7280' }}>Ref: {c.referred_by}</div>}
      </div>
      {c.tags?.length > 0 && (
        <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginTop:10 }}>
          {c.tags.map(t=><span key={t} style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:3, background:'#10b98118', color:'#10b981', textTransform:'uppercase', letterSpacing:'0.4px' }}>{t}</span>)}
        </div>
      )}
    </div>
  )
}

function ProjectCard({ project: p, contractors, onClick }) {
  const pct = p.budget ? Math.round((p.spent/p.budget)*100) : 0
  const pContractors = contractors.filter(c=>p.contractors?.includes(c.id))
  return (
    <div style={T.cardHov} onClick={onClick}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:10 }}>
        <div style={{ flex:1, marginRight:12 }}>
          <div style={{ fontWeight:800, fontSize:14, letterSpacing:'-0.3px', marginBottom:3 }}>{p.name}</div>
          <div style={{ fontSize:12, color:'#6b7280' }}>{p.property}</div>
        </div>
        <span style={T.badge(STATUS_COLORS[p.status])}>{STATUS_LABELS[p.status]}</span>
      </div>
      <div style={{ height:4, background:'#1a2035', borderRadius:2, overflow:'hidden', marginBottom:6 }}>
        <div style={{ height:'100%', width:`${Math.min(100,pct)}%`, background:pct>100?'#ef4444':'linear-gradient(90deg,#3b82f6,#8b5cf6)', borderRadius:2 }} />
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8, fontSize:12, color:'#64748b', fontFamily:"'DM Mono',monospace" }}>
        <span>{fmtCurrency(p.spent)} spent</span>
        <span>{fmtCurrency(p.budget)} budget</span>
      </div>
      {pContractors.length > 0 && (
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {pContractors.map(c=><span key={c.id} style={T.tradeBadge}>{c.name}</span>)}
        </div>
      )}
    </div>
  )
}

function ProjectRow({ project: p, contractors, onClick }) {
  const pct = p.budget ? Math.round((p.spent/p.budget)*100) : 0
  const done = (p.tasks||[]).filter(t=>t.done).length
  return (
    <div style={{ ...T.cardHov, display:'flex', alignItems:'center', gap:16, padding:'14px 20px' }} onClick={onClick}>
      <div style={{ width:8, height:8, borderRadius:2, background:STATUS_COLORS[p.status], flexShrink:0 }} />
      <div style={{ flex:2, minWidth:0 }}>
        <div style={{ fontWeight:700, fontSize:14, letterSpacing:'-0.3px', marginBottom:2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.name}</div>
        <div style={{ fontSize:12, color:'#6b7280' }}>{p.property}</div>
      </div>
      <span style={{ ...T.badge(STATUS_COLORS[p.status]), flexShrink:0 }}>{STATUS_LABELS[p.status]}</span>
      <div style={{ flex:1, textAlign:'right' }}>
        <div style={{ fontSize:13, fontWeight:700, fontFamily:"'DM Mono',monospace" }}>{fmtCurrency(p.spent)}<span style={{ color:'#374151', fontWeight:400 }}> / {fmtCurrency(p.budget)}</span></div>
        <div style={{ height:3, background:'#1a2035', borderRadius:2, marginTop:4 }}>
          <div style={{ height:'100%', width:`${Math.min(100,pct)}%`, background:'linear-gradient(90deg,#3b82f6,#8b5cf6)', borderRadius:2 }} />
        </div>
      </div>
      {p.tasks?.length > 0 && <div style={{ fontSize:12, color:'#6b7280', whiteSpace:'nowrap', fontFamily:"'DM Mono',monospace" }}>{done}/{p.tasks.length} tasks</div>}
      <div style={{ fontSize:11, color:'#374151', whiteSpace:'nowrap' }}>{fmtDate(p.start_date)}</div>
    </div>
  )
}

// ─── Contractor Form ──────────────────────────────────────────────────────────
function ContractorForm({ initial, onSave, onClose }) {
  const norm = (c) => c ? { ...c, referredBy: c.referred_by || c.referredBy || '', tags: c.tags || [], documents: c.documents || [], emails: c.emails || [] } : null
  const blank = { id:null, name:'', trade:'Electrical', phone:'', email:'', website:'', rating:3, referredBy:'', notes:'', tags:[], documents:[], emails:[] }
  const [form, setForm] = useState(norm(initial) || blank)
  const [tagInput, setTagInput] = useState('')
  const set = (k,v) => setForm(f=>({...f,[k]:v}))
  const addTag = () => { if (tagInput.trim() && !form.tags.includes(tagInput.trim())) { set('tags',[...form.tags,tagInput.trim()]); setTagInput('') } }

  return (
    <ModalShell title={`${form.id?'Edit':'Add'} Contractor`} onClose={onClose}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:14 }}>
        <Field label="Name *"><input style={T.input} value={form.name} onChange={e=>set('name',e.target.value)} placeholder="Company or person name" /></Field>
        <Field label="Trade">
          <select style={T.select} value={form.trade} onChange={e=>set('trade',e.target.value)}>
            {TRADES.map(t=><option key={t}>{t}</option>)}
          </select>
        </Field>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:14 }}>
        <Field label="Phone"><input style={T.input} value={form.phone} onChange={e=>set('phone',e.target.value)} placeholder="(555) 000-0000" /></Field>
        <Field label="Email"><input style={T.input} value={form.email} onChange={e=>set('email',e.target.value)} placeholder="email@example.com" /></Field>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:14 }}>
        <Field label="Website"><input style={T.input} value={form.website} onChange={e=>set('website',e.target.value)} placeholder="example.com" /></Field>
        <Field label="Referred By"><input style={T.input} value={form.referredBy} onChange={e=>set('referredBy',e.target.value)} placeholder="Who referred them?" /></Field>
      </div>
      <div style={{ marginBottom:14 }}>
        <label style={T.label}>Rating</label>
        <StarRating value={form.rating} onChange={v=>set('rating',v)} />
      </div>
      <div style={{ marginBottom:14 }}>
        <label style={T.label}>Tags (licensed, bonded, insured…)</label>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
          {form.tags.map(t=>(
            <span key={t} style={{ fontSize:11, padding:'3px 8px', background:'#1a2035', border:'1px solid #253450', borderRadius:4, color:'#7c9cbf', display:'flex', alignItems:'center', gap:5 }}>
              {t}<span onClick={()=>set('tags',form.tags.filter(x=>x!==t))} style={{ cursor:'pointer', color:'#ef4444', fontWeight:700 }}>×</span>
            </span>
          ))}
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <input style={{ ...T.input, flex:1 }} value={tagInput} onChange={e=>setTagInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addTag()} placeholder="Add tag, press Enter" />
          <button onClick={addTag} style={{ ...T.btnSecondary, padding:'8px 14px' }}>Add</button>
        </div>
      </div>
      <div style={{ marginBottom:20 }}>
        <label style={T.label}>Notes</label>
        <textarea style={T.textarea} value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Any notes about this contractor…" />
      </div>
      <ModalFooter onClose={onClose} onSave={()=>{if(form.name.trim())onSave(form)}} label="Save Contractor" />
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
    const updated = [...(c.documents||[]), { id:uid(), ...newDoc }]
    const data = await updateField(c.id, 'documents', updated)
    if (data) { setC(data); setNewDoc({ name:'', type:'Quote', date:'', amount:'' }); setShowAddDoc(false); showToast('Document linked') }
  }
  const removeDoc = async (id) => {
    const updated = (c.documents||[]).filter(d=>d.id!==id)
    const data = await updateField(c.id, 'documents', updated)
    if (data) { setC(data); showToast('Document removed','warn') }
  }
  const addEmail = async () => {
    if (!newEmail.subject) return
    const updated = [...(c.emails||[]), { id:uid(), ...newEmail }]
    const data = await updateField(c.id, 'emails', updated)
    if (data) { setC(data); setNewEmail({ subject:'', date:'', summary:'' }); setShowAddEmail(false); showToast('Email logged') }
  }
  const removeEmail = async (id) => {
    const updated = (c.emails||[]).filter(e=>e.id!==id)
    const data = await updateField(c.id, 'emails', updated)
    if (data) { setC(data); showToast('Email removed','warn') }
  }

  const tabBtn = (key, label, count) => (
    <button key={key} onClick={()=>setTab(key)}
      style={{ padding:'8px 16px', borderRadius:'6px 6px 0 0', fontSize:12, fontWeight:700, letterSpacing:'0.3px', textTransform:'uppercase', cursor:'pointer', background:tab===key?'#1a2035':'none', color:tab===key?'#fff':'#4b5563', border:'none', fontFamily:'inherit' }}>
      {label}{count>0&&<span style={{ marginLeft:5, background:'#3b82f6', color:'#fff', borderRadius:3, padding:'1px 5px', fontSize:9 }}>{count}</span>}
    </button>
  )
  const inS = { width:'100%', background:'#111827', border:'1px solid #1e2a45', borderRadius:7, padding:'7px 10px', color:'#e2e8f0', fontSize:13, fontFamily:"'Syne',sans-serif" }

  return (
    <ModalShell title={null} onClose={onClose} maxWidth={660}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:4 }}>
        <div>
          <h2 style={{ fontSize:22, fontWeight:800, letterSpacing:'-0.8px', marginBottom:6 }}>{c.name}</h2>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={T.tradeBadge}>{c.trade}</span>
            <StarRating value={c.rating||0} />
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={()=>onEdit(c)} style={{ ...T.btnSecondary, padding:'7px 14px', fontSize:12 }}>Edit</button>
          <button onClick={onClose} style={{ color:'#64748b', fontSize:20, cursor:'pointer', lineHeight:1 }}>✕</button>
        </div>
      </div>

      <div style={{ display:'flex', gap:4, borderBottom:'1px solid #1a2035', marginBottom:20, marginTop:18 }}>
        {tabBtn('info','Info',0)}
        {tabBtn('documents','Documents',(c.documents||[]).length)}
        {tabBtn('emails','Emails',(c.emails||[]).length)}
        {tabBtn('projects','Projects',relatedProjects.length)}
      </div>

      {tab === 'info' && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            {[['Phone',c.phone],['Email',c.email],['Website',c.website],['Referred By',c.referred_by||c.referredBy]].map(([lbl,val])=>val?(
              <div key={lbl} style={{ background:'#111827', borderRadius:8, padding:'10px 14px' }}>
                <div style={{ fontSize:10, color:'#4b5563', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:3, fontFamily:"'DM Mono',monospace" }}>{lbl}</div>
                <div style={{ fontSize:13 }}>{val}</div>
              </div>
            ):null)}
          </div>
          {c.tags?.length>0 && (
            <div>
              <div style={T.label}>Tags</div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {c.tags.map(t=><span key={t} style={{ fontSize:10, padding:'3px 8px', background:'#10b98118', border:'1px solid #10b98140', borderRadius:3, color:'#10b981', fontWeight:700, textTransform:'uppercase' }}>{t}</span>)}
              </div>
            </div>
          )}
          {c.notes && (
            <div>
              <div style={T.label}>Notes</div>
              <div style={{ background:'#111827', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#94a3b8', lineHeight:1.6 }}>{c.notes}</div>
            </div>
          )}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:8, paddingTop:12, borderTop:'1px solid #1a2035' }}>
            <span style={{ fontSize:11, color:'#374151', fontFamily:"'DM Mono',monospace" }}>Added {fmtDate(c.created_at)}</span>
            <button onClick={()=>{if(window.confirm('Delete this contractor?'))onDelete(c.id)}} style={{ padding:'6px 14px', borderRadius:7, background:'#ef444418', color:'#ef4444', fontSize:12, fontWeight:600, cursor:'pointer', border:'1px solid #ef444440', fontFamily:'inherit' }}>Delete</button>
          </div>
        </div>
      )}

      {tab === 'documents' && (
        <div>
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:12 }}>
            <button onClick={()=>setShowAddDoc(!showAddDoc)} style={{ ...T.btnPrimary, background:'#3b82f620', color:'#3b82f6', border:'1px solid #3b82f640', padding:'7px 14px', fontSize:12 }}>+ Link Document</button>
          </div>
          {showAddDoc && (
            <div style={{ background:'#111827', borderRadius:10, padding:14, marginBottom:14, display:'flex', flexDirection:'column', gap:8 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <input style={inS} placeholder="Name / description" value={newDoc.name} onChange={e=>setNewDoc(d=>({...d,name:e.target.value}))} />
                <select style={inS} value={newDoc.type} onChange={e=>setNewDoc(d=>({...d,type:e.target.value}))}>
                  {DOC_TYPES.map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <input style={inS} type="date" value={newDoc.date} onChange={e=>setNewDoc(d=>({...d,date:e.target.value}))} />
                <input style={inS} placeholder="Amount (e.g. $1,200)" value={newDoc.amount} onChange={e=>setNewDoc(d=>({...d,amount:e.target.value}))} />
              </div>
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                <button onClick={()=>setShowAddDoc(false)} style={{ ...T.btnSecondary, padding:'6px 12px', fontSize:12 }}>Cancel</button>
                <button onClick={addDoc} style={{ ...T.btnPrimary, padding:'6px 14px', fontSize:12 }}>Add</button>
              </div>
            </div>
          )}
          {(c.documents||[]).length === 0
            ? <div style={{ color:'#374151', fontSize:13, textAlign:'center', padding:32 }}>No documents linked yet</div>
            : <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {(c.documents||[]).map(doc=>(
                  <div key={doc.id} style={{ display:'flex', alignItems:'center', gap:12, background:'#111827', borderRadius:8, padding:'10px 14px' }}>
                    <span style={{ fontSize:16 }}>{DOC_ICONS[doc.type]||'📎'}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:600 }}>{doc.name}</div>
                      <div style={{ fontSize:11, color:'#4b5563', fontFamily:"'DM Mono',monospace" }}>{doc.type}{doc.date?' · '+fmtDate(doc.date):''}{doc.amount?' · '+doc.amount:''}</div>
                    </div>
                    <button onClick={()=>removeDoc(doc.id)} style={{ color:'#ef4444', fontSize:16, cursor:'pointer' }}>×</button>
                  </div>
                ))}
              </div>
          }
        </div>
      )}

      {tab === 'emails' && (
        <div>
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:12 }}>
            <button onClick={()=>setShowAddEmail(!showAddEmail)} style={{ ...T.btnPrimary, background:'#8b5cf620', color:'#8b5cf6', border:'1px solid #8b5cf640', padding:'7px 14px', fontSize:12 }}>+ Log Email</button>
          </div>
          {showAddEmail && (
            <div style={{ background:'#111827', borderRadius:10, padding:14, marginBottom:14, display:'flex', flexDirection:'column', gap:8 }}>
              <input style={inS} placeholder="Subject" value={newEmail.subject} onChange={e=>setNewEmail(n=>({...n,subject:e.target.value}))} />
              <input style={inS} type="date" value={newEmail.date} onChange={e=>setNewEmail(n=>({...n,date:e.target.value}))} />
              <input style={inS} placeholder="Summary / notes" value={newEmail.summary} onChange={e=>setNewEmail(n=>({...n,summary:e.target.value}))} />
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                <button onClick={()=>setShowAddEmail(false)} style={{ ...T.btnSecondary, padding:'6px 12px', fontSize:12 }}>Cancel</button>
                <button onClick={addEmail} style={{ ...T.btnPrimary, background:'#8b5cf6', padding:'6px 14px', fontSize:12 }}>Log</button>
              </div>
            </div>
          )}
          {(c.emails||[]).length === 0
            ? <div style={{ color:'#374151', fontSize:13, textAlign:'center', padding:32 }}>No emails logged yet</div>
            : <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {(c.emails||[]).map(em=>(
                  <div key={em.id} style={{ display:'flex', alignItems:'center', gap:12, background:'#111827', borderRadius:8, padding:'10px 14px' }}>
                    <span style={{ fontSize:16 }}>✉️</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:600 }}>{em.subject}</div>
                      <div style={{ fontSize:11, color:'#4b5563', fontFamily:"'DM Mono',monospace" }}>{em.date?fmtDate(em.date):''}{em.summary?' — '+em.summary:''}</div>
                    </div>
                    <button onClick={()=>removeEmail(em.id)} style={{ color:'#ef4444', fontSize:16, cursor:'pointer' }}>×</button>
                  </div>
                ))}
              </div>
          }
        </div>
      )}

      {tab === 'projects' && (
        <div>
          {relatedProjects.length === 0
            ? <div style={{ color:'#374151', fontSize:13, textAlign:'center', padding:32 }}>Not assigned to any projects yet</div>
            : <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {relatedProjects.map(p=>(
                  <div key={p.id} style={{ background:'#111827', borderRadius:8, padding:'10px 14px', display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ width:8, height:8, borderRadius:2, background:STATUS_COLORS[p.status], flexShrink:0 }} />
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:600 }}>{p.name}</div>
                      <div style={{ fontSize:11, color:'#4b5563' }}>{p.property}</div>
                    </div>
                    <span style={T.badge(STATUS_COLORS[p.status])}>{STATUS_LABELS[p.status]}</span>
                    <span style={{ fontSize:12, color:'#6b7280', fontFamily:"'DM Mono',monospace" }}>{fmtCurrency(p.budget)}</span>
                  </div>
                ))}
              </div>
          }
        </div>
      )}
    </ModalShell>
  )
}

// ─── Project Form ─────────────────────────────────────────────────────────────
function ProjectForm({ initial, contractors, onSave, onClose }) {
  const norm = (p) => p ? {
    ...p,
    startDate: p.start_date || p.startDate || '',
    endDate: p.end_date || p.endDate || '',
    contractors: p.contractors || [],
    tasks: p.tasks || [],
  } : null
  const blank = { id:null, name:'', property:'', status:'planning', startDate:'', endDate:'', budget:0, spent:0, contractors:[], description:'', tasks:[], notes:'' }
  const [form, setForm] = useState(norm(initial) || blank)
  const set = (k,v) => setForm(f=>({...f,[k]:v}))
  const toggleC = id => set('contractors', form.contractors.includes(id) ? form.contractors.filter(c=>c!==id) : [...form.contractors,id])

  return (
    <ModalShell title={`${form.id?'Edit':'New'} Project`} onClose={onClose}>
      <div style={{ marginBottom:14 }}>
        <label style={T.label}>Project Name *</label>
        <input style={T.input} value={form.name} onChange={e=>set('name',e.target.value)} placeholder="e.g. Kitchen Remodel — Oak St" />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:14 }}>
        <Field label="Property"><input style={T.input} value={form.property} onChange={e=>set('property',e.target.value)} placeholder="123 Oak St" /></Field>
        <Field label="Status">
          <select style={T.select} value={form.status} onChange={e=>set('status',e.target.value)}>
            {Object.entries(STATUS_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:14 }}>
        <Field label="Start Date"><input style={T.input} type="date" value={form.startDate} onChange={e=>set('startDate',e.target.value)} /></Field>
        <Field label="End Date"><input style={T.input} type="date" value={form.endDate} onChange={e=>set('endDate',e.target.value)} /></Field>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:14 }}>
        <Field label="Budget ($)"><input style={T.input} type="number" value={form.budget} onChange={e=>set('budget',+e.target.value)} /></Field>
        <Field label="Spent ($)"><input style={T.input} type="number" value={form.spent} onChange={e=>set('spent',+e.target.value)} /></Field>
      </div>
      <div style={{ marginBottom:14 }}>
        <label style={T.label}>Assign Contractors</label>
        <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
          {contractors.map(c=>(
            <div key={c.id} onClick={()=>toggleC(c.id)}
              style={{ padding:'6px 12px', borderRadius:7, cursor:'pointer', background:form.contractors.includes(c.id)?'#3b82f630':'#111827', border:form.contractors.includes(c.id)?'1px solid #3b82f6':'1px solid #1e2a45', color:form.contractors.includes(c.id)?'#93c5fd':'#64748b', fontSize:12, fontWeight:600, transition:'all .15s' }}>
              {form.contractors.includes(c.id)?'✓ ':''}{c.name}
            </div>
          ))}
          {contractors.length === 0 && <div style={{ fontSize:12, color:'#374151' }}>No contractors added yet</div>}
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

// ─── Project Detail ───────────────────────────────────────────────────────────
function ProjectDetail({ project: initP, contractors, onEdit, onDelete, onClose, updateTasks, showToast }) {
  const [p, setP] = useState(initP)
  const [newTask, setNewTask] = useState('')
  const pct = p.budget ? Math.round((p.spent/p.budget)*100) : 0
  const projectContractors = contractors.filter(c=>p.contractors?.includes(c.id))
  const done = (p.tasks||[]).filter(t=>t.done).length

  const saveTasks = async (tasks) => {
    const data = await updateTasks(p.id, tasks)
    if (data) setP(prev=>({...prev, tasks}))
  }
  const addTask = async () => {
    if (!newTask.trim()) return
    const tasks = [...(p.tasks||[]), { id:uid(), text:newTask.trim(), done:false }]
    await saveTasks(tasks)
    setNewTask('')
  }
  const toggleTask = async (id) => {
    const tasks = (p.tasks||[]).map(t=>t.id===id?{...t,done:!t.done}:t)
    await saveTasks(tasks)
  }
  const removeTask = async (id) => {
    await saveTasks((p.tasks||[]).filter(t=>t.id!==id))
  }

  return (
    <ModalShell title={null} onClose={onClose} maxWidth={660}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:4 }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:800, letterSpacing:'-0.8px', marginBottom:4 }}>{p.name}</h2>
          <div style={{ fontSize:13, color:'#6b7280' }}>{p.property}</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <span style={T.badge(STATUS_COLORS[p.status])}>{STATUS_LABELS[p.status]}</span>
          <button onClick={()=>onEdit(p)} style={{ ...T.btnSecondary, padding:'7px 14px', fontSize:12 }}>Edit</button>
          <button onClick={onClose} style={{ color:'#64748b', fontSize:20, lineHeight:1 }}>✕</button>
        </div>
      </div>

      {/* Budget bar */}
      <div style={{ background:'#111827', borderRadius:10, padding:'14px 16px', marginTop:16, marginBottom:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
          <span style={{ fontSize:12, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.5px', fontFamily:"'DM Mono',monospace" }}>Budget</span>
          <span style={{ fontSize:12, color:pct>100?'#ef4444':'#94a3b8', fontFamily:"'DM Mono',monospace" }}>{fmtCurrency(p.spent)} / {fmtCurrency(p.budget)} ({pct}%)</span>
        </div>
        <div style={{ height:6, background:'#1a2035', borderRadius:3, overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${Math.min(100,pct)}%`, background:pct>100?'#ef4444':'linear-gradient(90deg,#3b82f6,#8b5cf6)', borderRadius:3 }} />
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:8 }}>
          <span style={{ fontSize:11, color:'#374151', fontFamily:"'DM Mono',monospace" }}>Remaining: {fmtCurrency((p.budget||0)-(p.spent||0))}</span>
          <span style={{ fontSize:11, color:'#374151', fontFamily:"'DM Mono',monospace" }}>{fmtDate(p.start_date)} → {fmtDate(p.end_date)}</span>
        </div>
      </div>

      {p.description && <div style={{ fontSize:13, color:'#94a3b8', marginBottom:16, lineHeight:1.6 }}>{p.description}</div>}

      {/* Contractors */}
      {projectContractors.length > 0 && (
        <div style={{ marginBottom:16 }}>
          <div style={T.label}>Assigned Contractors</div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {projectContractors.map(c=>(
              <div key={c.id} style={{ background:'#111827', borderRadius:8, padding:'8px 12px', border:'1px solid #1e2a45' }}>
                <div style={{ fontSize:13, fontWeight:600 }}>{c.name}</div>
                <div style={{ fontSize:11, color:'#6b7280' }}>{c.trade}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tasks */}
      <div style={{ marginBottom:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <div style={T.label}>Tasks {p.tasks?.length>0&&`(${done}/${p.tasks.length})`}</div>
        </div>
        <div style={{ display:'flex', gap:8, marginBottom:10 }}>
          <input style={{ ...T.input, fontSize:13 }} placeholder="Add task…" value={newTask} onChange={e=>setNewTask(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addTask()} />
          <button onClick={addTask} style={{ ...T.btnSecondary, padding:'8px 14px' }}>Add</button>
        </div>
        {(p.tasks||[]).length > 0 && (
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            {(p.tasks||[]).map(t=>(
              <div key={t.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background:'#111827', borderRadius:7 }}>
                <div onClick={()=>toggleTask(t.id)} style={{ width:16, height:16, borderRadius:4, border:t.done?'none':'1px solid #374151', background:t.done?'#10b981':'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, cursor:'pointer', transition:'all .15s' }}>
                  {t.done && <span style={{ fontSize:10, color:'#fff', fontWeight:700 }}>✓</span>}
                </div>
                <span onClick={()=>toggleTask(t.id)} style={{ flex:1, fontSize:13, color:t.done?'#374151':'#e2e8f0', textDecoration:t.done?'line-through':'none', cursor:'pointer' }}>{t.text}</span>
                <button onClick={()=>removeTask(t.id)} style={{ color:'#374151', fontSize:14 }}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {p.notes && (
        <div style={{ background:'#111827', borderRadius:8, padding:'10px 14px', marginBottom:16 }}>
          <div style={T.label}>Notes</div>
          <div style={{ fontSize:13, color:'#94a3b8', lineHeight:1.6 }}>{p.notes}</div>
        </div>
      )}

      <div style={{ display:'flex', justifyContent:'flex-end', paddingTop:12, borderTop:'1px solid #1a2035' }}>
        <button onClick={()=>{if(window.confirm('Delete this project?'))onDelete(p.id)}} style={{ padding:'6px 14px', borderRadius:7, background:'#ef444418', color:'#ef4444', fontSize:12, fontWeight:600, cursor:'pointer', border:'1px solid #ef444440', fontFamily:'inherit' }}>Delete Project</button>
      </div>
    </ModalShell>
  )
}

// ─── Shared UI primitives ─────────────────────────────────────────────────────
function ModalShell({ title, onClose, children, maxWidth=580 }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(5,8,20,.85)', backdropFilter:'blur(4px)', display:'flex', alignItems:'flex-start', justifyContent:'center', zIndex:1000, overflowY:'auto', padding:'32px 16px' }}>
      <div style={{ background:'#0d1221', border:'1px solid #1e2a45', borderRadius:16, width:'100%', maxWidth, padding:28 }}>
        {title && (
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
            <h2 style={{ fontSize:18, fontWeight:800, letterSpacing:'-0.5px' }}>{title}</h2>
            <button onClick={onClose} style={{ color:'#64748b', fontSize:20, lineHeight:1 }}>✕</button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label style={T.label}>{label}</label>
      {children}
    </div>
  )
}

function ModalFooter({ onClose, onSave, label }) {
  return (
    <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
      <button onClick={onClose} style={{ ...T.btnSecondary }}>Cancel</button>
      <button onClick={onSave} style={{ ...T.btnPrimary }}>{label}</button>
    </div>
  )
}
