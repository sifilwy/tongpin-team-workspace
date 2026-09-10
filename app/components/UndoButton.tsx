"use client";
import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {canUndo,undoBusy,undoLast,undoVersion,subscribeUndo} from '../lib/undo-history.mjs';
import '../undo.css';
export default function UndoButton({global=false,beforeUndo,onUndone,hasDraft=false}:{global?:boolean;beforeUndo?:()=>unknown;onUndone?:()=>void;hasDraft?:boolean}) {
  useSyncExternalStore(subscribeUndo,undoVersion,()=>0);
  const [message,setMessage]=useState('');const [working,setWorking]=useState(false);
  const button=useRef<HTMLButtonElement>(null);
  useEffect(()=>{if(!global)return;const handler=(event:KeyboardEvent)=>{
    const target=event.target as HTMLElement;
    if(event.defaultPrevented || event.isComposing || event.shiftKey || event.altKey || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase()!=='z' || target.closest('input,textarea,select,[contenteditable=true]'))return;
    const dialogs=document.querySelectorAll('dialog[open]');const action=dialogs.length?dialogs[dialogs.length-1].querySelector<HTMLButtonElement>('[data-undo-button]'):button.current;
    if(action && !action.disabled){event.preventDefault();action.click();}
  };window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);},[global]);
  return <div className={`undo-control ${global?'undo-global':''}`}>
    <button ref={button} type="button" data-undo-button disabled={working || undoBusy() || (!canUndo() && !hasDraft)} title="撤销本次打开页面后的操作（Ctrl+Z）" onClick={async()=>{
      setWorking(true);setMessage('');try{if(await beforeUndo?.()===false)return;if(await undoLast()){setMessage('已撤销');onUndone?.();}}catch(error){setMessage((error as Error).message);}finally{setWorking(false);}
    }}>{working || undoBusy()?'正在撤销…':'↶ 撤销上一步'}</button>
    {message && <small role="status">{message}</small>}
  </div>;
}
