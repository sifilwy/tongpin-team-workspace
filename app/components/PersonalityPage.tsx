"use client";
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useMember } from './TeamAccess';
import { PERSONALITY_KEY, emptyPersonality, validPersonality } from '../lib/personality-data.mjs';
import './personality.css';

type Entry = { id: string; date: string; action: string; reflection: string };
type Content = { vision: string; practice: string; entries: Entry[] };
type Document = { revision: number; value: Content };
const dateKey = () => { const date=new Date();return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; };

export default function PersonalityPage({ active }: { active: boolean }) {
  const member=useMember();
  return member === 'xzx' ? <PrivatePage active={active} /> : null;
}

function PrivatePage({ active }: { active: boolean }) {
  const [content,setContent]=useState<Content>(emptyPersonality);
  const [vision,setVision]=useState('');
  const [practice,setPractice]=useState('');
  const [entry,setEntry]=useState<Entry>({id:'',date:'',action:'',reflection:''});
  const [editing,setEditing]=useState(false);
  const [ready,setReady]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [retry,setRetry]=useState(0);
  const [denied,setDenied]=useState(false);
  const guard=useRef({ mounted:true, busy:false, denied:false });
  const abort=useRef<AbortController | null>(null);
  const editor=useRef<HTMLTextAreaElement>(null);
  const dirty=vision!==content.vision || practice!==content.practice || (editing ? JSON.stringify(entry)!==JSON.stringify(content.entries.find(item=>item.id===entry.id)) : !!(entry.action.trim() || entry.reflection.trim()));
  const resetEntry=()=>{setEntry({id:crypto.randomUUID(),date:dateKey(),action:'',reflection:''});setEditing(false);};
  function clearPrivate() {
    guard.current.denied=true;setDenied(true);setReady(false);setContent(emptyPersonality());setVision('');setPractice('');setEntry({id:'',date:'',action:'',reflection:''});setEditing(false);setNotice('');
  }
  async function request(body?: {revision:number;value:Content}) {
    const response=await fetch(`/api/team?key=${PERSONALITY_KEY}`,{
      cache:'no-store',signal:AbortSignal.any([abort.current!.signal,AbortSignal.timeout(15000)]),
      ...(body ? {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:PERSONALITY_KEY,...body})}:{}),
    });
    if(response.status===401 || response.status===403) {if(guard.current.mounted)clearPrivate();throw new Error('登录已过期或无权访问，请使用 xzx 账号重新登录。');}
    const result=await response.json();
    if(!response.ok && response.status!==409)throw new Error(result.error || '暂时连接不上，内容尚未保存。');
    if(result.document!==null && (!result.document || !Number.isInteger(result.document.revision) || !validPersonality(result.document.value)))throw new Error('内容暂时无法读取，请重试。');
    return {conflict:response.status===409,document:(result.document || {revision:0,value:emptyPersonality()}) as Document};
  }
  useEffect(()=>{
    guard.current.mounted=true;abort.current=new AbortController();
    // Recheck the session after returning from browser history or another tab.
    const checkSession=()=>{if(document.visibilityState==='visible' && !guard.current.denied)void request().catch(()=>{});};
    document.addEventListener('visibilitychange',checkSession);window.addEventListener('pageshow',checkSession);
    return ()=>{guard.current.mounted=false;abort.current?.abort();document.removeEventListener('visibilitychange',checkSession);window.removeEventListener('pageshow',checkSession);};
  },[]);
  useEffect(()=>{
    if(!dirty)return;
    const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',warn);return ()=>window.removeEventListener('beforeunload',warn);
  },[dirty]);
  useEffect(()=>{
    if(!active || ready || denied)return;
    let stopped=false;
    void request().then(({document})=>{if(!stopped){setContent(document.value);setVision(document.value.vision);setPractice(document.value.practice);resetEntry();setReady(true);setError('');}}).catch(failure=>{if(!stopped)setError(failure.message);});
    return ()=>{stopped=true;};
  },[active,ready,retry,denied]);
  async function save(update:(latest:Content)=>Content,success:(value:Content)=>void) {
    if(guard.current.busy || !ready || denied)return;
    guard.current.busy=true;setBusy(true);setError('');setNotice('');
    try {
      let {document}=await request();
      for(let attempt=0;attempt<4;attempt++){
        const next=update(document.value);
        const result=await request({revision:document.revision,value:next});
        document=result.document;
        if(!result.conflict){if(guard.current.mounted && !guard.current.denied){setContent(document.value);success(document.value);setNotice('已保存');}return;}
      }
      throw new Error('另一页面正在更新，输入已保留，请再保存一次。');
    } catch(failure) {if(guard.current.mounted)setError(failure instanceof Error?failure.message:'保存失败，输入已保留。');}
    finally {guard.current.busy=false;if(guard.current.mounted)setBusy(false);}
  }
  function saveProfile(event:FormEvent) {
    event.preventDefault();
    const patch:Partial<Content>={};
    if(vision!==content.vision)patch.vision=vision;
    if(practice!==content.practice)patch.practice=practice;
    void save(latest=>({...latest,...patch}),value=>{setVision(value.vision);setPractice(value.practice);});
  }
  function saveEntry(event:FormEvent) {
    event.preventDefault();
    const pending={...entry,action:entry.action.trim(),reflection:entry.reflection.trim()};
    if(!pending.action && !pending.reflection){setError('写下一个行动或一点感受，再保存。');return;}
    void save(latest=>{
      const found=latest.entries.some(item=>item.id===pending.id);
      if(editing && !found)throw new Error('这条记录已在其他页面删除，输入仍保留。');
      return {...latest,entries:found?latest.entries.map(item=>item.id===pending.id?pending:item):[pending,...latest.entries]};
    },value=>{if(vision===content.vision)setVision(value.vision);if(practice===content.practice)setPractice(value.practice);resetEntry();});
  }
  const records=[...content.entries].sort((a,b)=>b.date.localeCompare(a.date));
  return <section className="personality-page" hidden={!active} aria-label="人格改变">
    <header className="personality-heading"><div><span className="personality-eyebrow">给自己的练习</span><h1>人格改变</h1><p>把想成为的样子，落到每一天的小行动里。</p></div><span className="personality-private"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>仅 xzx 可见</span></header>
    {error && <div className="personality-error" role="alert">{error}{!ready && !denied && <button onClick={()=>setRetry(value=>value+1)}>重新连接</button>}</div>}
    {denied ? <p className="personality-empty">请重新登录后查看。</p> : <>
      {!ready && !error && <p className="personality-empty">正在读取你的记录…</p>}
      <div className="personality-columns">
        <form className="personality-card personality-direction" onSubmit={saveProfile}><fieldset disabled={!ready || busy}><span className="personality-number">01 / 改变的方向</span><label htmlFor="personality-vision">我想成为怎样的人</label><textarea id="personality-vision" value={vision} onChange={event=>setVision(event.target.value)} maxLength={10000} placeholder="例如：更坦诚地表达需要，遇到问题先行动。" rows={5}/><label htmlFor="personality-practice">我正在练习的改变</label><textarea id="personality-practice" value={practice} onChange={event=>setPractice(event.target.value)} maxLength={10000} placeholder="把一个习惯写得具体一点：当……时，我会……" rows={5}/><button className="personality-secondary" disabled={vision===content.vision && practice===content.practice}>保存方向</button></fieldset></form>
        <form className="personality-card personality-journal" onSubmit={saveEntry}><fieldset disabled={!ready || busy}><div className="personality-card-heading"><span className="personality-number">02 / {editing?'修改记录':'留下一点变化'}</span><input aria-label="记录日期" type="date" required value={entry.date} onChange={event=>setEntry({...entry,date:event.target.value})}/></div><label htmlFor="personality-action">这次，我做了什么</label><textarea ref={editor} id="personality-action" value={entry.action} onChange={event=>setEntry({...entry,action:event.target.value})} maxLength={10000} placeholder="一次尝试、一件小事，或者没做到的地方，都可以写。" rows={5}/><label htmlFor="personality-reflection">我的感受和下一步</label><textarea id="personality-reflection" value={entry.reflection} onChange={event=>setEntry({...entry,reflection:event.target.value})} maxLength={10000} placeholder="当时发生了什么？下次想怎样回应？" rows={5}/><div className="personality-save-row">{editing && <button type="button" className="personality-secondary" onClick={resetEntry}>取消修改</button>}<button className="personality-primary" disabled={!entry.action.trim() && !entry.reflection.trim()}>{busy?'正在保存…':editing?'保存修改':'保存这次记录'}</button></div></fieldset></form>
      </div>
      <div className="personality-saved" role="status">{busy?'正在保存…':dirty?'有未保存的内容':notice}</div>
      <section className="personality-history"><header><h2>一路的变化</h2><span>{records.length} 条记录</span></header>{ready && !records.length && <div className="personality-empty"><strong>从今天的一件小事开始</strong><p>写下第一条记录，它会留在这里。</p></div>}{records.map(item=><article className="personality-record" key={item.id}><header><time dateTime={item.date}>{item.date.replaceAll('-',' / ')}</time><button type="button" disabled={busy || dirty} onClick={()=>{setEntry({...item});setEditing(true);setNotice('');editor.current?.focus();editor.current?.scrollIntoView({behavior:'smooth',block:'center'});}}>编辑记录</button></header>{item.action && <div><h3>这次的行动</h3><p>{item.action}</p></div>}{item.reflection && <div><h3>感受和下一步</h3><p>{item.reflection}</p></div>}</article>)}</section>
    </>}
  </section>;
}
