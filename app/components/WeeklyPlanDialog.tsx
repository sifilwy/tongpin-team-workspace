"use client";
import { useEffect, useRef, useState } from "react";
import { emptyWeekPlan, mergeWeekPlan, validWeekPlan, weekPlanDates, weekPlanKey } from "../lib/weekly-plan.mjs";
import "../weekly-plan.css";
import PlanPendingEditor, {type PlanPendingTask} from './PlanPendingEditor';
import UndoButton from './UndoButton';
import {rememberDocumentUndo} from '../lib/undo-history.mjs';

type Plan = {weekly:string;ballWeekly?:string;summary:string;ballSummary?:string;days:Record<string,string>;ballDays?:Record<string,string>};
type Document = {revision:number;value:Plan};
const weekdays=['周一','周二','周三','周四','周五','周六','周日'];
export default function WeeklyPlanDialog({ owner, week, pending=[], onAddPending, onEditPending, onClose }: {owner:string;week:string;pending?:PlanPendingTask[];onAddPending:(title:string,category:string)=>void;onEditPending:(id:number,patch:Partial<Pick<PlanPendingTask,'title'|'category'|'note'>>)=>void;onClose:()=>void}) {
  const key=weekPlanKey(owner,week);
  const dates=weekPlanDates(week);
  const [base,setBaseState]=useState<Plan>(()=>emptyWeekPlan(week));
  const [draft,setDraftState]=useState<Plan>(()=>emptyWeekPlan(week));
  const baseRef=useRef(base),draftRef=useRef(draft);
  function setBase(value:Plan){baseRef.current=value;setBaseState(value);}
  function setDraft(value:Plan){draftRef.current=value;setDraftState(value);}
  const inFlight=useRef<Promise<boolean>|null>(null);
  const [composing,setComposing]=useState(false);
  const [ready,setReady]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [retry,setRetry]=useState(0);
  const [selectedDay,setSelectedDay]=useState(0);
  const [category,setCategory]=useState<'independent'|'ball'>('independent');
  const categoryName=category==='ball'?'皮球':'独立';
  const visiblePending=pending.filter(task=>task.category===categoryName);
  const dayNotes=category==='ball' ? draft.ballDays || emptyWeekPlan(week).days : draft.days;
  const summaryText=category==='ball' ? draft.ballSummary || '' : draft.summary;
  const [addingPending,setAddingPending]=useState(false);
  const [editingPending,setEditingPending]=useState<PlanPendingTask|null>(null);
  const [pendingTitles,setPendingTitles]=useState({independent:'',ball:''});
  const pendingTitle=pendingTitles[category];
  const setPendingTitle=(title:string)=>setPendingTitles(current=>({...current,[category]:title}));
  const hasPendingDraft=Object.values(pendingTitles).some(title=>title.trim());
  const pendingInput=useRef<HTMLInputElement>(null);
  useEffect(()=>{if(addingPending)pendingInput.current?.focus();},[addingPending]);
  function addPending() {
    if(!pendingTitle.trim())return;
    onAddPending(pendingTitle.trim(),categoryName);
    setPendingTitle('');setAddingPending(false);
    if(error==='请先添加或取消左侧正在输入的任务')setError('');
  }
  const dialog=useRef<HTMLDialogElement>(null);
  const guard=useRef({mounted:false,busy:false,abort:new AbortController()});
  const dirty=JSON.stringify(base)!==JSON.stringify(draft);
  async function request(body?:{revision:number;value:Plan}) {
    const response=await fetch(`/api/team?key=${encodeURIComponent(key)}`,{
      cache:"no-store",signal:AbortSignal.any([guard.current.abort.signal,AbortSignal.timeout(15000)]),
      ...(body?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({key,...body})}:{})
    });
    const data=await response.json();
    if(!response.ok && response.status!==409) throw new Error(data.error || "暂时无法保存，请稍后重试");
    const document=data.document || {revision:0,value:emptyWeekPlan(week)};
    if(!Number.isInteger(document.revision) || !validWeekPlan(document.value,week)) throw new Error("计划暂时无法读取，请重试");
    return {conflict:response.status===409,document:document as Document};
  }
  useEffect(()=>{
    const element=dialog.current;
    guard.current.mounted=true;guard.current.abort=new AbortController();element?.showModal();
    return()=>{guard.current.mounted=false;guard.current.abort.abort();element?.close();};
  },[]);
  useEffect(()=>{
    let cancelled=false;
    void request().then(({document})=>{if(!cancelled){setBase(document.value);setDraft(document.value);setReady(true);setError("");}}).catch(failure=>{if(!cancelled)setError(failure.message);});
    return()=>{cancelled=true;};
  },[retry]);
  useEffect(()=>{const undone=(event:Event)=>{const detail=(event as CustomEvent).detail;if(detail.key===key){setBase(detail.document.value);setDraft(detail.document.value);setNotice('已撤销');}};window.addEventListener('tongpin-document-undone',undone);return()=>window.removeEventListener('tongpin-document-undone',undone);},[key]);
  useEffect(()=>{
    if(!dirty && !hasPendingDraft)return;
    const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue="";};
    window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn);
  },[dirty,hasPendingDraft]);
  async function save(close=false):Promise<boolean> {
    if(composing)return false;
    if(close && hasPendingDraft){if(!pendingTitle.trim())setCategory(category==='ball'?'independent':'ball');setAddingPending(true);setError('请先添加或取消左侧正在输入的任务');pendingInput.current?.focus();return false;}
    if(inFlight.current){if(!await inFlight.current)return false;return save(close);}
    const snapshot=draftRef.current,baseline=baseRef.current;
    if(!ready || JSON.stringify(baseline)===JSON.stringify(snapshot)){if(close)onClose();return true;}
    const persist=async()=>{
      setBusy(true);setError('');setNotice('');
      try {
        let {document}=await request();
        for(let attempt=0;attempt<4;attempt++) {
          const value=mergeWeekPlan(baseline,snapshot,document.value);
          const before=document.value;
          const result=await request({revision:document.revision,value});document=result.document;
          if(!result.conflict){
            rememberDocumentUndo(key,before,document.value);
            if(guard.current.mounted){
              // Retain anything typed while this request was in flight.
              const next=mergeWeekPlan(snapshot,draftRef.current,document.value);
              setBase(document.value);setDraft(next);setNotice('已自动保存');
            }
            return true;
          }
        }
        throw new Error('其他页面正在更新，请重试');
      } catch(failure) {if(guard.current.mounted)setError((failure as Error).message+'。输入仍保留在弹窗中。');return false;}
      finally {if(guard.current.mounted)setBusy(false);}
    };
    const operation=persist();inFlight.current=operation;
    const saved=await operation;inFlight.current=null;
    return saved && close ? save(true) : saved;
  }
  useEffect(()=>{
    if(!ready || !dirty || composing)return;
    const timer=window.setTimeout(()=>void save(),600);
    return()=>window.clearTimeout(timer);
  },[draft,ready,composing]);
  return <dialog ref={dialog} className="weekly-plan-dialog" aria-label="每周计划" onCancel={event=>{event.preventDefault();void save(true);}}>
    <form onSubmit={event=>{event.preventDefault();void save();}} onCompositionStart={()=>setComposing(true)} onCompositionEnd={()=>setComposing(false)}>
      <header><div><h2>每周计划</h2><span>{owner} · {week} — {dates[6]}</span></div><button type="button" aria-label="关闭计划" onClick={()=>void save(true)}>×</button></header>
      <div className="weekly-plan-content">
      <aside className="weekly-plan-pending" aria-label="待安排">
        <div className="weekly-plan-pending-heading"><h3>{categoryName}待安排</h3><span>{visiblePending.length}</span><button type="button" className="weekly-plan-pending-add" aria-label="添加待安排任务" title="添加待安排任务" aria-expanded={addingPending} disabled={busy} onClick={()=>{if(!addingPending)setAddingPending(true);else pendingInput.current?.focus();}}>＋</button></div>
        {addingPending && <div className="weekly-plan-pending-editor">
          <input ref={pendingInput} aria-label="待安排任务名称" maxLength={200} value={pendingTitle} onChange={event=>setPendingTitle(event.target.value)} placeholder="写下待办事项" onKeyDown={event=>{if(event.key==='Enter' && !event.nativeEvent.isComposing){event.preventDefault();addPending();}}} />
          <small>添加到{categoryName}</small>
          <div><button type="button" disabled={!pendingTitle.trim() || busy} onClick={addPending}>添加</button><button type="button" onClick={()=>{setPendingTitle('');setAddingPending(false);}}>取消</button></div>
        </div>}
        {visiblePending.length ? <ul>{visiblePending.map(task=><li key={task.id}><button type="button" className="weekly-plan-pending-task" aria-label={`编辑待安排：${task.title}`} title="点击编辑" onClick={()=>setEditingPending({...task})}><strong>{task.title}</strong><small>{task.category}<span>编辑</span></small>{task.note && <p>{task.note}</p>}</button></li>)}</ul> : <p>暂无{categoryName}待安排任务</p>}
      </aside>
      <div className="weekly-plan-body">
        {error && <div className="weekly-plan-error" role="alert">{error}{!ready ? <button type="button" onClick={()=>setRetry(value=>value+1)}>重新读取</button> : <button type="button" disabled={busy} onClick={()=>void save()}>重试</button>}</div>}
        {!ready && !error && <p role="status">正在读取本周计划…</p>}
        <fieldset disabled={!ready}>
          <div className="weekly-plan-categories" role="group" aria-label="计划标签">
            <button type="button" aria-pressed={category==='independent'} onClick={()=>setCategory('independent')}>独立</button>
            <button type="button" aria-pressed={category==='ball'} onClick={()=>setCategory('ball')}>皮球</button>
          </div>
          <textarea className="weekly-plan-overview" aria-label="本周计划" rows={7} maxLength={10000} value={category==='ball' ? draft.ballWeekly || '' : draft.weekly} onChange={event=>setDraft({...draft,[category==='ball'?'ballWeekly':'weekly']:event.target.value})} placeholder={`写下${category==='ball'?'皮球':'独立'}这一周的重点和安排…`} />
          <div className="weekly-plan-tabs" role="tablist" aria-label="选择星期">{dates.map((date,index)=><button key={date} id={`plan-day-${index}`} type="button" role="tab" aria-selected={selectedDay===index} aria-controls="plan-day-panel" tabIndex={selectedDay===index?0:-1} onClick={()=>setSelectedDay(index)} onKeyDown={event=>{
            const next=event.key==='ArrowRight'?(index+1)%7:event.key==='ArrowLeft'?(index+6)%7:event.key==='Home'?0:event.key==='End'?6:null;
            if(next!==null){event.preventDefault();setSelectedDay(next);dialog.current?.querySelector<HTMLButtonElement>(`#plan-day-${next}`)?.focus();}
          }}>{weekdays[index]}<span className={dayNotes[date]?.trim()?'has-plan':''} aria-label={dayNotes[date]?.trim()?'已填写':undefined} /></button>)}</div>
          <div id="plan-day-panel" role="tabpanel" aria-labelledby={`plan-day-${selectedDay}`} className="weekly-plan-day">
            <time dateTime={dates[selectedDay]}>{dates[selectedDay]}</time>
            <textarea aria-label={`${weekdays[selectedDay]}计划`} rows={5} maxLength={10000} value={dayNotes[dates[selectedDay]] || ''} onChange={event=>setDraft({...draft,[category==='ball'?'ballDays':'days']:{...dayNotes,[dates[selectedDay]]:event.target.value}})} placeholder={`写下${weekdays[selectedDay]}的计划，记录，总结`} />
          </div>
          <details className="weekly-plan-summary"><summary>本周总结<span>{summaryText.trim()?'已填写':'展开'}</span></summary><textarea aria-label="本周总结" rows={3} maxLength={10000} value={summaryText} onChange={event=>setDraft({...draft,[category==='ball'?'ballSummary':'summary']:event.target.value})} placeholder="记录本周的收获和改进…" /></details>
        </fieldset>
      </div>
      </div>
      <footer><span role="status">{error?'未保存，请重试':busy?'正在保存…':dirty?'等待自动保存…':notice || '自动保存'}</span><UndoButton beforeUndo={()=>save()} hasDraft={dirty} /><button type="button" onClick={()=>void save(true)}>关闭</button></footer>
    </form>
    {editingPending && <PlanPendingEditor task={editingPending} onSave={onEditPending} onClose={()=>setEditingPending(null)} />}
  </dialog>;
}
