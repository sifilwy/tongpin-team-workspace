"use client";
import { useEffect, useRef, useState } from "react";

export type PlanPendingTask={id:number;title:string;category:string;note?:string};
export default function PlanPendingEditor({task,onSave,onClose}:{task:PlanPendingTask;onSave:(id:number,patch:Partial<Pick<PlanPendingTask,'title'|'category'|'note'>>)=>void;onClose:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const [title,setTitle]=useState(task.title);
  const [category,setCategory]=useState(task.category);
  const [note,setNote]=useState(task.note || '');
  const [saved,setSaved]=useState({title:task.title,category:task.category,note:task.note || ''});
  const [composing,setComposing]=useState(false);
  const [error,setError]=useState('');
  const titleInput=useRef<HTMLInputElement>(null);
  const saveCallback=useRef(onSave);saveCallback.current=onSave;
  const dirty=title.trim()!==saved.title || category!==saved.category || note!==saved.note;
  function flush() {
    if(!title.trim() || composing)return false;
    const next={title:title.trim(),category,note};
    const patch:Partial<PlanPendingTask>={};
    if(next.title!==saved.title)patch.title=next.title;
    if(category!==saved.category)patch.category=category;
    if(note!==saved.note)patch.note=note;
    if(Object.keys(patch).length){saveCallback.current(task.id,patch);setSaved(next);}
    return true;
  }
  function finish() {if(composing)return;if(flush())onClose();else{setError('任务名称不能为空');titleInput.current?.focus();}}
  useEffect(()=>{if(composing)return;const timer=window.setTimeout(flush,500);return()=>window.clearTimeout(timer);},[title,category,note,composing]);
  useEffect(()=>{const element=dialog.current;element?.showModal();return()=>element?.close();},[]);
  useEffect(()=>{if(!dirty)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
  return <dialog ref={dialog} className="weekly-pending-edit-dialog" aria-label="编辑待安排任务" onCancel={event=>{event.preventDefault();event.stopPropagation();finish();}}>
    <form onSubmit={event=>{event.preventDefault();event.stopPropagation();finish();}}>
      <header><h2>编辑待安排</h2><button type="button" aria-label="关闭待安排编辑" onClick={finish}>×</button></header>
      <div className="weekly-pending-edit-fields">
        <label>任务名称<input ref={titleInput} autoFocus aria-label="任务名称" value={title} onChange={event=>{setTitle(event.target.value);setError('');}} onCompositionStart={()=>setComposing(true)} onCompositionEnd={()=>setComposing(false)} /></label>
        <label>分类<select aria-label="任务分类" value={category} onChange={event=>setCategory(event.target.value)}><option>独立</option><option>皮球</option></select></label>
        <label>备注<textarea aria-label="任务备注" rows={4} maxLength={10000} value={note} onChange={event=>setNote(event.target.value)} onCompositionStart={()=>setComposing(true)} onCompositionEnd={()=>setComposing(false)} placeholder="写下这项任务的备注" /></label>
        {error && <p className="weekly-plan-error" role="alert">{error}</p>}
      </div>
      <footer><span>自动保存</span><button type="button" onClick={finish}>关闭</button></footer>
    </form>
  </dialog>;
}
