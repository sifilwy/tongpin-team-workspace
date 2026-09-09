"use client";
import { useRef, useState } from "react";
import { defaultRepeatUntil, repeatDates, repeatDescription, repeatWeekdays } from "../lib/personal-repeat.mjs";

export default function PersonalRepeatFields({ due }: { due: string }) {
  const [enabled, setEnabled] = useState(false);
  const [days, setDays] = useState<number[]>([]);
  const [until, setUntil] = useState("");
  const [draftDays, setDraftDays] = useState<number[]>([]);
  const [draftUntil, setDraftUntil] = useState("");
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const openButton = useRef<HTMLButtonElement>(null);
  const open = () => {
    setDraftDays(days.length ? days : due ? [new Date(`${due}T12:00:00Z`).getUTCDay()] : [1]);
    setDraftUntil(until || (due ? defaultRepeatUntil(due) : ""));
    setError(""); dialog.current?.showModal();
  };
  const close = () => { dialog.current?.close(); openButton.current?.focus(); };
  const confirm = () => {
    try { repeatDates(due,draftUntil,'custom',draftDays); }
    catch(e) { setError((e as Error).message); return; }
    setDays([...draftDays].sort((a,b)=>a-b)); setUntil(draftUntil); setEnabled(true); close();
  };
  let count = 0;
  if (enabled && due && until) { try { count = repeatDates(due,until,'custom',days).length; } catch {} }
  return <section className="personal-repeat-fields">
    <input type="hidden" name="repeatRule" value={enabled ? "custom" : "none"} />
    <input type="hidden" name="repeatUntil" value={until} />
    {enabled && days.map(day=><input key={day} type="hidden" name="repeatDays" value={day} />)}
    <label>重复</label><button ref={openButton} type="button" className="personal-repeat-trigger" onClick={open}>{enabled ? repeatDescription('custom',days) : '不重复 · 点击设置'}</button>
    {enabled && <p>至 {until} · {count} 次 <button type="button" onClick={()=>setEnabled(false)}>取消重复</button></p>}
    <dialog ref={dialog} className="personal-repeat-dialog" aria-label="设置重复日程" onCancel={event=>{event.preventDefault();close();}} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();confirm();}}}>
      <header><strong>重复日程</strong><button type="button" aria-label="关闭重复设置" onClick={close}>×</button></header>
      <p>勾选每周需要重复的日期，可多选。</p>
      <div className="personal-repeat-shortcuts"><button type="button" onClick={()=>setDraftDays([0,1,2,3,4,5,6])}>每天</button><button type="button" onClick={()=>setDraftDays([1,2,3,4,5])}>工作日</button><button type="button" onClick={()=>setDraftDays([])}>清空</button></div>
      <fieldset className="personal-repeat-weekdays"><legend>每周重复日</legend>{repeatWeekdays.map(item=><label key={item.day}><input type="checkbox" checked={draftDays.includes(item.day)} onChange={event=>setDraftDays(current=>event.target.checked ? [...current,item.day] : current.filter(day=>day!==item.day))} />{item.name}</label>)}</fieldset>
      <label>结束日期<input aria-label="重复结束日期" type="date" value={draftUntil} onChange={event=>setDraftUntil(event.target.value)} /></label>
      <p>默认一个月，可自行调整。每次可单独完成，整组共享同一份备注。</p>
      {error && <p role="alert" className="personal-form-error">{error}</p>}
      <footer><button type="button" onClick={close}>取消</button><button type="button" className="confirm-repeat" onClick={confirm}>确定重复</button></footer>
    </dialog>
  </section>;
}
