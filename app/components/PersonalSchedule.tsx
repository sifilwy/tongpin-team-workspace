"use client";

import { FormEvent, MouseEvent, PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { computeOverlapLayout, snapStart, toMinutes, toTime } from "../lib/personal-layout.mjs";

type Owner = "xzx" | "czl";
type PersonalTask = {
  id: number;
  title: string;
  owner: Owner;
  due: string | null;
  done: boolean;
  category: string;
  note: string;
  startTime: string;
  endTime: string;
};

const PEOPLE: { name: Owner; color: string }[] = [
  { name: "xzx", color: "#d99b39" },
  { name: "czl", color: "#2f9b8f" },
];
const TASK_KEY = "tongpin-personal-tasks-v2";
const CATEGORY_KEY = "tongpin-personal-categories-v2";
const DAY_START = 7 * 60;
const DAY_END = 22 * 60;
const HOURS = Array.from({ length: 16 }, (_, index) => 7 + index);
const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const addDays = (date: Date, days: number) => { const next = new Date(date); next.setDate(next.getDate() + days); return next; };
const mondayOf = (date: Date) => { const next = new Date(date); const day = next.getDay() || 7; next.setDate(next.getDate() - day + 1); next.setHours(0, 0, 0, 0); return next; };
const starterTasks: PersonalTask[] = [
  { id: 901, title: "整理今日咨询记录", owner: "xzx", due: iso(new Date()), done: false, category: "独立", note: "", startTime: "09:00", endTime: "10:00" },
  { id: 902, title: "整理个人待办", owner: "xzx", due: null, done: false, category: "独立", note: "", startTime: "09:00", endTime: "10:00" },
  { id: 903, title: "确认客户跟进清单", owner: "czl", due: iso(new Date()), done: false, category: "独立", note: "", startTime: "09:00", endTime: "10:30" },
];

export default function PersonalSchedule() {
  const [tasks, setTasks] = useState<PersonalTask[]>(starterTasks);
  const [categories, setCategories] = useState<Record<Owner, string[]>>({ xzx: ["独立"], czl: ["独立"] });
  const [owner, setOwner] = useState<Owner>("xzx");
  const [allView, setAllView] = useState(false);
  const [category, setCategory] = useState("全部");
  const [weekOffset, setWeekOffset] = useState(0);
  const [dragId, setDragId] = useState<number | null>(null);
  const [dropKey, setDropKey] = useState<string | null>(null);
  const [editing, setEditing] = useState<PersonalTask | null>(null);
  const [newDefaults, setNewDefaults] = useState<{ due: string | null; owner: Owner } | null>(null);
  const [modalOwner, setModalOwner] = useState<Owner>("xzx");
  const [menu, setMenu] = useState<{ id: number; x: number; y: number } | null>(null);
  const [pendingOpen, setPendingOpen] = useState<Record<Owner, boolean>>({ xzx: true, czl: true });
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [renamingCategory, setRenamingCategory] = useState<string | null>(null);
  const [categoryDraft, setCategoryDraft] = useState("");
  const [dragPreview, setDragPreview] = useState<{ due: string; startTime: string } | null>(null);
  const dragPreviewRef = useRef<{ due: string; startTime: string } | null>(null);
  const edgeHover = useRef<{ direction: -1 | 0 | 1; since: number }>({ direction: 0, since: 0 });
  const edgeTimer = useRef<number | null>(null);
  const dragOffsetY = useRef(0);
  const pointerDrag = useRef<{ id: number; pointerId: number; startX: number; startY: number; active: boolean } | null>(null);
  const suppressClick = useRef(false);

  useEffect(() => {
    try {
      const savedTasks = localStorage.getItem(TASK_KEY);
      const savedCategories = localStorage.getItem(CATEGORY_KEY);
      if (savedTasks) setTasks((JSON.parse(savedTasks) as PersonalTask[]).map((task) => ({ ...task, startTime: task.startTime || "09:00", endTime: task.endTime || "10:00" })));
      if (savedCategories) {
        const parsed = JSON.parse(savedCategories) as Partial<Record<Owner, string[]>>;
        setCategories({ xzx: parsed.xzx?.length ? parsed.xzx : ["独立"], czl: parsed.czl?.length ? parsed.czl : ["独立"] });
      }
    } catch { /* keep starter data */ }
  }, []);
  useEffect(() => { localStorage.setItem(TASK_KEY, JSON.stringify(tasks)); }, [tasks]);
  useEffect(() => { localStorage.setItem(CATEGORY_KEY, JSON.stringify(categories)); }, [categories]);
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("pointerdown", close);
    window.addEventListener("scroll", close, true);
    return () => { window.removeEventListener("pointerdown", close); window.removeEventListener("scroll", close, true); };
  }, [menu]);
  useEffect(() => {
    const move = (event: PointerEvent) => movePointerDrag(event);
    const finish = (event: PointerEvent) => finishPointerDrag(event);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
    };
  }, [allView, dragPreview, owner, tasks]);
  useEffect(() => () => {
    if (edgeTimer.current !== null) window.clearTimeout(edgeTimer.current);
  }, []);

  const now = new Date();
  const weekStart = addDays(mondayOf(now), weekOffset * 7);
  const dates = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const filtered = useMemo(() => tasks.filter((task) => (allView || task.owner === owner) && (category === "全部" || task.category === category)), [allView, category, owner, tasks]);
  const pending = tasks.filter((task) => task.owner === owner && task.due === null && !task.done && (category === "全部" || task.category === category));

  function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = newCategoryName.trim();
    if (!value || categories[owner].includes(value)) return;
    setCategories((current) => ({ ...current, [owner]: [...current[owner], value] }));
    setCategory(value);
    setNewCategoryName("");
    setAddingCategory(false);
  }

  function renameCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!renamingCategory) return;
    const value = categoryDraft.trim();
    if (!value) return;
    if (value !== renamingCategory && categories[owner].includes(value)) {
      window.alert("已经有这个分类了");
      return;
    }
    const previous = renamingCategory;
    setCategories((current) => ({ ...current, [owner]: current[owner].map((item) => item === previous ? value : item) }));
    setTasks((current) => current.map((task) => task.owner === owner && task.category === previous ? { ...task, category: value } : task));
    if (category === previous) setCategory(value);
    setRenamingCategory(null);
    setCategoryDraft("");
  }

  function openNew(defaults: { due: string | null; owner: Owner }) {
    setModalOwner(defaults.owner);
    setEditing(null);
    setNewDefaults(defaults);
  }

  function openEditor(task: PersonalTask) {
    setModalOwner(task.owner);
    setNewDefaults(null);
    setEditing(task);
  }

  function moveTask(id: number, patch: Partial<PersonalTask>, beforeId?: number) {
    setTasks((current) => {
      const moving = current.find((task) => task.id === id);
      if (!moving) return current;
      const remaining = current.filter((task) => task.id !== id);
      const moved = { ...moving, ...patch };
      const targetIndex = beforeId ? remaining.findIndex((task) => task.id === beforeId) : -1;
      if (targetIndex >= 0) remaining.splice(targetIndex, 0, moved);
      else {
        const lastIndex = remaining.reduce((last, task, index) => task.owner === moved.owner && task.due === moved.due ? index : last, -1);
        remaining.splice(lastIndex + 1, 0, moved);
      }
      return remaining;
    });
  }

  function cancelEdgeHover() {
    if (edgeTimer.current !== null) window.clearTimeout(edgeTimer.current);
    edgeTimer.current = null;
    edgeHover.current = { direction: 0, since: 0 };
  }

  function endDrag() { setDragId(null); setDropKey(null); dragPreviewRef.current = null; setDragPreview(null); dragOffsetY.current = 0; cancelEdgeHover(); window.setTimeout(() => { suppressClick.current = false; }, 0); }
  function hoverEdge(direction: -1 | 1) {
    if (edgeHover.current.direction === direction) return;
    cancelEdgeHover();
    edgeHover.current = { direction, since: Date.now() };
    setWeekOffset((value) => value + direction);
    edgeTimer.current = window.setTimeout(() => {
      edgeTimer.current = null;
      if (edgeHover.current.direction === direction) edgeHover.current = { direction: 0, since: 0 };
    }, 720);
  }

  function scheduleTaskAt(id: number, due: string, startTime: string) {
    const task = tasks.find((item) => item.id === id);
    if (!task) return;
    const start = toMinutes(startTime);
    const duration = Math.max(30, toMinutes(task.endTime) - toMinutes(task.startTime));
    moveTask(id, { due, owner: allView ? task.owner : owner, startTime, endTime: toTime(Math.min(DAY_END, start + duration)) });
  }

  function pointerPreview(clientY: number, track: HTMLElement, due: string) {
    const bounds = track.getBoundingClientRect();
    const moving = tasks.find((task) => task.id === pointerDrag.current?.id);
    const duration = moving ? Math.max(30, toMinutes(moving.endTime) - toMinutes(moving.startTime)) : 60;
    const safeStart = snapStart({ clientY, trackTop: bounds.top, trackHeight: bounds.height, grabOffset: dragOffsetY.current, duration, dayStart: DAY_START, dayEnd: DAY_END });
    const preview = { due, startTime: toTime(safeStart) };
    dragPreviewRef.current = preview;
    setDragPreview(preview);
    setDropKey(due);
    return preview;
  }

  function startPointerDrag(event: ReactPointerEvent<HTMLButtonElement>, id: number) {
    if (event.button !== 0 || (event.target as HTMLElement).closest(".personal-card-check")) return;
    const task = tasks.find((item) => item.id === id);
    const bounds = event.currentTarget.getBoundingClientRect();
    dragOffsetY.current = task?.due ? Math.max(0, event.clientY - bounds.top) : 0;
    pointerDrag.current = { id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, active: false };
  }

  function movePointerDrag(event: Pick<PointerEvent, "pointerId" | "clientX" | "clientY">) {
    const pointer = pointerDrag.current;
    if (!pointer || pointer.pointerId !== event.pointerId) return;
    if (!pointer.active && Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) < 5) return;
    pointer.active = true;
    suppressClick.current = true;
    setDragId(pointer.id);
    const mainBounds = document.querySelector<HTMLElement>(".personal-main")?.getBoundingClientRect();
    if (mainBounds && event.clientX >= mainBounds.left && event.clientX < mainBounds.left + 32) hoverEdge(-1);
    else if (mainBounds && event.clientX > mainBounds.right - 32) hoverEdge(1);
    else cancelEdgeHover();
    const timeline = document.querySelector<HTMLElement>(".personal-timeline-shell");
    if (timeline) {
      const timelineBounds = timeline.getBoundingClientRect();
      if (event.clientY < timelineBounds.top + 38) timeline.scrollTop -= 14;
      else if (event.clientY > timelineBounds.bottom - 38) timeline.scrollTop += 14;
    }
    const target = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
    const track = target?.closest<HTMLElement>(".personal-day-track");
    if (track?.dataset.due) { pointerPreview(event.clientY, track, track.dataset.due); return; }
    const categoryTarget = target?.closest<HTMLElement>("[data-personal-category]");
    if (categoryTarget?.dataset.personalCategory) {
      dragPreviewRef.current = null;
      setDragPreview(null);
      setDropKey(`category-${categoryTarget.dataset.personalCategory}`);
      return;
    }
    if (target?.closest(".personal-pending")) {
      const pendingItem = target.closest<HTMLElement>("[data-pending-id]");
      dragPreviewRef.current = null;
      setDragPreview(null);
      setDropKey(pendingItem ? `pending-${pendingItem.dataset.pendingId}` : "pending");
      return;
    }
    dragPreviewRef.current = null;
    setDragPreview(null);
    setDropKey(null);
  }

  function finishPointerDrag(event: Pick<PointerEvent, "pointerId" | "clientX" | "clientY">) {
    const pointer = pointerDrag.current;
    if (!pointer || pointer.pointerId !== event.pointerId) return;
    if (pointer.active) {
      const target = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
      const track = target?.closest<HTMLElement>(".personal-day-track");
      const pendingTarget = target?.closest<HTMLElement>("[data-pending-id]");
      const categoryTarget = target?.closest<HTMLElement>("[data-personal-category]");
      const preview = dragPreviewRef.current;
      if (track?.dataset.due && preview?.due === track.dataset.due) scheduleTaskAt(pointer.id, preview.due, preview.startTime);
      else if (categoryTarget?.dataset.personalCategory) moveTask(pointer.id, { category: categoryTarget.dataset.personalCategory });
      else if (target?.closest(".personal-pending")) moveTask(pointer.id, { due: null, owner, done: false }, pendingTarget ? Number(pendingTarget.dataset.pendingId) : undefined);
    }
    pointerDrag.current = null;
    endDrag();
    window.setTimeout(() => { suppressClick.current = false; }, 0);
  }

  function clickTask(task: PersonalTask) {
    if (suppressClick.current) { suppressClick.current = false; return; }
    openEditor(task);
  }

  function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const selectedOwner = String(data.get("owner")) as Owner;
    const selectedCategory = String(data.get("category"));
    const due = String(data.get("due") || "") || null;
    const startTime = String(data.get("startTime") || "09:00");
    const rawEnd = String(data.get("endTime") || "10:00");
    const endTime = toMinutes(rawEnd) > toMinutes(startTime) ? rawEnd : toTime(Math.min(DAY_END, toMinutes(startTime) + 30));
    const patch = { title: String(data.get("title") || "").trim(), owner: selectedOwner, category: selectedCategory, due, note: String(data.get("note") || "").trim(), startTime, endTime };
    if (!patch.title) return;
    if (editing) setTasks((current) => current.map((task) => task.id === editing.id ? { ...task, ...patch } : task));
    else setTasks((current) => [{ id: Date.now(), done: false, ...patch }, ...current]);
    setEditing(null);
    setNewDefaults(null);
  }

  function selectPerson(nextOwner: Owner) {
    setOwner(nextOwner);
    setAllView(false);
    setCategory("全部");
    setAddingCategory(false);
    setNewCategoryName("");
    setRenamingCategory(null);
    setCategoryDraft("");
  }

  function openMenu(event: MouseEvent, id: number) {
    event.preventDefault();
    setMenu({ id, x: Math.min(event.clientX, window.innerWidth - 185), y: Math.min(event.clientY, window.innerHeight - 210) });
  }

  return <section className="personal-v2">
    <aside className="personal-sidebar">
      <div className="personal-segment">{PEOPLE.map((person) => <button key={person.name} className={owner === person.name && !allView ? "active" : ""} onClick={() => selectPerson(person.name)}>{person.name}</button>)}</div>
        <div className="personal-side-title"><div><strong>{owner} 的待办</strong><span>拖到右侧日期即可安排</span></div><button onClick={() => openNew({ owner, due: null })}>＋</button></div>
        <div className="personal-categories">
          <button className={category === "全部" ? "active" : ""} onClick={() => setCategory("全部")}><span>全部</span><b>{tasks.filter((task) => task.owner === owner && !task.done).length}</b></button>
          {categories[owner].map((item) => renamingCategory === item ? <form className="personal-category-form" key={item} onSubmit={renameCategory}><input autoFocus aria-label="修改分类名称" value={categoryDraft} onChange={(event) => setCategoryDraft(event.target.value)} onFocus={(event) => event.currentTarget.select()} /><button aria-label="保存分类名称">✓</button><button type="button" aria-label="取消修改分类" onClick={() => { setRenamingCategory(null); setCategoryDraft(""); }}>×</button></form> : <div data-personal-category={item} className={`personal-category-row ${dropKey === `category-${item}` ? "is-over" : ""}`} key={item}><button className={category === item ? "active" : ""} onClick={() => setCategory(item)}><span>{item}</span><b>{tasks.filter((task) => task.owner === owner && task.category === item && !task.done).length}</b></button><button className="personal-category-rename" title="修改分类名称" aria-label={`修改${item}分类名称`} onClick={() => { setAddingCategory(false); setRenamingCategory(item); setCategoryDraft(item); }}>✎</button></div>)}
          {addingCategory ? <form className="personal-category-form" onSubmit={addCategory}><input autoFocus aria-label="新分类名称" value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} placeholder="分类名称" /><button aria-label="保存分类">✓</button><button type="button" aria-label="取消新增分类" onClick={() => { setAddingCategory(false); setNewCategoryName(""); }}>×</button></form> : <button className="add-category" onClick={() => { setRenamingCategory(null); setCategoryDraft(""); setAddingCategory(true); }}>＋ 新增分类</button>}
        </div>
        <div className={`personal-pending ${dropKey === "pending" ? "is-over" : ""}`}>
          <button className="personal-pending-toggle" aria-expanded={pendingOpen[owner]} onClick={() => setPendingOpen((current) => ({ ...current, [owner]: !current[owner] }))}><span><i>{pendingOpen[owner] ? "⌄" : "›"}</i>未安排</span><b>{pending.length}</b></button>
          {pendingOpen[owner] && <div className="personal-pending-list">{pending.map((task) => <button key={task.id} data-pending-id={task.id} draggable={false} className={`${dragId === task.id ? "dragging" : ""} ${dropKey === `pending-${task.id}` ? "insert-before" : ""}`} onPointerDown={(event) => startPointerDrag(event, task.id)} onClick={() => clickTask(task)} onContextMenu={(event) => openMenu(event, task.id)}><strong>{task.title}</strong><small>{task.category}</small></button>)}{pending.length === 0 && <p>没有未安排任务</p>}</div>}
        </div>
    </aside>

    <main className="personal-main">
      <header className="personal-topbar"><div><span>{allView ? "全部成员" : owner}</span><strong>{weekStart.getFullYear()}年{String(weekStart.getMonth() + 1).padStart(2, "0")}月</strong></div><div className="personal-top-actions"><button className={`all-view-button ${allView ? "active" : ""}`} onClick={() => { setAllView((value) => !value); setCategory("全部"); }}>{allView ? "返回我的日程" : "查看全员"}</button><button className="personal-create" onClick={() => openNew({ owner: allView ? "xzx" : owner, due: iso(now) })}>＋ 添加</button><div className="personal-week-switch"><button aria-label="上一周" onClick={() => setWeekOffset((value) => value - 1)}>‹</button><button onClick={() => setWeekOffset(0)}>本周</button><button aria-label="下一周" onClick={() => setWeekOffset((value) => value + 1)}>›</button></div></div></header>

      {dragId !== null && <><div className="personal-edge prev" /><div className="personal-edge next" /></>}
      <div className="personal-timeline-shell">
        <aside className="personal-time-axis"><header /><div>{HOURS.map((hour) => <span key={hour} style={{ top: `${((hour * 60 - DAY_START) / (DAY_END - DAY_START)) * 100}%` }}>{String(hour).padStart(2, "0")}:00</span>)}</div></aside>
        <div className="personal-calendar">{dates.map((date, index) => {
          const due = iso(date);
          const dayTasks = filtered.filter((task) => task.due === due).sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
          const overlapLayout = computeOverlapLayout(dayTasks);
          return <section key={due} className={`personal-date ${due === iso(now) ? "today" : ""} ${dropKey === due ? "is-over" : ""}`}>
            <header><span>{["周一", "周二", "周三", "周四", "周五", "周六", "周日"][index]}</span><b>{date.getDate()}</b></header>
            <div className="personal-day-track" data-due={due}>{dragPreview?.due === due && <div className="personal-drop-preview" style={{ top: `${((toMinutes(dragPreview.startTime) - DAY_START) / (DAY_END - DAY_START)) * 100}%` }}><span>{dragPreview.startTime}</span></div>}{dayTasks.map((task) => {
              const person = PEOPLE.find((item) => item.name === task.owner)!;
              const start = Math.max(DAY_START, toMinutes(task.startTime));
              const end = Math.min(DAY_END, Math.max(start + 30, toMinutes(task.endTime)));
              const placement = overlapLayout.get(task.id) || { column: 0, columns: 1 };
              const width = 100 / placement.columns;
              const style = { top: `${((start - DAY_START) / (DAY_END - DAY_START)) * 100}%`, height: `${Math.max(3.4, ((end - start) / (DAY_END - DAY_START)) * 100)}%`, left: `calc(${placement.column * width}% + 3px)`, width: `calc(${width}% - 6px)` };
              return <button key={task.id} style={style} draggable={false} className={`personal-card ${task.done ? "done" : ""} ${dragId === task.id ? "dragging" : ""}`} onPointerDown={(event) => startPointerDrag(event, task.id)} onClick={() => clickTask(task)} onContextMenu={(event) => openMenu(event, task.id)}><span className="personal-card-check" draggable={false} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); setTasks((current) => current.map((item) => item.id === task.id ? { ...item, done: !item.done } : item)); }}>{task.done ? "✓" : ""}</span><strong>{task.title}</strong><time>{task.startTime}–{task.endTime}</time><small><i style={{ background: person.color }}>{task.owner[0]}</i>{allView && task.owner}<em>{task.category}</em></small></button>;
            })}</div>
          </section>;
        })}</div>
      </div>
    </main>

    {menu && (() => { const task = tasks.find((item) => item.id === menu.id); if (!task) return null; return <div className="personal-context" style={{ left: menu.x, top: menu.y }} onPointerDown={(event) => event.stopPropagation()}><strong>{task.title}</strong><button onClick={() => { setTasks((current) => current.map((item) => item.id === task.id ? { ...item, done: !item.done } : item)); setMenu(null); }}>{task.done ? "恢复未完成" : "标记完成"}</button><button onClick={() => { openEditor(task); setMenu(null); }}>修改任务</button>{task.due && <button onClick={() => { moveTask(task.id, { due: null, done: false }); setMenu(null); }}>移回待办</button>}<button className="danger" onClick={() => { if (window.confirm(`确认删除“${task.title}”？`)) setTasks((current) => current.filter((item) => item.id !== task.id)); setMenu(null); }}>删除任务</button></div>; })()}

    {(editing || newDefaults) && <div className="personal-modal-bg"><form className="personal-edit-modal" onSubmit={submitTask}><header><strong>{editing ? "修改个人任务" : "新建个人任务"}</strong><button type="button" onClick={() => { setEditing(null); setNewDefaults(null); }}>×</button></header><label>任务名称<input name="title" autoFocus required defaultValue={editing?.title || ""} placeholder="准备完成什么" /></label><div><label>成员<select name="owner" value={modalOwner} onChange={(event) => setModalOwner(event.target.value as Owner)}>{PEOPLE.map((person) => <option key={person.name}>{person.name}</option>)}</select></label><label>个人分类<select key={modalOwner} name="category" defaultValue={editing?.owner === modalOwner && categories[modalOwner].includes(editing.category) ? editing.category : categories[modalOwner][0]}>{categories[modalOwner].map((item) => <option key={item}>{item}</option>)}</select></label></div><label>安排日期<input name="due" type="date" defaultValue={editing?.due || newDefaults?.due || ""} /><small>留空则进入左侧待办</small></label><div className="personal-time-fields"><label>开始时间<input name="startTime" type="time" step="900" defaultValue={editing?.startTime || "09:00"} /></label><label>结束时间<input name="endTime" type="time" step="900" defaultValue={editing?.endTime || "10:00"} /></label></div><label>备注<textarea name="note" defaultValue={editing?.note || ""} placeholder="可选" /></label><button className="save">保存</button></form></div>}
  </section>;
}
