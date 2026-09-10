"use client";
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import {rememberUndo,forgetUndo,reverseChange} from './undo-history.mjs';
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
// Apply only locally changed fields over the newest server snapshot.
export function rebase(base: any, local: any, remote: any): any {
  if (same(base, local)) return remote;
  if (Array.isArray(local) && Array.isArray(base) && Array.isArray(remote) && [...local, ...base, ...remote].every(x => x && typeof x === "object" && "id" in x)) {
    const result = local.map(item => { const before = base.find(x => x.id === item.id); const current = remote.find(x => x.id === item.id); return before && !current ? null : rebase(before, item, current); }).filter(Boolean);
    return [...result, ...remote.filter(item => !local.some(x => x.id === item.id) && !base.some(x => x.id === item.id))];
  }
  if (base && local && remote && !Array.isArray(local) && typeof local === "object") {
    const result = { ...remote }; for (const key of Object.keys(local)) if (!same(base[key], local[key])) result[key] = rebase(base[key], local[key], remote[key]); return result;
  }
  return local;
}
export function useSharedState<T>(key: string, initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState(initial);
  const ref = useRef(value);
  ref.current = value;
  const historyScope=useRef(Symbol(key));
  const initializedRef=useRef(false);
  const update=useCallback<Dispatch<SetStateAction<T>>>((action)=>{
    const before=ref.current;const next=typeof action==='function'?(action as (current:T)=>T)(before):action;
    if(same(before,next))return;
    if(initializedRef.current){const old=structuredClone(before);const changed=structuredClone(next);rememberUndo(historyScope.current,()=>{
      const restored=reverseChange(old,changed,ref.current);ref.current=restored;setValue(restored);
    });}
    ref.current=next;setValue(next);
  },[]);
  useEffect(() => {
    let stopped = false;
    let baseline: T;
    let revision = 0;
    let initialized = false;
    let notice: HTMLDivElement | null = null;
    function warn(message: string) { if (!notice) { notice = document.createElement("div"); notice.className = "sync-notice"; notice.setAttribute("role", "status"); document.body.appendChild(notice); } notice.textContent = message; }
    const apply = (next: T) => { ref.current = next; setValue(next); };
    async function tick() {
      try {
        if (!initialized) {
          const response = await fetch(`/api/team?key=${encodeURIComponent(key)}`);
          if (!response.ok) throw new Error("连接中断，正在重试；本地修改已保留");
          const data = await response.json(); if (stopped) return;
          if (data.document) { baseline = data.document.value; revision = data.document.revision; apply(baseline); }
          else {
            const saved = localStorage.getItem(key);
            if (saved) { localStorage.setItem(key + "-before-cloud", saved); apply(JSON.parse(saved)); }
            baseline = undefined as T;
          }
          initialized = true;
          initializedRef.current=true;
        }
        const pending = ref.current;
        if (!same(pending, baseline)) {
          localStorage.setItem(key, JSON.stringify(pending));
          const response = await fetch("/api/team", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, revision, value: pending }) });
          const data = await response.json(); if (stopped) return;
          if (response.status === 409) { const next = rebase(baseline, ref.current, data.document.value); baseline = data.document.value; revision = data.document.revision; apply(next); }
          else if (!response.ok) throw new Error(data.error || "暂未同步，正在重试");
          else { const next = rebase(pending, ref.current, data.document.value); baseline = data.document.value; revision = data.document.revision; apply(next); }
        } else {
          const response = await fetch(`/api/team?key=${encodeURIComponent(key)}`); if (!response.ok) throw new Error("连接中断，正在重试");
          const data = await response.json(); if (stopped) return;
          if (data.document && data.document.revision !== revision) { const next = rebase(baseline, ref.current, data.document.value); baseline = data.document.value; revision = data.document.revision; apply(next); }
        }
        notice?.remove(); notice = null;
      } catch (error) { if (!stopped) warn(error instanceof Error ? error.message : "暂未同步，正在重试"); }
      if (!stopped) timer = window.setTimeout(tick, 1200);
    }
    let timer = window.setTimeout(tick, 0);
    const beforeUnload = (event: BeforeUnloadEvent) => { if (initialized && !same(ref.current, baseline)) { localStorage.setItem(key, JSON.stringify(ref.current)); event.preventDefault(); } };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      initializedRef.current=false;forgetUndo(historyScope.current);
      if (initialized && !same(ref.current, baseline)) {
        localStorage.setItem(key, JSON.stringify(ref.current));
        void fetch("/api/team", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, revision, value: ref.current }) });
      }
      stopped = true; clearTimeout(timer); notice?.remove(); window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [key]);
  return [value, update];
}
