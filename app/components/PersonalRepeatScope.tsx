"use client";
import { useEffect, useRef } from "react";

export default function PersonalRepeatScope({ title, date, futureCount, onChoose, onCancel }: {title:string;date:string;futureCount:number;onChoose:(scope:"single"|"following")=>void;onCancel:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const element=dialog.current;element?.showModal();return()=>element?.close();},[]);
  return <dialog ref={dialog} className="personal-repeat-dialog personal-repeat-scope" aria-label="修改重复日程" onCancel={event=>{event.preventDefault();onCancel();}}>
    <header><strong>修改哪些日程？</strong><button type="button" aria-label="取消修改范围" onClick={onCancel}>×</button></header>
    <p className="repeat-scope-title">{title}</p><p>{date || "未安排日期"} · 备注始终同步整组重复日程</p>
    <div className="repeat-scope-choices"><button type="button" onClick={()=>onChoose("single")}><strong>仅修改本次</strong><span>其他日期的安排保持原样</span></button><button type="button" onClick={()=>onChoose("following")}><strong>修改本次及以后</strong><span>本次及后续 {futureCount} 次未完成日程，保留已完成记录</span></button></div>
    <footer><button type="button" onClick={onCancel}>返回，不保存</button></footer>
  </dialog>;
}
