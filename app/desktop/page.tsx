"use client";
import { useEffect, useState } from "react";
import "./desktop.css";

type Entry = { id: number; owner: string; title: string; due: string | null; startTime: string; endTime: string; category: string; done: boolean };
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const shift = (date: Date, days: number) => { const result = new Date(date); result.setDate(result.getDate()+days); return result; };

export default function DesktopAgenda() {
  const [now, setNow] = useState<Date | null>(null);
  const [selected, setSelected] = useState("");
  const [weekOffset, setWeekOffset] = useState(0);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  useEffect(() => {
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
      try {
        const response = await fetch('/api/team?key=tongpin-personal-tasks-v3', { cache: 'no-store', signal: controller.signal });
        if (response.status === 401) { if (!stopped) { setEntries([]); setError('登录已过期，请重新进入'); } return; }
        if (!response.ok) throw new Error();
        const { document } = await response.json();
        if (!stopped) {
          setEntries((Array.isArray(document?.value) ? document.value : []).filter((task: Entry) => task && task.owner === 'xzx' && typeof task.title === 'string'));
          setError(''); setUpdatedAt(new Date()); setLoaded(true);
        }
      } catch { if (!stopped) setError('暂时离线，正在重试'); }
      finally { if (!stopped) timer = setTimeout(refresh, 15000); }
    }
    void refresh();
    return () => { stopped = true; clearInterval(clock); clearTimeout(timer); controller.abort(); };
  }, []);
  if (!now) return <main className="desktop-agenda"><p className="desk-loading">正在打开你的日程…</p></main>;
  const today = dateKey(now);
  const monday = shift(now, 1 - (now.getDay() || 7) + weekOffset * 7);
  const days = Array.from({ length: 7 }, (_, index) => shift(monday, index));
  const tasks = entries.filter(task => task.due === selected).sort((a,b) => String(a.startTime).localeCompare(String(b.startTime)));
  const time = now.toLocaleTimeString('zh-CN', {hour:'2-digit',minute:'2-digit',hour12:false});
  const next = tasks.find(task => !task.done && (selected !== today || task.endTime > time));
  const active = next && selected === today && next.startTime <= time && next.endTime > time;
  const pending = entries.filter(task => !task.due && !task.done);
  const doneCount = tasks.filter(task => task.done).length;
  const selectWeek = (delta: number) => { const nextMonday = shift(monday, delta * 7); setWeekOffset(value => value + delta); setSelected(dateKey(nextMonday)); };
  return <main className="desktop-agenda">
    <header className="desk-header"><div className="desk-wordmark"><i>同</i><span>同频 · 桌面日程</span></div><span className={`desk-sync ${error ? 'offline' : ''}`} title={updatedAt ? `更新于 ${updatedAt.toLocaleTimeString('zh-CN')}` : '正在连接'}><i />{error ? '未连接' : loaded ? '已同步' : '连接中'}</span></header>
    <section className="desk-clock"><div><p>xzx 的日程</p><h1>{time}</h1><span>{now.toLocaleDateString('zh-CN', {month:'long',day:'numeric',weekday:'long'})}</span></div><div className="desk-monogram" aria-hidden="true">x<span>zx</span></div></section>
    {error && <div className="desk-error" role="status">{error}<button onClick={() => location.reload()}>重新连接</button></div>}
    <section className="desk-week" aria-label="选择日期"><header><strong>{days[0].toLocaleDateString('zh-CN',{month:'long'})}<span> · {weekOffset === 0 ? '本周' : '周日程'}</span></strong><div><button aria-label="上一周" onClick={() => selectWeek(-1)}>‹</button><button className="desk-today" onClick={() => { setWeekOffset(0); setSelected(today); }}>今天</button><button aria-label="下一周" onClick={() => selectWeek(1)}>›</button></div></header><div className="desk-days">{days.map((day,index) => { const key = dateKey(day); return <button key={key} aria-label={key} aria-pressed={selected === key} className={selected === key ? 'selected' : ''} onClick={() => setSelected(key)}><span>{['一','二','三','四','五','六','日'][index]}</span><b>{day.getDate()}</b><i className={entries.some(task => task.due === key && !task.done) ? 'has-tasks' : ''} /></button>; })}</div></section>
    {next && <section className={`desk-focus ${active ? 'active' : ''}`}><div><span className="desk-eyebrow">{active ? '正在进行' : selected === today ? '接下来' : '当日首项'}</span><time>{next.startTime} — {next.endTime}</time></div><h2>{next.title}</h2><span className="desk-focus-category">{next.category || '日程'}</span></section>}
    <section className="desk-schedule"><header><h2>{selected === today ? '今天的安排' : `${selected.slice(5).replace('-','月')}日安排`}</h2><span>{doneCount} / {tasks.length} 已完成</span></header><div className="desk-progress"><i style={{width:tasks.length ? `${doneCount/tasks.length*100}%` : '0%'}} /></div>
      {!loaded && !error && <p className="desk-empty">正在同步网站日程…</p>}
      {loaded && tasks.length === 0 && <div className="desk-empty"><span>☀</span><p>这一天还没有安排</p><small>在工作台添加后，这里会自动更新。</small></div>}
      <ol className="desk-events">{tasks.map(task => <li key={task.id} className={`${task.done ? 'done' : ''} ${active && next?.id === task.id ? 'current' : ''}`}><div className="desk-event-time"><b>{task.startTime}</b><span>{task.endTime}</span></div><i className="desk-event-dot">{task.done ? '✓' : ''}</i><div className="desk-event-body"><h3>{task.title}</h3><span>{task.category || '日程'}{task.done ? ' · 已完成' : ''}</span></div></li>)}</ol>
    </section>
    {pending.length > 0 && <details className="desk-pending"><summary>待安排<span>{pending.length} 项</span></summary>{pending.map(task => <p key={task.id}><i />{task.title}</p>)}</details>}
    <footer className="desk-footer"><span>每 15 秒自动同步</span><a href="/" target="_blank" rel="noreferrer">打开工作台 ↗</a></footer>
  </main>;
}
