"use client";
import { useEffect, useRef, useState } from "react";

export type PlanPendingTask={id:number;title:string;category:string;note?:string};
export default function PlanPendingEditor({task,onSave,onClose}:{task:PlanPendingTask;onSave:(id:number,patch:Partial<Pick<PlanPendingTask,'title'|'category'|'note'>>)=>void;onClose:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const [title,setTitle]=useState(task.title);
  const [category,setCategory]=useState(task.category);
  const [note,setNote]=useState(task.note || '');
  const dirty=title!==task.title || category!==task.category || note!==(task.note || '');
  useEffect(()=>{const element=dialog.current;element?.showModal();return()=>element?.close();},[]);
  useEffect(()=>{if(!dirty)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
  return <dialog ref={dialog} className="weekly-pending-edit-dialog" aria-label="编辑待安排任务" onCancel={event=>{event.preventDefault();event.stopPropagation();onClose();}}>
    <form onSubmit={event=>{event.preventDefault();event.stopPropagation();if(!title.trim())return;const patch:Partial<PlanPendingTask>={};if(title.trim()!==task.title)patch.title=title.trim();if(category!==task.category)patch.category=category;if(note!==(task.note || ''))patch.note=note;onSave(task.id,patch);onClose();}}>
      <header><h2>编辑待安排</h2><button type="button" aria-label="取消编辑待安排" onClick={onClose}>×</button></header>
      <div className="weekly-pending-edit-fields">
        <label>任务名称<input autoFocus aria-label="任务名称" value={title} onChange={event=>setTitle(event.target.value)} /></label>
        <label>分类<select aria-label="任务分类" value={category} onChange={event=>setCategory(event.target.value)}><option>独立</option><option>皮球</option></select></label>
        <label>备注<textarea aria-label="任务备注" rows={4} maxLength={10000} value={note} onChange={event=>setNote(event.target.value)} placeholder="写下这项任务的备注" /></label>
      </div>
      <footer><button type="button" onClick={onClose}>取消</button><button type="submit" disabled={!title.trim()}>保存修改</button></footer>
    </form>
  </dialog>;
}
