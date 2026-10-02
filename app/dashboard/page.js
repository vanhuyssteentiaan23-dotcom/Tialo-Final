'use client'
import {useEffect,useMemo,useRef,useState} from 'react'
import {getSupabaseBrowserClient} from '../../lib/supabase'

const nav=[['Overview','⌂','/dashboard'],['Subjects','▱','/subjects'],['Summaries','▤','/summaries'],['AI Tutor','✦','/ai-tutor'],['Mock Exams','□','/mock-exams'],['Daily Tasks','✓','/daily-tasks'],['Progress','↗','/progress'],['Settings','⚙','/settings']]
const day=v=>new Date(v).toISOString().slice(0,10)
const age=dob=>{if(!dob)return null;const d=new Date(dob+'T00:00:00'),n=new Date();let a=n.getFullYear()-d.getFullYear();if(n.getMonth()<d.getMonth()||(n.getMonth()===d.getMonth()&&n.getDate()<d.getDate()))a--;return a}

export default function Dashboard(){
 const [user,setUser]=useState(null),[profile,setProfile]=useState(null),[subjects,setSubjects]=useState([]),[exams,setExams]=useState([]),[materials,setMaterials]=useState([]),[tasks,setTasks]=useState([]),[loading,setLoading]=useState(true),[mobile,setMobile]=useState(false),[error,setError]=useState(''),[avatarBusy,setAvatarBusy]=useState(false),[avatarNotice,setAvatarNotice]=useState(''),[avatarMenuOpen,setAvatarMenuOpen]=useState(false),[avatarViewOpen,setAvatarViewOpen]=useState(false)
 const avatarInput=useRef(null)
 const [selectedSubjectId,setSelectedSubjectId]=useState('')
 const [dashboardFeature,setDashboardFeature]=useState('')
 const [flashcards,setFlashcards]=useState([])
 const [flashcardDraft,setFlashcardDraft]=useState({front:'',back:'',notes:'',subjectId:''})
 const [assignments,setAssignments]=useState([])
 const [assignmentGiven,setAssignmentGiven]=useState('')
 const [assignmentDone,setAssignmentDone]=useState('')
 const [visualQuestion,setVisualQuestion]=useState('')
 const [voiceState,setVoiceState]=useState('idle')
 const [voiceSeconds,setVoiceSeconds]=useState(0)
 const mediaRecorderRef=useRef(null)
 const voiceTimerRef=useRef(null)

 useEffect(()=>{async function load(){const s=getSupabaseBrowserClient();if(!s){location.href='/login';return}const {data:{user:u}}=await s.auth.getUser();if(!u){location.href='/login';return}const {data:p}=await s.from('profiles').select('full_name,date_of_birth,role,avatar_url').eq('id',u.id).maybeSingle();if(!p?.full_name||!p?.date_of_birth||!p?.role){location.href='/onboarding';return}if(p.role==='parent'&&age(p.date_of_birth)>=18){location.href='/parent';return}if(p.role==='student'&&age(p.date_of_birth)<16){const {data:l}=await s.from('parent_child').select('id').eq('child_id',u.id).eq('status','active').limit(1).maybeSingle();if(!l){location.href='/parent-link';return}}
 const [a,b,c,d]=await Promise.all([s.from('subjects').select('id,name').eq('user_id',u.id).order('created_at',{ascending:true}),s.from('exam_attempts').select('id,title,score,total_marks,completed_at,subjects(name)').eq('user_id',u.id).eq('status','completed').order('completed_at',{ascending:false}).limit(12),s.from('materials').select('id,subject_id').eq('user_id',u.id),s.from('daily_study_tasks').select('id,title,completed,estimated_minutes,task_date,completed_at,subjects(name)').eq('user_id',u.id).order('task_date',{ascending:true})]);setUser(u);setProfile(p);setSubjects(a.data||[]);setExams(b.data||[]);setMaterials(c.data||[]);setTasks(d.data||[]);try{setFlashcards(JSON.parse(localStorage.getItem('tialo_flashcards')||'[]'));setAssignments(JSON.parse(localStorage.getItem('tialo_assignments')||'[]'))}catch{}if(a.error||b.error||c.error||d.error)setError('Some workspace data is still loading.');setLoading(false)}load()},[])

 const first=profile?.full_name?.trim().split(/\s+/)[0]||'Student'
 const pending=tasks.filter(t=>!t.completed),done=tasks.filter(t=>t.completed)
 const average=useMemo(()=>{const x=exams.filter(e=>Number(e.total_marks)>0).map(e=>Number(e.score||0)/Number(e.total_marks)*100);return x.length?Math.round(x.reduce((a,b)=>a+b,0)/x.length):null},[exams])
 const streak=useMemo(()=>{const days=new Set(done.map(t=>t.completed_at?day(t.completed_at):t.task_date));let n=0,d=new Date();while(days.has(day(d))){n++;d.setDate(d.getDate()-1)}return n},[done])
 const chart=useMemo(()=>exams.slice().reverse().slice(-7),[exams])

 function persistFlashcards(next){setFlashcards(next);localStorage.setItem('tialo_flashcards',JSON.stringify(next))}
 function saveFlashcard(){if(!flashcardDraft.front.trim()||!flashcardDraft.back.trim())return;persistFlashcards([{id:Date.now(),...flashcardDraft,subjectId:flashcardDraft.subjectId||selectedSubjectId||subjects[0]?.id||'',createdAt:new Date().toISOString()},...flashcards]);setFlashcardDraft({front:'',back:'',notes:'',subjectId:''})}
 function saveAssignment(){if(!assignmentGiven.trim()||!assignmentDone.trim())return;const subject=subjects.find(s=>s.id===selectedSubjectId);const reference=materials.filter(m=>m.subject_id===selectedSubjectId).length;const feedback=reference?'Checked against the study material connected to this subject. Review the concepts and improve your explanation with evidence, examples or diagrams.':'Add study material to this subject first so TIALO can check the work against the learner material.';const item={id:Date.now(),given:assignmentGiven,done:assignmentDone,subjectId:selectedSubjectId,subjectName:subject?.name||'Subject',feedback,createdAt:new Date().toISOString()};const next=[item,...assignments];setAssignments(next);localStorage.setItem('tialo_assignments',JSON.stringify(next));setAssignmentGiven('');setAssignmentDone('')}
 function startVoice(){if(!navigator.mediaDevices?.getUserMedia){setVoiceState('unsupported');return}navigator.mediaDevices.getUserMedia({audio:true}).then(stream=>{const r=new MediaRecorder(stream);mediaRecorderRef.current=r;r.start();setVoiceState('recording');setVoiceSeconds(0);voiceTimerRef.current=setInterval(()=>setVoiceSeconds(v=>v+1),1000);r.onstop=()=>{stream.getTracks().forEach(t=>t.stop());clearInterval(voiceTimerRef.current);setVoiceState('ready')}}).catch(()=>setVoiceState('denied'))}
 function stopVoice(){mediaRecorderRef.current?.stop()}
 const xp=Math.min(99999,subjects.length*150+exams.length*120+done.length*40+flashcards.length*20)
 const level=Math.min(1000,Math.floor(xp/100)+1)
 const badge=Math.floor((level-1)/50)+1
 const selectedSubject=subjects.find(s=>s.id===selectedSubjectId)
 function openAvatarPicker(){setAvatarMenuOpen(false);setAvatarNotice('');avatarInput.current?.click()}
 function handleAvatarClick(){if(profile?.avatar_url)setAvatarMenuOpen(true);else openAvatarPicker()}
 function viewAvatar(){setAvatarMenuOpen(false);setAvatarViewOpen(true)}
 async function handleAvatarChange(e){
  const file=e.target.files?.[0]
  e.target.value=''
  if(!file)return
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)){setAvatarNotice('Please choose a JPG, PNG, or WEBP image.');return}
  if(file.size>5*1024*1024){setAvatarNotice('Please choose an image smaller than 5 MB.');return}
  const s=getSupabaseBrowserClient()
  if(!s||!user)return
  setAvatarBusy(true);setAvatarNotice('')
  const path=user.id+'/avatar'
  const {error:uploadError}=await s.storage.from('avatars').upload(path,file,{upsert:true,contentType:file.type,cacheControl:'3600'})
  if(uploadError){setAvatarBusy(false);setAvatarNotice('Could not upload your avatar. Please try again.');return}
  const {data:publicData}=s.storage.from('avatars').getPublicUrl(path)
  const avatarUrl=(publicData?.publicUrl||'')+'?v='+Date.now()
  const {error:updateError}=await s.from('profiles').update({avatar_url:avatarUrl}).eq('id',user.id)
  if(updateError){setAvatarBusy(false);setAvatarNotice('The image uploaded, but your profile could not be updated.');return}
  setProfile(p=>({...p,avatar_url:avatarUrl}))
  setAvatarBusy(false)
  setAvatarNotice('Avatar updated.')
 }

 async function signOut(){const s=getSupabaseBrowserClient();await s?.auth.signOut();location.href='/'}
 if(loading)return <main className="new-loading"><div className="new-logo">TIA<span>LO</span></div><span>Opening your workspace…</span></main>
 return <main className="dashboard-shell tialo-workspace">
  <style>{`
   .avatar-picker{position:relative;border:0;padding:0;background:transparent;cursor:pointer;display:inline-flex;align-items:center;justify-content:center}
   .avatar-picker:focus-visible{outline:2px solid #63f77b;outline-offset:3px;border-radius:50%}
   .avatar-image{width:100%;height:100%;display:block;border-radius:50%;object-fit:cover}
   .avatar-fallback{width:100%;height:100%;display:flex;align-items:center;justify-content:center;border-radius:50%;background:#65f477;color:#07100a;font-weight:900}
   .new-header-avatar{width:34px;height:34px;flex:none}
   .sidebar-avatar{width:32px;height:32px;flex:none}
   .avatar-camera{position:absolute;right:-2px;bottom:-2px;width:15px;height:15px;border-radius:50%;background:#101512;color:#63f77b;border:2px solid #101512;display:flex;align-items:center;justify-content:center;font-size:8px;line-height:1}
   .avatar-status{position:fixed;right:24px;bottom:24px;z-index:30;background:#101512;color:#fff;border:1px solid rgba(99,247,123,.35);border-radius:10px;padding:9px 12px;font-size:11px;box-shadow:0 10px 30px rgba(0,0,0,.2)}
   .sidebar-profile{display:flex;align-items:center;gap:10px;min-width:0}
   .sidebar-profile-name{font-size:11px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
   .sidebar-profile-button{display:flex;align-items:center;gap:10px;border:0;background:transparent;color:inherit;padding:0;cursor:pointer;text-align:left;min-width:0}
   .sidebar-profile-button:hover .sidebar-profile-name{text-decoration:underline}
   .avatar-action-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.42);z-index:80;display:flex;align-items:center;justify-content:center;padding:20px}
   .avatar-action-card{width:min(360px,100%);background:#fff;color:#101512;border:1px solid #dfe7df;border-radius:18px;padding:20px;box-shadow:0 24px 70px rgba(0,0,0,.28)}
   .avatar-action-card h3{margin:0 0 6px;font-size:18px}.avatar-action-card p{margin:0 0 16px;color:#66736a;font-size:12px}
   .avatar-action-preview{width:84px;height:84px;border-radius:50%;object-fit:cover;display:block;margin:0 auto 18px;border:3px solid #eaf2ea}
   .avatar-action-buttons{display:grid;gap:9px}.avatar-action-buttons button{border:1px solid #d9e3d9;border-radius:10px;padding:11px 13px;background:#fff;color:#101512;font-weight:800;cursor:pointer}.avatar-action-buttons button.primary{background:#101512;color:#fff;border-color:#101512}.avatar-action-close{margin-top:10px;width:100%;border:0;background:transparent;color:#69756d;padding:8px;cursor:pointer;font-size:11px}
   .avatar-view-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.78);z-index:90;display:flex;align-items:center;justify-content:center;padding:28px}
   .avatar-view-image{max-width:min(80vw,720px);max-height:80vh;width:auto;height:auto;object-fit:contain;border-radius:16px;box-shadow:0 25px 80px rgba(0,0,0,.45);background:#fff}
   .avatar-view-close{position:fixed;right:24px;top:20px;width:38px;height:38px;border:1px solid rgba(255,255,255,.35);border-radius:50%;background:rgba(0,0,0,.4);color:#fff;font-size:22px;cursor:pointer}
   .dashboard-feature-select,.planner-grid,.dashboard-tool-panel{margin-top:22px}
   .dashboard-tool-panel{min-height:250px}
   .feature-layout{padding:24px}
   .feature-header{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:20px}
   .feature-header h2{margin:5px 0 7px;font-size:28px;letter-spacing:-.03em;color:#f5f7fb}
   .feature-header p{margin:0;color:#8e9bad;max-width:700px;line-height:1.5}
   .feature-card-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
   .feature-card-grid.two{grid-template-columns:1fr 1fr}
   .feature-card{display:grid;gap:10px;padding:18px;background:#151f2f;border:1px solid rgba(255,255,255,.07);border-radius:13px}
   .feature-card.full{grid-column:1/-1}
   .feature-card label,.feature-stat b{font-size:9px;letter-spacing:.16em;color:#a99aff;font-weight:900}
   .feature-card input,.feature-card textarea{width:100%;box-sizing:border-box;background:#0f1827;color:#eef2f7;border:1px solid rgba(255,255,255,.09);border-radius:9px;padding:12px;font:inherit;resize:vertical;min-height:52px}
   .feature-card textarea{min-height:105px}
   .feature-card strong{font-size:17px;color:#f5f7fb}
   .feature-card span{color:#8e9bad;font-size:12px;line-height:1.5}
   .feature-card a{color:#62d9cf;font-size:12px;font-weight:800}
   .feature-stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:20px}
   .feature-stat{display:grid;gap:5px;padding:16px;background:#151f2f;border:1px solid rgba(255,255,255,.07);border-radius:13px}
   .feature-stat strong{font-size:28px;color:#f5f7fb}.feature-stat span{font-size:11px;color:#8e9bad}
   .feature-visual{display:grid;grid-template-columns:1fr 40px 1fr 40px 1fr;align-items:center;gap:8px}

   .dashboard-tool-panel h2{font-size:28px;letter-spacing:-.03em}
   .dashboard-tool-panel .new-kicker{letter-spacing:.22em}
   .dashboard-tool-panel input,.dashboard-tool-panel textarea,.dashboard-tool-panel select{font-family:inherit}
   .dashboard-tool-panel .new-primary{margin-top:8px}
   .dashboard-tool-panel .saved-tool-item{background:#151f2f;border:1px solid rgba(255,255,255,.07);padding:16px}
   .dashboard-tool-panel .saved-tool-item b{color:#f5f7fb}
   .dashboard-tool-panel .saved-tool-item span{color:#9aa8bb;line-height:1.5}
   .dashboard-tool-panel .saved-tool-item small{color:#a99aff}
   .tool-form-grid{align-items:start}
   .tool-form-grid input,.tool-form-grid textarea,.assignment-columns textarea,.dashboard-tool-panel>textarea{font-size:13px;line-height:1.5}
   .assignment-columns{margin-top:20px}
   .assignment-columns label{letter-spacing:.12em;text-transform:uppercase}
   .visual-result .visual-placeholder{min-height:150px;padding:10px 0}
   .visual-result .visual-node{background:#151f2f;border-color:rgba(128,103,255,.28);padding:20px}
   .xp-panel{min-height:220px}
   .xp-grid span{background:#151f2f}

   .sidebar-tools{margin-top:24px;padding-top:18px;border-top:1px solid rgba(255,255,255,.07);display:grid;gap:3px}
   .sidebar-tool-subject select{width:100%;box-sizing:border-box;background:#101a29;color:#aeb9c9;border:1px solid rgba(255,255,255,.09);border-radius:8px;padding:7px 8px;font-size:10px;margin-bottom:5px}
   .side-tool-link{display:flex;align-items:center;gap:13px;width:100%;border:0;background:transparent;color:#8f9caf;padding:12px;border-radius:11px;font-size:14px;font-weight:700;text-align:left;cursor:pointer;transition:background .18s ease,color .18s ease,transform .18s ease}
   .side-tool-link span{width:20px;text-align:center;font-size:16px}
   .side-tool-link:hover{background:rgba(255,255,255,.045);color:#eef4fb;transform:translateX(2px)}
   .side-tool-link.active{background:linear-gradient(90deg,rgba(69,230,161,.12),rgba(69,230,161,.045));color:#fff;box-shadow:inset 2px 0 0 #45e6a1}
   .side-tool-link.active span{color:#45e6a1}

   .dashboard-tools-live{margin-top:22px;padding:24px;border:1px solid rgba(128,103,255,.24);border-radius:20px;background:linear-gradient(145deg,#111b2a,#0d1624);box-shadow:0 20px 55px rgba(0,0,0,.18)}
   .dashboard-tools-heading{display:flex;justify-content:space-between;align-items:end;gap:20px;margin-bottom:18px}
   .dashboard-tools-heading h2{margin:4px 0 7px;color:#f5f7fb}.dashboard-tools-heading p{margin:0;color:#8995a8;max-width:700px}
   .dashboard-tools-heading select{min-width:190px;background:#101a29;color:#f4f7fb;border:1px solid rgba(255,255,255,.14);border-radius:10px;padding:11px 12px}
   .dashboard-tools-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
   .dashboard-tool-card{min-height:116px;display:flex;align-items:center;gap:13px;text-align:left;padding:17px;border:1px solid rgba(255,255,255,.08);border-radius:15px;background:rgba(255,255,255,.035);color:#f4f7fb;cursor:pointer;transition:.18s ease}
   .dashboard-tool-card:hover{transform:translateY(-2px);border-color:rgba(98,217,207,.38);background:rgba(98,217,207,.06)}
   .dashboard-tool-card.planner{border-color:rgba(128,103,255,.38);background:rgba(128,103,255,.08)}
   .tool-card-icon{width:38px;height:38px;flex:none;display:flex;align-items:center;justify-content:center;border-radius:11px;background:rgba(128,103,255,.12);color:#a99aff;font-size:17px}
   .tool-card-copy{display:grid;gap:5px;min-width:0;flex:1}.tool-card-copy b{font-size:13px}.tool-card-copy small{font-size:10px;line-height:1.45;color:#8995a8}.dashboard-tool-card i{color:#62d9cf;font-style:normal;font-size:17px}

   .new-content.subject-view .welcome-row,.new-content.subject-view .today-grid,.new-content.subject-view .dashboard-block,.new-content.subject-view .insight-grid,.new-content.subject-view .tool-strip{display:none}
   .new-content.tool-view .welcome-row,.new-content.tool-view .today-grid,.new-content.tool-view .dashboard-block,.new-content.tool-view .planner-grid,.new-content.tool-view .subject-visual-panel,.new-content.tool-view .insight-grid,.new-content.tool-view .tool-strip{display:none}
   .dashboard-feature-select{display:flex;justify-content:space-between;gap:20px;align-items:end;padding:22px;border:1px solid rgba(255,255,255,.08);border-radius:18px;background:linear-gradient(145deg,#111b2a,#0d1624);box-shadow:0 18px 45px rgba(0,0,0,.16)}
   .dashboard-feature-select h2,.dashboard-tool-panel h2,.planner-grid h2{margin:4px 0 7px;color:#f5f7fb}.dashboard-feature-select p,.dashboard-tool-panel p,.planner-grid p{margin:0;color:#8995a8}
   .dashboard-feature-controls{display:flex;gap:10px;flex-wrap:wrap}.dashboard-feature-controls select,.tool-form-grid input,.tool-form-grid textarea,.assignment-columns textarea,.dashboard-tool-panel>textarea{background:#101a29;color:#f4f7fb;border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:11px 12px}
   .planner-grid{display:grid;grid-template-columns:1.5fr 1fr;gap:16px}.planner-grid article{padding:22px;border-radius:18px;background:linear-gradient(145deg,#111b2a,#0d1624);border:1px solid rgba(255,255,255,.08)}
   .planner-list{display:grid;gap:10px;margin-top:16px}.planner-list div{display:grid;gap:4px;padding:13px;border-radius:12px;background:rgba(255,255,255,.035)}.planner-list b{color:#f5f7fb}.planner-list span{font-size:12px;color:#8995a8}
   .dashboard-tool-panel{padding:24px;border-radius:20px;background:linear-gradient(145deg,#111b2a,#0d1624);border:1px solid rgba(128,103,255,.20);box-shadow:0 20px 55px rgba(0,0,0,.18)}
   .tool-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px}.tool-form-grid textarea{min-height:110px}.tool-form-grid button{justify-self:start}
   .saved-tool-item{display:grid;gap:5px;margin-top:12px;padding:14px;border-radius:12px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.07);color:#dce3ec}.saved-tool-item span{color:#9aa8bb;font-size:12px}.saved-tool-item small{color:#a99aff}
   .assignment-columns{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:16px 0}.assignment-columns div{display:grid;gap:7px}.assignment-columns label{font-size:11px;font-weight:800;color:#62d9cf}.assignment-columns textarea{min-height:150px}
   .xp-panel{display:grid;grid-template-columns:1fr 1.4fr;gap:20px}.xp-bar{height:10px;border-radius:20px;background:#080d18;overflow:hidden;margin-top:12px}.xp-bar i{display:block;height:100%;background:linear-gradient(90deg,#8067ff,#62d9cf)}.xp-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.xp-grid span{padding:12px;border:1px solid rgba(255,255,255,.07);border-radius:12px;color:#9aa8bb;font-size:12px}.xp-grid b{color:#f5f7fb}.xp-badge{color:#62d9cf!important;border-color:rgba(98,217,207,.25)!important}
   .visual-result{text-align:center}.visual-placeholder{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;margin:20px 0}.visual-node{min-width:150px;padding:18px;border-radius:14px;background:rgba(128,103,255,.10);border:1px solid rgba(128,103,255,.3);color:#a99aff;font-size:10px}.visual-node b{display:block;margin-top:5px;color:#f4f7fb;font-size:12px}.visual-arrow{color:#62d9cf;font-size:20px}.tool-error{color:#ff9b8b!important}
   @media(max-width:850px){.dashboard-feature-select,.xp-panel{display:grid;grid-template-columns:1fr}.planner-grid,.assignment-columns,.tool-form-grid,.feature-card-grid,.feature-stat-grid{grid-template-columns:1fr}.feature-card.full{grid-column:auto}.feature-header{display:grid}.feature-visual{grid-template-columns:1fr}.dashboard-feature-controls{width:100%}.dashboard-feature-controls select{width:100%}}
 `}</style>
  <input ref={avatarInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarChange} hidden/>
  <aside className="sidebar"><a className="brand" href="/dashboard">TIA<span>LO</span></a><div className="sidebar-label">Workspace</div><nav className="sidebar-nav">{nav.map(([label,icon,href])=><a className={'side-link '+(href==='/dashboard'?'active':'')} href={href} key={href}><span>{icon}</span>{label}{href==='/daily-tasks'&&pending.length>0?<b>{pending.length}</b>:null}</a>)}</nav><div className="sidebar-tools"><div className="sidebar-label">Study Tools</div><div className="sidebar-tool-subject"><select value={selectedSubjectId} onChange={e=>{setSelectedSubjectId(e.target.value);setDashboardFeature('')}}><option value="">Subject</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div><button className={'side-tool-link '+(selectedSubjectId&&!dashboardFeature?'active':'')} onClick={()=>{if(!selectedSubjectId&&subjects[0])setSelectedSubjectId(subjects[0].id);setDashboardFeature('')}}><span>◈</span>Study Planner</button><button className={'side-tool-link '+(dashboardFeature==="flashcards"?'active':'')} onClick={()=>setDashboardFeature("flashcards")}><span>▣</span>Flashcards</button><button className={'side-tool-link '+(dashboardFeature==="assignment"?'active':'')} onClick={()=>setDashboardFeature("assignment")}><span>✓</span>AI Assignment Checker</button><button className={'side-tool-link '+(dashboardFeature==="xp"?'active':'')} onClick={()=>setDashboardFeature("xp")}><span>★</span>Level XP</button><button className={'side-tool-link '+(dashboardFeature==="voice"?'active':'')} onClick={()=>setDashboardFeature("voice")}><span>◉</span>AI Tutor Voice</button><button className={'side-tool-link '+(dashboardFeature==="visual"?'active':'')} onClick={()=>setDashboardFeature("visual")}><span>△</span>Visual Learning</button></div><div className="sidebar-bottom"><div className="sidebar-profile"><button type="button" className="sidebar-profile-button" onClick={handleAvatarClick} title={profile?.avatar_url?"View or change profile photo":"Add profile photo"} aria-label={profile?.avatar_url?"View or change profile photo":"Add profile photo"}><span className="avatar-picker sidebar-avatar">{profile?.avatar_url?<img className="avatar-image" src={profile.avatar_url} alt="Profile" />:<span className="avatar-fallback">{first[0]?.toUpperCase()}</span>}<span className="avatar-camera">+</span></span><span className="sidebar-profile-name">{first}</span></button></div><button className="side-signout" onClick={signOut}>Sign out</button></div></aside>
  <section className="dashboard-main">
   <header className="new-header"><button className="new-menu" onClick={()=>setMobile(true)}>☰</button><div><strong>{selectedSubject?'Study Planner':'Overview'}</strong><span> / {new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}</span></div><div className="new-header-user">{first}<button type="button" className="avatar-picker new-header-avatar" onClick={handleAvatarClick} title={profile?.avatar_url?"View or change profile photo":"Add profile photo"} aria-label={profile?.avatar_url?"View or change profile photo":"Add profile photo"}>{profile?.avatar_url?<img className="avatar-image" src={profile.avatar_url} alt="Profile" />:<span className="avatar-fallback">{first[0]?.toUpperCase()}</span>}<span className="avatar-camera">+</span></button></div></header>
   <div className={'new-content '+(selectedSubject&&!dashboardFeature?'subject-view':dashboardFeature?'tool-view':'overview-view')}>
    <section className="welcome-row"><div><div className="new-kicker">GOOD MORNING, {first.toUpperCase()}</div><h1>What are you<br/><i>working on?</i></h1><p>Pick one thing. TIALO will help you make progress without the noise.</p></div><a className="new-primary" href="/ai-tutor">Ask TIALO <span>↗</span></a></section>
    {error&&<div className="new-notice">{error}</div>}
    <section className="today-grid">
      <div className="today-main"><div className="new-kicker">UP NEXT</div><h2>{pending[0]?.title||'You are all caught up.'}</h2><p>{pending[0]?((pending[0].subjects?.name||'Study session')+' · '+(pending[0].estimated_minutes||15)+' min'): 'Choose a subject or ask TIALO something new.'}</p><div className="today-actions">{pending[0]&&<a className="new-primary small" href="/daily-tasks">Continue →</a>}<a className="new-ghost" href="/subjects">Browse subjects</a></div></div>
      <div className="today-side"><div className="today-number">{streak}</div><span>day{streak===1?'':'s'} in a row</span><div className="mini-dots">{[0,1,2,3,4,5,6].map(i=><i className={i<Math.min(streak,7)?'on':''} key={i}/>)}</div></div>
    </section>
    {selectedSubject ? <section className="planner-grid">
      <article><div className="new-kicker">STUDY PLANNER</div><h2>{selectedSubject.name}</h2><div className="planner-list"><div><b>Weaknesses</b><span>Use recent exam results and completed work to focus revision.</span></div><div><b>Deadlines</b><span>{pending.length?pending.slice(0,3).map(t=>t.title).join(' · '):'No upcoming dashboard tasks.'}</span></div><div><b>Study material needed</b><span>{materials.filter(m=>m.subject_id===selectedSubject.id).length} connected material item(s)</span></div></div></article>
      <article><div className="new-kicker">NEXT ACTION</div><h3>{pending.find(t=>t.subjects?.name===selectedSubject.name)?.title||'Review your weakest topic'}</h3><p>Work on one focused task, then return to TIALO for feedback.</p><a className="new-primary small" href="/daily-tasks">Open tasks →</a></article>
    </section> : <section className="dashboard-block"><div className="block-head"><div><div className="new-kicker">YOUR SUBJECTS</div><h2>Continue learning</h2></div><a href="/subjects">View all →</a></div>{subjects.length?<div className="new-subject-grid">{subjects.slice(0,4).map(s=>{const count=materials.filter(m=>m.subject_id===s.id).length;return <a className="new-subject" href="/subjects" key={s.id}><span>{String(s.name).slice(0,2).toUpperCase()}</span><h3>{s.name}</h3><p>{count} material{count===1?'':'s'} connected</p><div><i style={{width:count?'42%':'8%'}}/></div></a>})}</div>:<div className="new-empty">Add your first subject to start building your study space. <a href="/subjects">Add subject →</a></div>}</section>}
    {dashboardFeature==='flashcards'&&<section className="dashboard-tool-panel feature-layout"><div className="feature-header"><div><div className="new-kicker">FLASHCARDS</div><h2>Create study cards</h2><p>Turn your study material into quick revision cards with notes, images and graph explanations.</p></div><button className="new-primary" onClick={saveFlashcard}>Save flashcard</button></div><div className="feature-card-grid"><div className="feature-card"><label>FRONT · QUESTION</label><input placeholder="What do you need to remember?" value={flashcardDraft.front} onChange={e=>setFlashcardDraft({...flashcardDraft,front:e.target.value})}/></div><div className="feature-card"><label>BACK · ANSWER / VISUAL</label><textarea placeholder="Answer, summary, image or graph description" value={flashcardDraft.back} onChange={e=>setFlashcardDraft({...flashcardDraft,back:e.target.value})}/></div><div className="feature-card full"><label>NOTES</label><textarea placeholder="Add your own notes..." value={flashcardDraft.notes} onChange={e=>setFlashcardDraft({...flashcardDraft,notes:e.target.value})}/></div></div>{flashcards.slice(0,4).map(f=><div className="saved-tool-item" key={f.id}><b>{f.front}</b><span>{f.back}</span>{f.notes&&<small>Note: {f.notes}</small>}</div>)}</section>}
    {dashboardFeature==='assignment'&&<section className="dashboard-tool-panel feature-layout"><div className="feature-header"><div><div className="new-kicker">AI ASSIGNMENT CHECKER</div><h2>Check your assignment</h2><p>Give TIALO the assignment and your completed work. Feedback stays connected to the selected subject.</p></div><button className="new-primary" onClick={saveAssignment}>Check assignment</button></div><div className="feature-card-grid two"><div className="feature-card"><label>1 · ASSIGNMENT GIVEN</label><textarea value={assignmentGiven} onChange={e=>setAssignmentGiven(e.target.value)} placeholder="Paste or describe the assignment..."/></div><div className="feature-card"><label>2 · ASSIGNMENT DONE</label><textarea value={assignmentDone} onChange={e=>setAssignmentDone(e.target.value)} placeholder="Paste your completed work..."/></div></div>{assignments.slice(0,2).map(a=><div className="saved-tool-item" key={a.id}><b>{a.subjectName} · feedback</b><span>{a.feedback}</span><small>Improve with clearer text, evidence, images or graphs where useful.</small></div>)}</section>}
    {dashboardFeature==='xp'&&<section className="dashboard-tool-panel feature-layout"><div className="feature-header"><div><div className="new-kicker">LEVEL XP</div><h2>Level {level}</h2><p>{xp} XP · {Math.max(0,level*100-xp)} XP to next level</p></div><div className="xp-badge">BADGE {badge}</div></div><div className="xp-bar"><i style={{width:Math.min(100,xp%100)+'%'}}/></div><div className="feature-stat-grid"><div className="feature-stat"><b>Streaks</b><strong>{streak}</strong><span>days in a row</span></div><div className="feature-stat"><b>Subject mastery</b><strong>{average||0}%</strong><span>overall exam average</span></div><div className="feature-stat"><b>Daily goals</b><strong>{done.length}</strong><span>tasks completed</span></div><div className="feature-stat"><b>Achievements</b><strong>{Math.floor(level/10)}</strong><span>unlocked</span></div></div></section>}
    {dashboardFeature==='voice'&&<section className="dashboard-tool-panel feature-layout"><div className="feature-header"><div><div className="new-kicker">AI TUTOR</div><h2>Ask TIALO with your voice</h2><p>Record a question from the Dashboard, then continue to the existing AI Tutor for the answer.</p></div><button className="new-primary" onClick={voiceState==='recording'?stopVoice:startVoice}>{voiceState==='recording'?'Stop recording · '+voiceSeconds+'s':'Start voice question'}</button></div><div className="feature-card-grid two"><div className="feature-card"><label>VOICE QUESTION</label><strong>{voiceState==='recording'?'Listening…':voiceState==='ready'?'Question recorded':'Ready when you are'}</strong><span>Use your microphone to ask naturally.</span></div><div className="feature-card"><label>NEXT ACTION</label><strong>Continue to AI Tutor</strong><span>Send the question there and receive TIALO's answer.</span>{voiceState==='ready'&&<a href="/ai-tutor">Open AI Tutor →</a>}</div></div>{voiceState==='denied'&&<p className="tool-error">Microphone permission was not granted.</p>}{voiceState==='unsupported'&&<p className="tool-error">Voice recording is not supported in this browser.</p>}</section>}
    {dashboardFeature==='visual'&&<section className="dashboard-tool-panel feature-layout"><div className="feature-header"><div><div className="new-kicker">VISUAL LEARNING</div><h2>Ask with visuals</h2><p>Ask a question about your selected subject and build the explanation from its study material.</p></div><button className="new-primary" onClick={()=>setDashboardFeature('visual-result')}>Create visual explanation</button></div><div className="feature-card"><label>YOUR QUESTION</label><textarea value={visualQuestion} onChange={e=>setVisualQuestion(e.target.value)} placeholder="What do you want to understand?"/></div></section>}
    {dashboardFeature==='visual-result'&&<section className="dashboard-tool-panel feature-layout"><div className="feature-header"><div><div className="new-kicker">VISUAL LEARNING</div><h2>Visual explanation</h2><p>Subject: {selectedSubject?.name||'Select a subject'}</p></div><button className="new-ghost" onClick={()=>setDashboardFeature('visual')}>Ask another question</button></div><div className="visual-placeholder feature-visual"><div className="visual-node">QUESTION<br/><b>{visualQuestion}</b></div><div className="visual-arrow">↓</div><div className="visual-node">SUBJECT MATERIAL<br/><b>{selectedSubject?.name||'Select a subject'}</b></div><div className="visual-arrow">↓</div><div className="visual-node">VISUAL OUTPUT<br/><b>Diagram · Graph · Key relationships</b></div></div></section>}
    <section className="insight-grid">
      <article className="insight-card performance"><div className="block-head"><div><div className="new-kicker">PERFORMANCE</div><h2>Recent exam scores</h2></div><strong>{average==null?'—':average+'%'}</strong></div>{chart.length?<div className="new-chart"><svg viewBox="0 0 700 190" preserveAspectRatio="none"><line x1="0" y1="165" x2="700" y2="165"/><line x1="0" y1="85" x2="700" y2="85"/><polyline points={chart.map((e,i)=>{const x=10+(680*i/Math.max(1,chart.length-1)),y=165-(Math.max(0,Math.min(100,Number(e.score||0)/Math.max(1,Number(e.total_marks))*100))/100)*130;return x+','+y}).join(' ')}/>{chart.map((e,i)=>{const x=10+(680*i/Math.max(1,chart.length-1)),y=165-(Math.max(0,Math.min(100,Number(e.score||0)/Math.max(1,Number(e.total_marks))*100))/100)*130;return <circle key={i} cx={x} cy={y} r="4"/>})}</svg><div className="chart-labels">{chart.map((e,i)=><span key={i}>{i===0||i===chart.length-1?new Date(e.completed_at).toLocaleDateString(undefined,{day:'numeric',month:'short'}):''}</span>)}</div></div>:<div className="new-empty">Complete a mock exam and your results will appear here.</div>}</article>
      <article className="insight-card"><div className="new-kicker">ACTIVITY</div><h2>This week</h2><div className="activity-stat"><strong>{done.reduce((a,t)=>a+Number(t.estimated_minutes||0),0)}</strong><span>study minutes</span></div><div className="activity-row"><span>{done.length} tasks completed</span><span>{pending.length} remaining</span></div><a href="/progress">See full progress →</a></article>
    </section>
    <section className="tool-strip"><a href="/summary-studio"><b>▤</b><span><strong>Summaries</strong><small>Make a study summary</small></span><i>→</i></a><a href="/ai-tutor"><b>✦</b><span><strong>Ask TIALO</strong><small>Get an explanation</small></span><i>→</i></a><a href="/mock-exams"><b>□</b><span><strong>Mock exam</strong><small>Test what you know</small></span><i>→</i></a><a href="/daily-tasks"><b>✓</b><span><strong>Today's tasks</strong><small>{pending.length} waiting for you</small></span><i>→</i></a></section>
   </div>
  </section>
  {avatarNotice&&<div className="avatar-status" role="status">{avatarNotice}</div>}
  {avatarMenuOpen&&profile?.avatar_url&&<div className="avatar-action-backdrop" onMouseDown={()=>setAvatarMenuOpen(false)}>
    <div className="avatar-action-card" onMouseDown={e=>e.stopPropagation()}>
      <img className="avatar-action-preview" src={profile.avatar_url} alt="Your profile photo" />
      <h3>Profile photo</h3>
      <p>What would you like to do with your current photo?</p>
      <div className="avatar-action-buttons">
        <button type="button" className="primary" onClick={viewAvatar}>View image</button>
        <button type="button" onClick={openAvatarPicker}>Upload new photo</button>
      </div>
      <button type="button" className="avatar-action-close" onClick={()=>setAvatarMenuOpen(false)}>Cancel</button>
    </div>
  </div>}
  {avatarViewOpen&&profile?.avatar_url&&<div className="avatar-view-backdrop" onMouseDown={()=>setAvatarViewOpen(false)}>
    <button type="button" className="avatar-view-close" onClick={()=>setAvatarViewOpen(false)} aria-label="Close image">×</button>
    <img className="avatar-view-image" src={profile.avatar_url} alt="Your profile photo" onMouseDown={e=>e.stopPropagation()} />
  </div>}
 </main>
}
