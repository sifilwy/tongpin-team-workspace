"use client";
import { useEffect, useRef, useState } from "react";
import { emptyWeekPlan, mergeWeekPlan, validWeekPlan, weekPlanDates, weekPlanKey } from "../lib/weekly-plan.mjs";
import "../weekly-plan.css";

type Plan = {weekly:string;summary:string;days:Record<string,string>};
type Document = {revision:number;value:Plan};
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
      <header><div><span>{owner} · {week} — {dates[6]}</span><h2>计划</h2></div><button type="button" aria-label="关闭计划" disabled={busy} onClick={()=>void save(true)}>×</button></header>
      <div className="weekly-plan-body">
        <p className="weekly-plan-hint">按周保存。关闭后可继续编辑，切换周可查看那一周的记录。</p>
        {error && <div className="weekly-plan-error" role="alert">{error}{!ready && <button type="button" onClick={()=>setRetry(value=>value+1)}>重新读取</button>}</div>}
        {!ready && !error && <p role="status">正在读取本周计划…</p>}
        <fieldset disabled={!ready || busy}>
          <label className="weekly-plan-section">本周计划<textarea aria-label="本周计划" rows={4} maxLength={10000} value={draft.weekly} onChange={event=>setDraft({...draft,weekly:event.target.value})} placeholder="这一周想完成什么？写下重点和安排。" /></label>
          <h3>每天计划</h3><div className="weekly-plan-days">{dates.map((date,index)=><label key={date}><span>{['周一','周二','周三','周四','周五','周六','周日'][index]}<time>{date.slice(5).replace('-',' / ')}</time></span><textarea aria-label={`${['周一','周二','周三','周四','周五','周六','周日'][index]}计划`} rows={3} maxLength={10000} value={draft.days[date] || ''} onChange={event=>setDraft({...draft,days:{...draft.days,[date]:event.target.value}})} placeholder="这一天的计划…" /></label>)}</div>
          <label className="weekly-plan-section">本周总结<textarea aria-label="本周总结" rows={4} maxLength={10000} value={draft.summary} onChange={event=>setDraft({...draft,summary:event.target.value})} placeholder="完成了什么？有哪些收获，下一周想怎样调整？" /></label>
        </fieldset>
      </div>
      <footer><span role="status">{busy?'正在保存…':dirty?'有未保存内容 · 关闭时会保存':notice || '内容按成员和周分别保存'}</span><button type="submit" disabled={!ready || busy || !dirty}>{busy?'保存中…':'保存'}</button><button type="button" disabled={busy} onClick={()=>void save(true)}>关闭</button></footer>
    </form>
  </dialog>;
}
