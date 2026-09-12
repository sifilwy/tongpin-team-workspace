"use client";
import {useEffect,useRef,useState} from 'react';
import {canUndo,undoBusy,undoLast} from '../lib/undo-history.mjs';
import '../undo.css';
export default function UndoButton({global=false,beforeUndo,onUndone,hasDraft=false}:{global?:boolean;beforeUndo?:()=>unknown;onUndone?:()=>void;hasDraft?:boolean}) {
  const [message,setMessage]=useState('');
  const control=useRef<HTMLDivElement>(null);
  const working=useRef(false);
  useEffect(()=>{const handler=(event:KeyboardEvent)=>{
    const target=event.target as HTMLElement;
    if(event.defaultPrevented || event.isComposing || event.shiftKey || event.altKey || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase()!=='z' || target.closest('input,textarea,select,[contenteditable=true]'))return;
    const dialogs=document.querySelectorAll('dialog[open]');const active=dialogs[dialogs.length-1];
    if(global ? Boolean(active) : !active || control.current?.closest('dialog')!==active)return;
    if(working.current || undoBusy() || (!canUndo() && !hasDraft))return;
    event.preventDefault();working.current=true;setMessage('');
    void (async()=>{
      try{if(await beforeUndo?.()===false)return;if(await undoLast()){setMessage('已撤销');onUndone?.();}}
      catch(error){setMessage((error as Error).message);}
      finally{working.current=false;}
    })();
  };window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);});
  return <div ref={control} hidden={!message} className={`undo-control ${global?'undo-global':''}`}><small role="status">{message}</small></div>;
}
