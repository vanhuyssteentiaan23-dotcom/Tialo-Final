'use client'

import { useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '../../lib/supabase'

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState([])
  const [materials, setMaterials] = useState([])
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function loadSubjects() {
    const supabase = getSupabaseBrowserClient()
    if (!supabase) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      window.location.href = '/login'
      return
    }

    const { data, error: queryError } = await supabase
      .from('subjects')
      .select('id,name,created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
    const { data: materialRows, error: materialError } = await supabase
      .from('materials')
      .select('id,subject_id,title,file_name,mime_type,file_size,processing_status,extracted_at,storage_path')
      .eq('user_id', user.id)
      .order('uploaded_at', { ascending: false })

    if (queryError) setError(queryError.message)
    else setSubjects(data || [])
    if (materialError) setError(current => current || materialError.message)
    else setMaterials(materialRows || [])
    setLoading(false)
  }

  useEffect(() => { loadSubjects() }, [])

  async function addSubject(event) {
    event.preventDefault()
    const cleanName = name.trim()
    if (!cleanName) return

    setSaving(true)
    setError('')

    const supabase = getSupabaseBrowserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      window.location.href = '/login'
      return
    }

    const { error: insertError } = await supabase
      .from('subjects')
      .insert({ user_id: user.id, name: cleanName })

    if (insertError) setError(insertError.message)
    else {
      setName('')
      await loadSubjects()
    }

    setSaving(false)
  }

  async function deleteMaterial(material) {
    if (!window.confirm(`Delete ${material.title || material.file_name || 'this material'}?`)) return
    const supabase = getSupabaseBrowserClient()
    if (!supabase) return
    setError('')
    const { error: dbError } = await supabase.from('materials').delete().eq('id', material.id).eq('user_id', (await supabase.auth.getUser()).data.user?.id)
    if (dbError) { setError(dbError.message); return }
    if (material.storage_path) {
      const { error: storageError } = await supabase.storage.from('study-materials').remove([material.storage_path])
      if (storageError) setError(`Material deleted, but storage cleanup needs attention: ${storageError.message}`)
    }
    setMaterials(current => current.filter(item => item.id !== material.id))
  }

  function materialsFor(subjectId) {
    return materials.filter(material => material.subject_id === subjectId)
  }

  async function deleteSubject(id) {
    if (!window.confirm('Delete this subject? Any material linked to it may also be affected.')) return

    const supabase = getSupabaseBrowserClient()
    const { error: deleteError } = await supabase.from('subjects').delete().eq('id', id)
    if (deleteError) setError(deleteError.message)
    else setSubjects(current => current.filter(subject => subject.id !== id))
  }

  return (
    <main className="shell subjects-page" style={{ minHeight: '100vh' }}>
      <style>{`
        .subjects-page .section{max-width:1100px;margin:0 auto}
        .subjects-page .subjects-form{background:rgba(18,8,16,.72);border:1px solid rgba(255,90,120,.28);border-radius:22px;padding:18px;display:flex;gap:12px;align-items:center}
        .subjects-page .subjects-form input{flex:1;min-width:0}
        .subjects-page .subjects-form .btn{white-space:nowrap;min-height:52px}
        .subjects-page .subjects-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:18px;margin-top:24px}
        .subjects-page .subject-panel{min-width:0;padding:22px;border:1px solid rgba(255,90,120,.25);border-radius:20px;background:linear-gradient(145deg,rgba(31,9,19,.9),rgba(11,5,12,.94));box-shadow:0 16px 35px rgba(0,0,0,.18)}
        .subjects-page .subject-header{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
        .subjects-page .subject-header-main{min-width:0;flex:1}
        .subjects-page .subject-title{font-size:22px;line-height:1.15;margin:12px 0 8px;overflow-wrap:anywhere}
        .subjects-page .subject-description{font-size:12px;line-height:1.65;color:#b7a7ae;margin:0}
        .subjects-page .subject-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}
        .subjects-page .subject-actions .btn{white-space:nowrap}
        .subjects-page .materials-list{display:grid;gap:9px;margin-top:18px;padding-top:16px;border-top:1px solid rgba(255,255,255,.07)}
        .subjects-page .material-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(255,255,255,.025)}
        .subjects-page .material-info{min-width:0;flex:1}
        .subjects-page .material-name{display:block;font-size:12px;font-weight:800;line-height:1.35;overflow-wrap:anywhere}
        .subjects-page .material-meta{display:block;font-size:9px;color:#8e7d86;margin-top:5px}
        .subjects-page .material-row .btn{flex:0 0 auto;white-space:nowrap}
        @media(max-width:650px){.subjects-page .section{padding-left:14px;padding-right:14px}.subjects-page .subjects-form{align-items:stretch;flex-direction:column}.subjects-page .subjects-form .btn{width:100%}.subjects-page .subjects-grid{grid-template-columns:1fr}.subjects-page .subject-header{display:block}.subjects-page .subject-header>.btn{margin-top:12px}.subjects-page .material-row{align-items:flex-start}.subjects-page .material-row .btn{padding:9px 11px}}
      `}</style>

      <nav className="nav">
        <a className="brand" href="/dashboard">TIA<span>LO</span></a>
        <a className="btn secondary" href="/dashboard">Back to dashboard</a>
      </nav>

      <section className="section" style={{ paddingTop: 56 }}>
        <div className="eyebrow">Stage 4</div>
        <h1 style={{ fontSize: 48, margin: '18px 0 8px' }}>Your subjects</h1>
        <p className="muted" style={{ maxWidth: 700, lineHeight: 1.7 }}>
          Add the subjects you are currently studying. Your learning materials, AI tutor context, mock exams and progress will be organised around these subjects.
        </p>

        <form onSubmit={addSubject} className="subjects-form" style={{ marginTop: 32 }}>
          <input
            value={name}
            onChange={event => setName(event.target.value)}
            placeholder="e.g. Business Management"
            aria-label="Subject name"
            style={{ flex: '1 1 320px', minWidth: 0, padding: '15px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.06)', color: '#fff', outline: 'none' }}
            maxLength={100}
          />
          <button className="btn primary" type="submit" disabled={saving || !name.trim()}>
            {saving ? 'Adding…' : 'Add subject'}
          </button>
        </form>

        {error && <p style={{ color: '#ff9b9b', marginTop: 18 }}>{error}</p>}

        {loading ? (
          <p className="muted" style={{ marginTop: 30 }}>Loading subjects…</p>
        ) : subjects.length === 0 ? (
          <div className="card" style={{ marginTop: 24, padding: 34 }}>
            <h3>No subjects yet</h3>
            <p>Start by adding your first subject above.</p>
          </div>
        ) : (
          <div className="subjects-grid">
            {subjects.map(subject => {
              const subjectMaterials = materialsFor(subject.id)
              return <article className="subject-panel" key={subject.id}>
                <div className="subject-header">
                  <div className="subject-header-main">
                    <div className="eyebrow" style={{ fontSize: 10 }}>Subject</div>
                    <h3 className="subject-title">{subject.name}</h3>
                    <p className="subject-description">{subjectMaterials.length} material{subjectMaterials.length === 1 ? '' : 's'} · Your notes, textbooks and presentations.</p>
                    <div className="subject-actions"><a className="btn primary" href={`/materials?subject=${encodeURIComponent(subject.id)}`}>＋ Upload materials</a></div>
                    <div className="materials-list">
                      {subjectMaterials.length === 0 ? <div className="muted" style={{ fontSize: 11, padding: '6px 0' }}>No materials uploaded for this subject.</div> :
                        subjectMaterials.map(material => <div key={material.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, padding:'11px 12px', border:'1px solid rgba(255,255,255,.07)', borderRadius:10, background:'rgba(255,255,255,.025)' }}>
                          <div style={{ minWidth:0 }}><strong style={{display:'block',fontSize:11,overflowWrap:'anywhere'}}>{material.title || material.file_name}</strong><span className="muted" style={{fontSize:9}}>{material.processing_status || 'uploaded'}{material.extracted_at ? ' · ready' : ''}</span></div>
                          <button className="btn secondary" style={{flex:'0 0 auto'}} onClick={() => deleteMaterial(material)}>Delete</button>
                        </div>)
                      }
                    </div>
                  </div>
                  <button type="button" className="btn secondary" onClick={() => deleteSubject(subject.id)} aria-label={`Delete ${subject.name}`}>Delete subject</button>
                </div>
              </article>
            })}
          </div>
        )}
      </section>
    </main>
  )
}
