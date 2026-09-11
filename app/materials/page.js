'use client'

import { useEffect, useRef, useState } from 'react'
import { getSupabaseBrowserClient } from '../../lib/supabase'

const MAX_FILE_SIZE = 50 * 1024 * 1024
const ACCEPTED_TYPES = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
  'image/png': 'PNG',
  'image/jpeg': 'JPG',
  'image/webp': 'WEBP',
}

function safeFilename(name) {
  const cleaned = name
    .normalize('NFKC')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 160)
  return cleaned || 'material'
}

function formatBytes(bytes) {
  if (!bytes) return '0 KB'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

export default function MaterialsPage() {
  const fileInput = useRef(null)
  const [subjects, setSubjects] = useState([])
  const [selectedSubject, setSelectedSubject] = useState('')
  const [materials, setMaterials] = useState([])
  const [selectedFiles, setSelectedFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function getUser() {
    const supabase = getSupabaseBrowserClient()
    if (!supabase) return null
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      window.location.href = '/login'
      return null
    }
    return user
  }

  async function loadMaterials(subjectId) {
    const supabase = getSupabaseBrowserClient()
    if (!supabase || !subjectId) {
      setMaterials([])
      return
    }

    const { data, error: queryError } = await supabase
      .from('materials')
      .select('id,subject_id,file_name,mime_type,file_size,storage_path,processing_status,processing_error,uploaded_at')
      .eq('subject_id', subjectId)
      .order('uploaded_at', { ascending: false })

    if (queryError) setError(queryError.message)
    else setMaterials(data || [])
  }

  useEffect(() => {
    async function load() {
      const supabase = getSupabaseBrowserClient()
      const user = await getUser()
      if (!supabase || !user) return

      const { data, error: subjectError } = await supabase
        .from('subjects')
        .select('id,name')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })

      if (subjectError) setError(subjectError.message)
      else {
        const rows = data || []
        setSubjects(rows)
        if (rows[0]) setSelectedSubject(rows[0].id)
      }
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    if (selectedSubject) loadMaterials(selectedSubject)
  }, [selectedSubject])

  function addFiles(fileList) {
    setError('')
    setNotice('')
    const incoming = Array.from(fileList || [])
    const valid = []
    const rejected = []

    for (const file of incoming) {
      if (!ACCEPTED_TYPES[file.type]) rejected.push(`${file.name}: unsupported file type`)
      else if (file.size > MAX_FILE_SIZE) rejected.push(`${file.name}: larger than 50 MB`)
      else valid.push(file)
    }

    setSelectedFiles(current => {
      const existing = new Set(current.map(file => `${file.name}:${file.size}:${file.lastModified}`))
      return [...current, ...valid.filter(file => !existing.has(`${file.name}:${file.size}:${file.lastModified}`))]
    })

    if (rejected.length) setError(rejected.join(' • '))
  }

  function removeFile(index) {
    setSelectedFiles(current => current.filter((_, itemIndex) => itemIndex !== index))
  }

  async function uploadFiles() {
    if (!selectedSubject || selectedFiles.length === 0) return
    setUploading(true)
    setError('')
    setNotice('')

    const supabase = getSupabaseBrowserClient()
    const user = await getUser()
    if (!supabase || !user) return

    const subject = subjects.find(item => item.id === selectedSubject)
    const failures = []
    let completed = 0

    for (const file of selectedFiles) {
      const filename = `${crypto.randomUUID()}-${safeFilename(file.name)}`
      const storagePath = `${user.id}/${selectedSubject}/${filename}`

      const { error: uploadError } = await supabase.storage
        .from('study-materials')
        .upload(storagePath, file, { contentType: file.type, upsert: false })

      if (uploadError) {
        failures.push(`${file.name}: ${uploadError.message}`)
        continue
      }

      const { error: materialError } = await supabase.from('materials').insert({
        user_id: user.id,
        subject_id: selectedSubject,
        file_name: file.name,
        mime_type: file.type,
        file_size: file.size,
        storage_path: storagePath,
        processing_status: 'uploaded',
        uploaded_at: new Date().toISOString(),
      })

      if (materialError) {
        await supabase.storage.from('study-materials').remove([storagePath])
        failures.push(`${file.name}: ${materialError.message}`)
        continue
      }

      completed += 1
    }

    setSelectedFiles([])
    await loadMaterials(selectedSubject)
    setUploading(false)

    if (failures.length) setError(failures.join(' • '))
    if (completed) setNotice(`${completed} material${completed === 1 ? '' : 's'} uploaded to ${subject?.name || 'your subject'}.`)
  }

  async function deleteMaterial(material) {
    if (!window.confirm(`Delete ${material.file_name || 'this material'}?`)) return
    const supabase = getSupabaseBrowserClient()
    if (!supabase) return

    setError('')
    const { error: storageError } = material.storage_path
      ? await supabase.storage.from('study-materials').remove([material.storage_path])
      : { error: null }

    if (storageError) {
      setError(storageError.message)
      return
    }

    const { error: dbError } = await supabase.from('materials').delete().eq('id', material.id)
    if (dbError) setError(dbError.message)
    else setMaterials(current => current.filter(item => item.id !== material.id))
  }

  if (loading) {
    return <main className="shell dashboard-loading"><div className="loader-card"><div className="brand">TIA<span>LO</span></div><p>Loading your materials…</p></div></main>
  }

  return (
    <main className="shell" style={{ minHeight: '100vh' }}>
      <nav className="nav">
        <a className="brand" href="/dashboard">TIA<span>LO</span></a>
        <a className="btn secondary" href="/dashboard">Back to dashboard</a>
      </nav>

      <section className="section" style={{ paddingTop: 56 }}>
        <div className="eyebrow">Stage 5 · Materials</div>
        <h1 style={{ fontSize: 'clamp(40px, 6vw, 64px)', margin: '18px 0 8px' }}>Your study materials</h1>
        <p className="muted" style={{ maxWidth: 760, lineHeight: 1.7 }}>
          Upload your own notes, textbooks and presentations. These files stay private to your account and will become the source material for TIALO’s academic tools.
        </p>

        {subjects.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 32 }}>
            <div className="empty-icon">▣</div>
            <h3>Add a subject first</h3>
            <p>Create a subject before uploading study material.</p>
            <a className="btn primary" href="/subjects" style={{ marginTop: 14 }}>Go to subjects</a>
          </div>
        ) : (
          <>
            <div className="panel" style={{ marginTop: 32 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 800, marginBottom: 10 }}>Upload to subject</label>
              <select value={selectedSubject} onChange={event => setSelectedSubject(event.target.value)} style={{ width: '100%', padding: '14px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,.12)', background: '#0c1a2b', color: '#fff' }}>
                {subjects.map(subject => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
              </select>

              <div
                onDragOver={event => { event.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={event => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files) }}
                onClick={() => fileInput.current?.click()}
                style={{ marginTop: 18, border: `1px dashed ${dragging ? 'rgba(69,230,161,.8)' : 'rgba(255,255,255,.18)'}`, background: dragging ? 'rgba(69,230,161,.08)' : 'rgba(255,255,255,.02)', borderRadius: 18, padding: '42px 24px', textAlign: 'center', cursor: 'pointer', transition: 'all .2s' }}
              >
                <div style={{ fontSize: 28, marginBottom: 10 }}>↑</div>
                <strong>Drop files here or click to browse</strong>
                <p className="muted" style={{ margin: '9px 0 0', fontSize: 12 }}>PDF, DOCX, PPTX, PNG, JPG or WEBP · Maximum 50 MB per file</p>
                <input ref={fileInput} type="file" hidden multiple accept=".pdf,.docx,.pptx,.png,.jpg,.jpeg,.webp" onChange={event => addFiles(event.target.files)} />
              </div>

              {selectedFiles.length > 0 && (
                <div style={{ marginTop: 18, display: 'grid', gap: 8 }}>
                  {selectedFiles.map((file, index) => (
                    <div key={`${file.name}-${file.lastModified}`} className="card" style={{ padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                      <div style={{ minWidth: 0 }}><strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</strong><span className="muted" style={{ fontSize: 11 }}>{ACCEPTED_TYPES[file.type]} · {formatBytes(file.size)}</span></div>
                      <button type="button" className="btn secondary" onClick={event => { event.stopPropagation(); removeFile(index) }}>Remove</button>
                    </div>
                  ))}
                  <button className="btn primary" type="button" onClick={uploadFiles} disabled={uploading}>{uploading ? 'Uploading…' : `Upload ${selectedFiles.length} material${selectedFiles.length === 1 ? '' : 's'}`}</button>
                </div>
              )}
            </div>

            {error && <div className="notice" style={{ marginTop: 18 }}>{error}</div>}
            {notice && <div className="notice" style={{ marginTop: 18, borderColor: 'rgba(69,230,161,.2)', background: 'rgba(69,230,161,.05)', color: '#9dd9be' }}>{notice}</div>}

            <section style={{ marginTop: 42 }}>
              <div className="section-heading"><div><span className="section-kicker">UPLOADED</span><h2>{subjects.find(item => item.id === selectedSubject)?.name || 'Subject'} materials</h2><p>Private files stored in your TIALO workspace.</p></div></div>
              {materials.length === 0 ? (
                <div className="empty-state"><div className="empty-icon">□</div><h3>No materials uploaded yet</h3><p>Upload your first study file above. Processing and AI learning features will be connected in the next stages.</p></div>
              ) : (
                <div className="grid">
                  {materials.map(material => (
                    <article className="card" key={material.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                        <div style={{ minWidth: 0 }}>
                          <div className="eyebrow" style={{ fontSize: 9 }}>{ACCEPTED_TYPES[material.mime_type] || 'FILE'}</div>
                          <h3 style={{ marginTop: 14, overflowWrap: 'anywhere' }}>{material.file_name || 'Untitled material'}</h3>
                          <p>{formatBytes(material.file_size)} · {material.processing_status || 'uploaded'}</p>
                        </div>
                        <button className="btn secondary" onClick={() => deleteMaterial(material)}>Delete</button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </section>
    </main>
  )
}
