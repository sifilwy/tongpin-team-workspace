"use client";
import { useEffect, useRef, useState } from "react";
import { readTasks, saveTaskDone } from './task-sync.mjs';
import "./desktop.css";

type Entry = { id: number; owner: string; title: string; due: string | null; startTime: string; endTime: string; category: string; done: boolean };
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const shift = (date: Date, days: number) => { const result = new Date(date); result.setDate(result.getDate()+days); return result; };

export default function DesktopAgenda() {
  const [now, setNow] = useState<Date | null>(null);
  const [selected, setSelected] = useState("");
  const [weekOffset, setWeekOffset] = useState(0);
  const [view, setView] = useState<'day' | 'three'>('day');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState<number | null>(null);
  const [saveError, setSaveError] = useState('');
  const [saveNotice, setSaveNotice] = useState('');
  const sync = useRef({ epoch: 0, revision: -1, busy: false, active: false, controller: new AbortController() });
  const acceptDocument = (document: { revision: number; value: Entry[] } | null) => {
    if ((document?.revision ?? 0) < sync.current.revision) return;
    sync.current.revision = document?.revision ?? 0;
    setEntries((document?.value ?? []).filter(task => task && task.owner === 'xzx' && typeof task.title === 'string'));
    setError(''); setUpdatedAt(new Date()); setLoaded(true);
  };
  const toggleTask = async (task: Entry) => {
    const state = sync.current;
    if (state.busy) return;
    state.busy = true; state.epoch++;
    setSaving(task.id); setSaveError(''); setSaveNotice('');
    try {
      const document = await saveTaskDone(task.id, !task.done, state.controller.signal);
      if (state.active) { acceptDocument(document); setSaveNotice(task.done ? '已恢复为未完成' : '已完成，已同步到网站'); }
    } catch (failure) {
      if (state.active) setSaveError(`${failure instanceof Error ? failure.message : '保存失败，请重试'}（未确认保存）`);
    } finally {
      state.busy = false; state.epoch++;
      if (state.active) setSaving(null);
    }
  };
  useEffect(()=>{const undone=(event:Event)=>{const detail=(event as CustomEvent).detail;if(detail.key==='tongpin-personal-tasks-v3')acceptDocument(detail.document);};window.addEventListener('tongpin-document-undone',undone);return()=>window.removeEventListener('tongpin-document-undone',undone);},[]);
  useEffect(() => {
    const state = sync.current;
    state.active = true; state.controller = new AbortController();
    try { if (localStorage.getItem('tongpin-desktop-view') === 'three') setView('three'); } catch {}
    let previousDay = dateKey(new Date());
    const tick = () => {
      const current = new Date(); const currentDay = dateKey(current);
      if (currentDay !== previousDay) { const before = previousDay; setSelected(value => value === before ? currentDay : value); previousDay = currentDay; }
      setNow(current);
    };
    tick(); setSelected(dateKey(new Date()));
    const clock = window.setInterval(tick, 30000);
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function refresh() {
      const epoch = state.epoch;
      try {
        if (state.busy) return;
        const document = await readTasks(controller.signal);
        if (!stopped && !state.busy && epoch === state.epoch) acceptDocument(document);
      } catch (failure) { if (!stopped && epoch === state.epoch) setError(failure instanceof Error && failure.message.includes('登录') ? failure.message : '暂时离线，正在重试'); }
      finally { if (!stopped) timer = setTimeout(refresh, 15000); }
    }
    void refresh();
    return () => { stopped = true; state.active = false; state.controller.abort(); clearInterval(clock); clearTimeout(timer); controller.abort(); };
  }, []);
  if (!now) return <main className="desktop-agenda"><p className="desk-loading">正在打开你的日程…</p></main>;
  const today = dateKey(now);
  const monday = shift(now, 1 - (now.getDay() || 7) + weekOffset * 7);
  const days = Array.from({ length: 7 }, (_, index) => shift(monday, index));
  const visibleDays = view === 'three' ? [now, shift(now, 1), shift(now, 2)] : [];
  const visibleKeys = view === 'three' ? visibleDays.map(dateKey) : [selected];
  const tasks = entries.filter(task => task.due && visibleKeys.includes(task.due)).sort((a,b) => String(a.due).localeCompare(String(b.due)) || String(a.startTime).localeCompare(String(b.startTime)));
  const time = now.toLocaleTimeString('zh-CN', {hour:'2-digit',minute:'2-digit',hour12:false});
  const pending = entries.filter(task => !task.due && !task.done);
  const doneCount = tasks.filter(task => task.done).length;
  const changeView = (value: 'day' | 'three') => { setView(value); try { localStorage.setItem('tongpin-desktop-view', value); } catch {} if (value === 'three') { setWeekOffset(0); setSelected(today); } };
  const selectDay = (key: string) => { changeView('day'); setSelected(key); };
  const selectWeek = (delta: number) => { changeView('day'); const nextMonday = shift(monday, delta * 7); setWeekOffset(value => value + delta); setSelected(dateKey(nextMonday)); };
  const taskList = (items: Entry[]) => <ol className="desk-events">{items.map(task => <li key={task.id} className={`${task.done ? 'done' : ''} ${!task.done && task.due === today && task.startTime <= time && task.endTime > time ? 'current' : ''}`}><div className="desk-event-time"><b>{task.startTime}</b><span>{task.endTime}</span></div><button className="desk-task-toggle" aria-label={`${task.done ? '取消完成' : '完成任务'}：${task.title}`} aria-pressed={Boolean(task.done)} disabled={saving !== null} onClick={() => void toggleTask(task)} title={task.done ? '点击恢复为未完成' : '点击完成任务'}>{saving === task.id ? '…' : task.done ? '✓' : ''}</button><div className="desk-event-body"><h3>{task.title}</h3><span>{task.category || '日程'}{saving === task.id ? ' · 保存中' : task.done ? ' · 已完成' : ''}</span></div></li>)}</ol>;
  return <main className="desktop-agenda">
    <header className="desk-header"><div className="desk-wordmark">同屏</div><span className={`desk-sync ${error ? 'offline' : ''}`} title={updatedAt ? `更新于 ${updatedAt.toLocaleTimeString('zh-CN')}` : '正在连接'}><i />{error ? '未连接' : loaded ? '已同步' : '连接中'}</span></header>
    {error && <div className="desk-error" role="status">{error}<button onClick={() => location.reload()}>重新连接</button></div>}
    {saveError && <div className="desk-error" role="alert">{saveError}</div>}
    <span className="desk-save-notice" role="status">{saveNotice}</span>
    <div className="desk-top">
    <section className="desk-week" aria-label="选择日期"><header><strong>{days[0].toLocaleDateString('zh-CN',{month:'long'})}<span> · {weekOffset === 0 ? '本周' : '周日程'}</span></strong><div><button aria-label="上一周" onClick={() => selectWeek(-1)}>‹</button><button className="desk-today" onClick={() => { setWeekOffset(0); selectDay(today); }}>今天</button><button aria-label="下一周" onClick={() => selectWeek(1)}>›</button></div></header><div className="desk-days">{days.map((day,index) => { const key = dateKey(day); const highlighted = visibleKeys.includes(key); return <button key={key} aria-label={key} aria-pressed={highlighted} className={highlighted ? 'selected' : ''} onClick={() => selectDay(key)}><span>{['一','二','三','四','五','六','日'][index]}</span><b>{day.getDate()}</b><i className={entries.some(task => task.due === key && !task.done) ? 'has-tasks' : ''} /></button>; })}</div></section>
      <section className="desk-clock" aria-label="当前时间"><h1>{time}</h1><span>{now.toLocaleDateString('zh-CN', {month:'numeric',day:'numeric'})}</span><span>{now.toLocaleDateString('zh-CN', {weekday:'long'})}</span></section>
    </div>
    {loaded && <details className="desk-pending" open><summary>待安排<span>{pending.length} 项</span></summary>{pending.length ? taskList(pending) : <p className="desk-pending-empty">暂无待安排任务</p>}</details>}
    <section className={`desk-schedule ${view === 'three' ? 'three-days' : ''}`}><header><h2>{view === 'three' ? '近三天' : selected === today ? '今天的安排' : `${selected.slice(5).replace('-','月')}日安排`}</h2><div className="desk-view-switch" aria-label="日程视图"><button aria-pressed={view === 'day'} onClick={() => changeView('day')}>单日</button><button aria-pressed={view === 'three'} onClick={() => changeView('three')}>近三天</button></div></header><div className="desk-total">{doneCount} / {tasks.length} 已完成</div><div className="desk-progress"><i style={{width:tasks.length ? `${doneCount/tasks.length*100}%` : '0%'}} /></div>
      {!loaded && !error && <p className="desk-empty">正在同步网站日程…</p>}
      {view === 'day' && loaded && tasks.length === 0 && <div className="desk-empty"><span>☀</span><p>这一天还没有安排</p><small>在工作台添加后，这里会自动更新。</small></div>}
      {view === 'day' ? taskList(tasks) : visibleDays.map((day, index) => { const key = dateKey(day); const items = tasks.filter(task => task.due === key); return <section className="desk-day-group" key={key} aria-label={key}><header><h3>{['今天','明天','后天'][index]}<span>{day.toLocaleDateString('zh-CN', {month:'numeric',day:'numeric',weekday:'short'})}</span></h3><span>{items.length} 项</span></header>{items.length ? taskList(items) : loaded && <p className="desk-day-empty">暂无安排</p>}</section>; })}
    </section>
    <footer className="desk-footer"><span>每 15 秒自动同步</span><a href="/" target="_blank" rel="noreferrer">打开工作台 ↗</a></footer>
  </main>;
}
