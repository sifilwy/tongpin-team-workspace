"use client";
import { useEffect, useRef, useState } from "react";
import { emptyWeekPlan, mergeWeekPlan, validWeekPlan, weekPlanDates, weekPlanKey } from "../lib/weekly-plan.mjs";
import "../weekly-plan.css";

type Plan = {weekly:string;ballWeekly?:string;summary:string;days:Record<string,string>};
type Document = {revision:number;value:Plan};
const weekdays=['周一','周二','周三','周四','周五','周六','周日'];
export default function WeeklyPlanDialog({ owner, week, onClose }: {owner:string;week:string;onClose:()=>void}) {
  const key=weekPlanKey(owner,week);
  const dates=weekPlanDates(week);
  const [base,setBase]=useState<Plan>(()=>emptyWeekPlan(week));
  const [draft,setDraft]=useState<Plan>(()=>emptyWeekPlan(week));
  const [ready,setReady]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [retry,setRetry]=useState(0);
  const [selectedDay,setSelectedDay]=useState(0);
  const [category,setCategory]=useState<'independent'|'ball'>('independent');
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
  useEffect(()=>{
    if(!dirty)return;
    const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue="";};
    window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn);
  },[dirty]);
  async function save(close=false) {
    if(guard.current.busy)return;
    if(!ready || !dirty){if(close)onClose();return;}
    guard.current.busy=true;setBusy(true);setError("");setNotice("");
    try {
      let {document}=await request();
      for(let attempt=0;attempt<4;attempt++) {
        const value=mergeWeekPlan(base,draft,document.value);
        const result=await request({revision:document.revision,value});document=result.document;
        if(!result.conflict){
          if(guard.current.mounted){setBase(document.value);setDraft(document.value);setNotice("已保存");if(close)onClose();}
          return;
        }
      }
      throw new Error("其他页面正在更新，内容已保留，请再次保存");
    } catch(failure) {if(guard.current.mounted)setError(`${(failure as Error).message}。输入仍保留在弹窗中。`);}
    finally {guard.current.busy=false;if(guard.current.mounted)setBusy(false);}
  }
  return <dialog ref={dialog} className="weekly-plan-dialog" aria-label="每周计划" onCancel={event=>{event.preventDefault();void save(true);}}>
    <form onSubmit={event=>{event.preventDefault();void save();}}>
      <header><div><h2>每周计划</h2><span>{owner} · {week} — {dates[6]}</span></div><button type="button" aria-label="关闭计划" disabled={busy} onClick={()=>void save(true)}>×</button></header>
      <div className="weekly-plan-body">
        {error && <div className="weekly-plan-error" role="alert">{error}{!ready && <button type="button" onClick={()=>setRetry(value=>value+1)}>重新读取</button>}</div>}
        {!ready && !error && <p role="status">正在读取本周计划…</p>}
        <fieldset disabled={!ready || busy}>
          <div className="weekly-plan-categories" role="group" aria-label="计划标签">
            <button type="button" aria-pressed={category==='independent'} onClick={()=>setCategory('independent')}>独立</button>
            <button type="button" aria-pressed={category==='ball'} onClick={()=>setCategory('ball')}>皮球</button>
          </div>
          <textarea className="weekly-plan-overview" aria-label="本周计划" rows={7} maxLength={10000} value={category==='ball' ? draft.ballWeekly || '' : draft.weekly} onChange={event=>setDraft({...draft,[category==='ball'?'ballWeekly':'weekly']:event.target.value})} placeholder={`写下${category==='ball'?'皮球':'独立'}这一周的重点和安排…`} />
          <div className="weekly-plan-tabs" role="tablist" aria-label="选择星期">{dates.map((date,index)=><button key={date} id={`plan-day-${index}`} type="button" role="tab" aria-selected={selectedDay===index} aria-controls="plan-day-panel" tabIndex={selectedDay===index?0:-1} onClick={()=>setSelectedDay(index)} onKeyDown={event=>{
            const next=event.key==='ArrowRight'?(index+1)%7:event.key==='ArrowLeft'?(index+6)%7:event.key==='Home'?0:event.key==='End'?6:null;
            if(next!==null){event.preventDefault();setSelectedDay(next);dialog.current?.querySelector<HTMLButtonElement>(`#plan-day-${next}`)?.focus();}
          }}>{weekdays[index]}<span className={draft.days[date]?.trim()?'has-plan':''} aria-label={draft.days[date]?.trim()?'已填写':undefined} /></button>)}</div>
          <div id="plan-day-panel" role="tabpanel" aria-labelledby={`plan-day-${selectedDay}`} className="weekly-plan-day">
            <time dateTime={dates[selectedDay]}>{dates[selectedDay]}</time>
            <textarea aria-label={`${weekdays[selectedDay]}计划`} rows={5} maxLength={10000} value={draft.days[dates[selectedDay]] || ''} onChange={event=>setDraft({...draft,days:{...draft.days,[dates[selectedDay]]:event.target.value}})} placeholder={`写下${weekdays[selectedDay]}的计划，记录，总结`} />
          </div>
          <details className="weekly-plan-summary"><summary>本周总结<span>{draft.summary.trim()?'已填写':'展开'}</span></summary><textarea aria-label="本周总结" rows={3} maxLength={10000} value={draft.summary} onChange={event=>setDraft({...draft,summary:event.target.value})} placeholder="记录本周的收获和改进…" /></details>
        </fieldset>
      </div>
      <footer><span role="status">{busy?'正在保存…':dirty?'关闭时保存':notice || '按周保存'}</span><button type="submit" disabled={!ready || busy || !dirty}>{busy?'保存中…':'保存'}</button><button type="button" disabled={busy} onClick={()=>void save(true)}>关闭</button></footer>
    </form>
  </dialog>;
}
