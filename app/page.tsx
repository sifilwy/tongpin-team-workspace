"use client";

import { DragEvent as ReactDragEvent, FormEvent, MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef, useState } from "react";
import CompletedWorkspace from "./components/CompletedWorkspace";
import AmountSummary from "./components/AmountSummary";
import PersonalSchedule from "./components/PersonalSchedule";
import { categories, members, NOTION_COLLAB_URL, Category, Message, Status, Task, TaskNote, View } from "./lib/model";
import "./completed.css";
import "./completed-actions.css";
import "./timeline-polish.css";
import "./overview-actions.css";
import "./timeline-fit.css";
import "./context-actions.css";
import "./completed-communications.css";
import "./personal-schedule-v2.css";
import "./personal-schedule-fixes.css";
import "./amount-summary.css";
import "./task-amount.css";

const today = new Date();
const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const preciseTime = () => { const now = new Date(); return `${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`; };
const optionalAmount = (value: FormDataEntryValue | null) => {
  const raw = String(value || "").trim();
  if (!raw) return undefined;
  const amount = Number(raw);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) / 100 : undefined;
};
const addDays = (date: Date, days: number) => { const next = new Date(date); next.setDate(next.getDate() + days); return next; };
const mondayOf = (date: Date) => { const d = new Date(date); const day = d.getDay() || 7; d.setDate(d.getDate() - day + 1); d.setHours(0, 0, 0, 0); return d; };
const thisMonday = mondayOf(today);
const initialTasks: Task[] = [
  { id: 1, title: "确认本周咨询排期", owner: "悦悦", category: "运营", due: iso(addDays(thisMonday, 0)), status: "进行中", description: "确认老师与家庭双方时间，并把最终排期同步给团队。", reviews: [] },
  { id: 2, title: "整理家长常见问题", owner: "吃吃", category: "交付", due: iso(addDays(thisMonday, 1)), status: "进行中", description: "汇总本周新增问题，补充进标准回复资料。", reviews: [] },
  { id: 3, title: "更新咨询预约海报", owner: "待分配", category: "销售", due: iso(addDays(thisMonday, 2)), status: "待完成", description: "排期确认后更新预约入口与本周名额。", reviews: [] },
  { id: 4, title: "回访上周咨询家庭", owner: "待分配", category: "运营", due: iso(addDays(thisMonday, 4)), status: "待完成", description: "记录回访结果与后续跟进建议。", reviews: [] },
  { id: 5, title: "整理支付与开票说明", owner: "子涵", category: "交付", due: iso(addDays(thisMonday, 3)), status: "已完成", completedAt: new Date().toISOString(), description: "统一支付和开票口径。", reviews: [{ id: 51, author: "悦悦", text: "信息完整，结构可以继续沿用。", createdAt: "昨天" }] },
];
const initialMessages: Message[] = [
  { id: 1, author: "吃吃", text: "家长常见问题已整理出第一版，大家可以继续补充。", createdAt: "今天" },
  { id: 2, author: "czl", text: "海报文案确认后我就开始更新版式。", createdAt: "昨天" },
];
const emptyTask: Task = { id: 0, title: "暂无任务", owner: "待分配", category: "运营", due: iso(today), status: "待完成", description: "", reviews: [] };

export default function Page() {
  const currentNow = new Date();
  const [view, setView] = useState<View>("overview");
  const [tasks, setTasks] = useState<Task[]>(() => initialTasks.map((task) => ({ ...task, notionUrl: NOTION_COLLAB_URL })));
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [selectedId, setSelectedId] = useState(1);
  const [overviewMember, setOverviewMember] = useState("xzx");
  const [overviewMode, setOverviewMode] = useState<"overview" | "people" | "amount">("overview");
  const [dragTaskId, setDragTaskId] = useState<number | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const dragTaskRef = useRef<number | null>(null);
  const dragDestinationRef = useRef<{ owner: string; beforeId?: number } | null>(null);
  const weekEdgeHover = useRef<{ direction: -1 | 0 | 1; since: number }>({ direction: 0, since: 0 });
  const [taskMenu, setTaskMenu] = useState<{ taskId: number; x: number; y: number } | null>(null);
  const [overviewTaskId, setOverviewTaskId] = useState<number | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [completedTaskId, setCompletedTaskId] = useState<number | null>(null);
  const [libraryMode, setLibraryMode] = useState<"member" | "category">("member");
  const [filter, setFilter] = useState("全部");
  const [weekOffset, setWeekOffset] = useState(0);
  const [showNew, setShowNew] = useState(false);
  const [editTaskId, setEditTaskIdState] = useState<number | null>(null);
  const [messageText, setMessageText] = useState("");
  const [messageAuthor, setMessageAuthor] = useState("xzx");
  const [reviewText, setReviewText] = useState("");
  const [reviewAuthor, setReviewAuthor] = useState("xzx");
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    try {
      const savedTasks = localStorage.getItem("tongpin-tasks-v8");
      const savedMessages = localStorage.getItem("tongpin-messages-v8");
      if (savedTasks) setTasks((JSON.parse(savedTasks) as Task[]).map((task) => ({ ...task, notionUrl: NOTION_COLLAB_URL })));
      if (savedMessages) setMessages(JSON.parse(savedMessages));
    } catch { /* use starter data */ }
    finally { setStorageReady(true); }
  }, []);
  useEffect(() => {
    if (!storageReady) return;
    const next = JSON.stringify(tasks);
    if (localStorage.getItem("tongpin-tasks-v8") !== next) localStorage.setItem("tongpin-tasks-v8", next);
  }, [storageReady, tasks]);
  useEffect(() => {
    if (!storageReady) return;
    const next = JSON.stringify(messages);
    if (localStorage.getItem("tongpin-messages-v8") !== next) localStorage.setItem("tongpin-messages-v8", next);
  }, [storageReady, messages]);
  useEffect(() => {
    const syncFromAnotherTab = (event: StorageEvent) => {
      try {
        if (event.key === "tongpin-tasks-v8" && event.newValue) {
          setTasks((JSON.parse(event.newValue) as Task[]).map((task) => ({ ...task, notionUrl: NOTION_COLLAB_URL })));
        }
        if (event.key === "tongpin-messages-v8" && event.newValue) setMessages(JSON.parse(event.newValue) as Message[]);
      } catch { /* ignore a malformed value written by an older page */ }
    };
    window.addEventListener("storage", syncFromAnotherTab);
    return () => window.removeEventListener("storage", syncFromAnotherTab);
  }, []);
  useEffect(() => {
    if (!taskMenu) return;
    const close = () => setTaskMenu(null);
    window.addEventListener("pointerdown", close);
    window.addEventListener("scroll", close, true);
    return () => { window.removeEventListener("pointerdown", close); window.removeEventListener("scroll", close, true); };
  }, [taskMenu]);
  useEffect(() => { if (editTaskId !== null) setTaskMenu(null); }, [editTaskId]);
  useEffect(() => {
    const openCompleted = (event: Event) => {
      const target = event.target as HTMLElement;
      if (target.closest(".overview-progress .finished")) openCompletedList();
    };
    document.addEventListener("click", openCompleted);
    return () => document.removeEventListener("click", openCompleted);
  }, [tasks]);

  const selected = tasks.find((task) => task.id === selectedId) ?? tasks[0] ?? { ...emptyTask, due: iso(currentNow) };
  const overviewSelected = tasks.find((task) => task.id === overviewTaskId) ?? null;
  const visible = useMemo(() => filter === "全部" ? tasks : tasks.filter((task) => libraryMode === "member" ? task.owner === filter : task.category === filter), [tasks, filter, libraryMode]);
  const overviewTasks = tasks.filter((task) => task.owner === overviewMember && task.status !== "已完成");
  const unassignedTasks = tasks.filter((task) => task.owner === "待分配" && task.status !== "已完成");
  const weekStart = addDays(mondayOf(currentNow), weekOffset * 7);
  const weekDates = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  function updateTask(id: number, patch: Partial<Task>) {
    const target = tasks.find((task) => task.id === id);
    const effectiveOwner = patch.owner || target?.owner || "xzx";
    const effectivePatch = patch.status === "已完成"
      ? { completedAt: target?.completedAt || new Date().toISOString(), completedBy: patch.completedBy || target?.completedBy || "xzx", amountRecipient: target?.amountRecipient || (effectiveOwner === "待分配" ? "xzx" : effectiveOwner), ...patch }
      : patch.status
        ? { ...patch, completedAt: undefined, completedBy: undefined, amountRecipient: undefined }
        : patch;
    setTasks((current) => current.map((task) => task.id === id ? { ...task, ...effectivePatch } : task));
    if (patch.status === "已完成" && target && view !== "timeline") {
      setTaskMenu(null);
      setOverviewTaskId(null);
      setCompletedTaskId(id);
      setShowCompleted(true);
      setView("overview");
    }
  }
  const openTask = (id: number) => setSelectedId(id);
  const setEditTaskId = (id: number | null) => {
    if (id !== null && view === "overview" && !taskMenu) setOverviewTaskId(id);
    else { setEditTaskIdState(id); if (id !== null) setTaskMenu(null); }
  };

  function moveTask(id: number, owner: string, beforeId?: number) {
    if (dragTaskRef.current === id) dragDestinationRef.current = { owner, beforeId };
    setTasks((current) => {
      const moving = current.find((task) => task.id === id);
      if (!moving) return current;
      if (beforeId && beforeId !== id) {
        const movingIndex = current.findIndex((task) => task.id === id);
        const targetIndex = current.findIndex((task) => task.id === beforeId);
        if (moving.owner === owner && movingIndex >= 0 && targetIndex === movingIndex + 1) return current;
      }
      const remaining = current.filter((task) => task.id !== id);
      const moved = { ...moving, owner, status: owner === "待分配" ? "待完成" as Status : "进行中" as Status };
      if (beforeId && beforeId !== id) {
        const targetIndex = remaining.findIndex((task) => task.id === beforeId);
        if (targetIndex >= 0) { remaining.splice(targetIndex, 0, moved); return remaining; }
      }
      const lastOwnerIndex = remaining.reduce((last, task, index) => task.owner === owner && task.status !== "已完成" ? index : last, -1);
      remaining.splice(lastOwnerIndex + 1, 0, moved);
      return remaining;
    });
  }

  function moveTimelineTask(id: number, due: string, anchorId?: number, placement: "before" | "after" = "before") {
    setTasks((current) => {
      const moving = current.find((task) => task.id === id);
      if (!moving) return current;
      const remaining = current.filter((task) => task.id !== id);
      const remainsCompleted = moving.status === "已完成";
      const moved = { ...moving, due, owner: moving.owner === "待分配" ? "xzx" : moving.owner, status: remainsCompleted ? "已完成" as Status : "进行中" as Status, completedAt: remainsCompleted ? moving.completedAt || new Date().toISOString() : undefined, completedBy: remainsCompleted ? moving.completedBy || "xzx" : undefined };
      if (anchorId && anchorId !== id) {
        const anchorIndex = remaining.findIndex((task) => task.id === anchorId);
        if (anchorIndex >= 0) {
          remaining.splice(anchorIndex + (placement === "after" ? 1 : 0), 0, moved);
          return remaining;
        }
      }
      const lastDateIndex = remaining.reduce((last, task, index) => task.due === due && task.status !== "待完成" ? index : last, -1);
      remaining.splice(lastDateIndex + 1, 0, moved);
      return remaining;
    });
    setSelectedId(id);
  }

  function moveTimelineStatus(id: number, status: "待完成" | "已完成") {
    setTasks((current) => current.map((task) => task.id !== id ? task : status === "待完成"
      ? { ...task, owner: "待分配", status, completedAt: undefined, completedBy: undefined, amountRecipient: undefined }
      : { ...task, status, completedAt: new Date().toISOString(), completedBy: task.completedBy || "xzx", amountRecipient: task.amountRecipient || (task.owner === "待分配" ? "xzx" : task.owner) }));
    setSelectedId(id);
  }

  function hoverWeekEdge(direction: -1 | 1) {
    const now = Date.now();
    if (weekEdgeHover.current.direction !== direction) {
      weekEdgeHover.current = { direction, since: now };
      return;
    }
    if (now - weekEdgeHover.current.since >= 550) {
      setWeekOffset((value) => value + direction);
      weekEdgeHover.current = { direction, since: now + 650 };
    }
  }

  function clearWeekEdgeHover() {
    weekEdgeHover.current = { direction: 0, since: 0 };
  }

  function startDragging(event: ReactDragEvent<HTMLButtonElement>, id: number) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(id));
    dragTaskRef.current = id;
    dragDestinationRef.current = null;
    setDragTaskId(id);
  }

  function finishDragging() {
    const id = dragTaskRef.current;
    const destination = dragDestinationRef.current;
    if (id && destination) moveTask(id, destination.owner, destination.beforeId);
    dragTaskRef.current = null;
    dragDestinationRef.current = null;
    setDragTaskId(null);
    setDragOverKey(null);
    clearWeekEdgeHover();
  }

  function completeTask(id: number, actor = "xzx") {
    updateTask(id, { status: "已完成", completedAt: new Date().toISOString(), completedBy: actor });
  }

  function deleteTask(id: number) {
    const task = tasks.find((item) => item.id === id);
    if (!task || !window.confirm(`确认删除「${task.title}」？删除后无法恢复。`)) return;
    const remaining = tasks.filter((item) => item.id !== id);
    setTasks(remaining);
    if (selectedId === id) setSelectedId(remaining[0]?.id ?? 0);
    if (overviewTaskId === id) setOverviewTaskId(null);
    if (completedTaskId === id) setCompletedTaskId(null);
    if (editTaskId === id) setEditTaskIdState(null);
    setTaskMenu(null);
  }

  function showTaskMenu(event: ReactMouseEvent, taskId: number) {
    event.preventDefault();
    setTaskMenu({ taskId, x: Math.min(event.clientX, window.innerWidth - 190), y: Math.min(event.clientY, window.innerHeight - 220) });
  }

  function navigate(next: View) {
    setView(next);
    if (next === "overview") { setShowCompleted(false); setCompletedTaskId(null); }
  }

  function openCompletedList() {
    setCompletedTaskId(null);
    setShowCompleted(true);
  }

  function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = String(data.get("title") || "").trim();
    if (!title) return;
    const owner = String(data.get("owner"));
    const task: Task = { id: Date.now(), title, owner, category: String(data.get("category")) as Category, due: String(data.get("due")), status: owner === "待分配" ? "待完成" : "进行中", amount: optionalAmount(data.get("amount")), description: String(data.get("description") || ""), notionUrl: NOTION_COLLAB_URL, reviews: [] };
    setTasks((current) => [task, ...current]); setSelectedId(task.id); setShowNew(false);
  }
  function postMessage(event: FormEvent) {
    event.preventDefault(); if (!messageText.trim()) return;
    setMessages((current) => [{ id: Date.now(), author: messageAuthor, text: messageText.trim(), createdAt: "刚刚" }, ...current]); setMessageText("");
  }
  function addReview(event: FormEvent) {
    event.preventDefault(); if (!reviewText.trim()) return;
    updateTask(selected.id, { reviews: [...selected.reviews, { id: Date.now(), author: reviewAuthor, text: reviewText.trim(), createdAt: preciseTime() }] }); setReviewText("");
  }

  return <main className="app-shell">
    <nav className="main-nav">
      <button className="brand" onClick={() => navigate("overview")}><span>同</span><strong>同频工作台</strong></button>
      <div className="nav-links">{([["overview", "协作总览"], ["timeline", "任务时间线"], ["review", "总结复盘"], ["personal", "个人日程"]] as [View, string][]).map(([id, label]) => <button key={id} className={view === id ? "active" : ""} onClick={() => navigate(id)}>{label}</button>)}</div>
      {view !== "personal" && <button className="create-button" onClick={() => setShowNew(true)}>＋ 新建任务</button>}
    </nav>

    {view === "overview" && (showCompleted ? <CompletedWorkspace tasks={tasks} focusTaskId={completedTaskId} onUpdateTask={updateTask} onContextMenu={showTaskMenu} onExit={() => { setShowCompleted(false); setCompletedTaskId(null); }} /> : <section className="overview-page">
      <aside className="surface member-panel"><div className="overview-switch amount-enabled"><button className={overviewMode === "overview" ? "active" : ""} onClick={() => setOverviewMode("overview")}>总览</button><button className={overviewMode === "people" ? "active" : ""} onClick={() => setOverviewMode("people")}>人员</button><button className={overviewMode === "amount" ? "active" : ""} onClick={() => setOverviewMode("amount")}>金额</button></div>{overviewMode === "overview" ? <section className={`unassigned-list ${dragOverKey === "unassigned" ? "is-over" : ""}`} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDragOverKey("unassigned"); }} onDrop={(event) => { event.preventDefault(); const droppedId = Number(event.dataTransfer.getData("text/plain")) || dragTaskRef.current || dragTaskId; const targets = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>(":scope > button[data-task-id]")); const target = targets.find((item) => event.clientY < item.getBoundingClientRect().top + item.getBoundingClientRect().height / 2); if (droppedId) moveTask(droppedId, "待分配", target ? Number(target.dataset.taskId) : undefined); finishDragging(); }}><PanelTitle title="待安排" note="拖到右侧成员即可分配" />{unassignedTasks.map((task) => <button data-task-id={task.id} draggable className={`${dragTaskId === task.id ? "dragging" : ""} ${dragOverKey === `task-${task.id}` && dragTaskId !== task.id ? "insert-before" : ""}`} key={task.id} onDragStart={(event) => startDragging(event, task.id)} onDragEnd={finishDragging} onDragEnter={(event) => { event.preventDefault(); event.stopPropagation(); if (dragTaskId && dragTaskId !== task.id) moveTask(dragTaskId, "待分配", task.id); }} onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); const id = Number(event.dataTransfer.getData("text/plain")) || dragTaskRef.current || dragTaskId; if (id && id !== task.id) moveTask(id, "待分配", task.id); setDragOverKey(`task-${task.id}`); }} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); const droppedId = Number(event.dataTransfer.getData("text/plain")) || dragTaskId; if (droppedId) moveTask(droppedId, "待分配", task.id); finishDragging(); }} onContextMenu={(event) => showTaskMenu(event, task.id)} onClick={() => setEditTaskId(task.id)}><span className={`task-mark ${task.category}`} /><span><strong>{task.title}</strong><small>{task.category} · {task.due.slice(5).replace("-", "/")}</small></span></button>)}</section> : overviewMode === "people" ? <section className="people-list"><PanelTitle title="团队成员" note="点击查看个人任务" />{members.map((member) => <button className={`member-item ${overviewMember === member.name ? "active" : ""}`} key={member.name} onClick={() => setOverviewMember(member.name)}><span className="avatar" style={{ background: member.color }}>{member.name[0]}</span><span><strong>{member.name}</strong><small>{member.role}</small></span><em>{tasks.filter((task) => task.owner === member.name && task.status !== "已完成").length} 项</em></button>)}</section> : <section className="amount-side-note"><strong>金额汇总</strong><span>只统计已完成且设置了金额的任务。重做任务后，金额会自动撤回。</span></section>}</aside>
      <section className="surface focus-panel">{overviewMode === "overview" ? <><div className="allocation-heading"><div><strong>人员分配</strong><span>拖动任务，调整本周协作安排</span></div><div className="overview-progress"><article className="working"><b>{tasks.filter(task => task.status === "进行中").length}</b><span>正在推进</span></article><article><b>{unassignedTasks.length}</b><span>等待安排</span></article><article className="finished"><b>{tasks.filter(task => task.status === "已完成").length}</b><span>已完成</span></article></div></div><div className="assignment-board">{members.map((member) => <section className={`member-lane ${dragOverKey === `lane-${member.name}` ? "is-over" : ""}`} key={member.name} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDragOverKey(`lane-${member.name}`); }} onDrop={(event) => { event.preventDefault(); const droppedId = Number(event.dataTransfer.getData("text/plain")) || dragTaskRef.current || dragTaskId; const targets = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>(".lane-tasks > button[data-task-id]")); const target = targets.find((item) => event.clientY < item.getBoundingClientRect().top + item.getBoundingClientRect().height / 2); if (droppedId) moveTask(droppedId, member.name, target ? Number(target.dataset.taskId) : undefined); finishDragging(); }}><header><span className="avatar" style={{ background: member.color }}>{member.name[0]}</span><div><strong>{member.name}</strong><small>{tasks.filter(task => task.owner === member.name && task.status !== "已完成").length} 项任务</small></div></header><div className="lane-tasks">{tasks.filter(task => task.owner === member.name && task.status !== "已完成").map(task => <button data-task-id={task.id} draggable className={`lane-task ${task.category} ${dragTaskId === task.id ? "dragging" : ""} ${dragOverKey === `task-${task.id}` && dragTaskId !== task.id ? "insert-before" : ""}`} key={task.id} onDragStart={(event) => startDragging(event, task.id)} onDragEnd={finishDragging} onDragEnter={(event) => { event.preventDefault(); event.stopPropagation(); if (dragTaskId && dragTaskId !== task.id) moveTask(dragTaskId, member.name, task.id); }} onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = "move"; const id = Number(event.dataTransfer.getData("text/plain")) || dragTaskRef.current || dragTaskId; if (id && id !== task.id) moveTask(id, member.name, task.id); setDragOverKey(`task-${task.id}`); }} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); const droppedId = Number(event.dataTransfer.getData("text/plain")) || dragTaskId; if (droppedId) moveTask(droppedId, member.name, task.id); finishDragging(); }} onContextMenu={(event) => showTaskMenu(event, task.id)} onClick={() => setEditTaskId(task.id)}><span className="lane-task-category">{task.category}</span><strong>{task.title}</strong><small>{task.due.slice(5).replace("-", "/")}{task.amount !== undefined ? ` · ¥${task.amount}` : ""}</small></button>)}</div></section>)}</div></> : overviewMode === "people" ? <><div className="queue-header"><strong>{overviewMember}的任务</strong></div><div className="category-board person-board">{categories.filter((category) => overviewTasks.some((task) => task.category === category)).map((category) => <CategoryColumn key={category} category={category} tasks={overviewTasks.filter((task) => task.category === category)} onOpen={setEditTaskId} onContextMenu={showTaskMenu} />)}</div></> : <AmountSummary tasks={tasks} />}</section>
      <aside className="surface activity-panel">{overviewSelected ? <OverviewTaskDetail task={overviewSelected} onClose={() => setOverviewTaskId(null)} onEdit={() => setEditTaskIdState(overviewSelected.id)} onAddNote={(note) => updateTask(overviewSelected.id, { notes: [...(overviewSelected.notes || []), note] })} /> : <><PanelTitle title="团队动态" note="同步进展与问题" /><div className="message-list">{messages.map((message) => <article key={message.id}><div><strong>{message.author}</strong><time>{message.createdAt}</time></div><p>{message.text}</p></article>)}</div><form className="message-form" onSubmit={postMessage}><select value={messageAuthor} onChange={(event) => setMessageAuthor(event.target.value)}>{members.map(member => <option key={member.name}>{member.name}</option>)}</select><textarea value={messageText} onChange={(event) => setMessageText(event.target.value)} placeholder="写下进度、问题或需要谁配合…" /><button>发布动态</button></form></>}</aside>
      <div className="overview-create-row"><button onClick={() => setShowNew(true)}>＋ 新建任务</button></div>
    </section>)}

    {view === "timeline" && <section className="timeline-page">
      <aside className="task-library"><PanelTitle title="任务库" note="按成员或分类查看" /><div className="segmented"><button className={libraryMode === "member" ? "active" : ""} onClick={() => { setLibraryMode("member"); setFilter("全部"); }}>成员</button><button className={libraryMode === "category" ? "active" : ""} onClick={() => { setLibraryMode("category"); setFilter("全部"); }}>任务</button></div><div className="filter-stack"><button className={filter === "全部" ? "active" : ""} onClick={() => setFilter("全部")}><span>全部</span><b>{tasks.length}</b></button>{(libraryMode === "member" ? members.map(m => m.name) : categories).map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}><span>{item}</span><b>{tasks.filter(t => libraryMode === "member" ? t.owner === item : t.category === item).length}</b></button>)}</div><LibrarySection title="待完成" tasks={visible.filter(t => t.status === "待完成")} selectedId={selected.id} dragTaskId={dragTaskId} isDropTarget={dragOverKey === "timeline-waiting"} onSelect={setSelectedId} onDragStart={startDragging} onDragEnd={finishDragging} onContextMenu={showTaskMenu} onReorder={(id, beforeId) => moveTask(id, "待分配", beforeId)} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDragOverKey("timeline-waiting"); }} onDrop={(event) => { event.preventDefault(); const id = Number(event.dataTransfer.getData("text/plain")) || dragTaskId; if (id) moveTimelineStatus(id, "待完成"); finishDragging(); }} /><LibrarySection title="已完成" tasks={[...visible].filter(t => t.status === "已完成").sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt)))} selectedId={selected.id} dragTaskId={dragTaskId} isDropTarget={dragOverKey === "timeline-completed"} onSelect={setSelectedId} onDragStart={startDragging} onDragEnd={finishDragging} onContextMenu={showTaskMenu} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDragOverKey("timeline-completed"); }} onDrop={(event) => { event.preventDefault(); const id = Number(event.dataTransfer.getData("text/plain")) || dragTaskId; if (id) moveTimelineStatus(id, "已完成"); finishDragging(); }} /></aside>
      <section className="week-board">
        <div className="week-toolbar">
          <div className="week-title"><strong>{weekStart.getFullYear()}年{String(weekStart.getMonth() + 1).padStart(2, "0")}月</strong><span>{weekStart.getMonth() + 1}月{weekStart.getDate()}日 — {weekDates[6].getMonth() + 1}月{weekDates[6].getDate()}日 · 周一至周日</span></div>
          <div className="week-actions"><button className="week-add" onClick={() => setShowNew(true)}>＋ 添加任务</button><div className="week-switcher"><button aria-label="上一周" onClick={() => setWeekOffset((value) => value - 1)}>‹</button><button className="week-current" onClick={() => setWeekOffset(0)}>本周</button><button aria-label="下一周" onClick={() => setWeekOffset((value) => value + 1)}>›</button></div></div>
        </div>
        {dragTaskId !== null && <><div aria-label="拖动切换上一周" className="week-edge week-edge-prev" onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; hoverWeekEdge(-1); }} /><div aria-label="拖动切换下一周" className="week-edge week-edge-next" onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; hoverWeekEdge(1); }} /></>}
        <div className="days-grid">{weekDates.map((date, index) => {
          const dateIso = iso(date);
          const isToday = dateIso === iso(currentNow);
          const dayKey = `timeline-day-${dateIso}`;
          const dayTasks = visible
            .filter((task) => task.due === dateIso && task.status !== "待完成")
            .sort((a, b) => Number(a.status === "已完成") - Number(b.status === "已完成"));
          return <section
            className={`day-column${isToday ? " today" : ""}${dragOverKey === dayKey ? " is-over" : ""}`}
            key={dateIso}
            onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; clearWeekEdgeHover(); setDragOverKey(dayKey); }}
            onDrop={(event) => { event.preventDefault(); const droppedId = Number(event.dataTransfer.getData("text/plain")) || dragTaskId; if (droppedId) moveTimelineTask(droppedId, dateIso); finishDragging(); }}
          >
            <header><span>{["周一", "周二", "周三", "周四", "周五", "周六", "周日"][index]}</span><b>{date.getDate()}</b></header>
            <div>{dayTasks.map((task) => <CalendarCard
              key={task.id}
              task={task}
              selected={selected.id === task.id}
              dragging={dragTaskId === task.id}
              overdue={task.status !== "已完成" && task.due < iso(currentNow)}
              dropPosition={dragOverKey === `timeline-before-${task.id}` ? "before" : dragOverKey === `timeline-after-${task.id}` ? "after" : null}
              onClick={() => setSelectedId(task.id)}
              onContextMenu={showTaskMenu}
              onDragStart={startDragging}
              onDragEnd={finishDragging}
              onDragOver={(event) => {
                event.preventDefault();
                event.stopPropagation();
                const bounds = event.currentTarget.getBoundingClientRect();
                setDragOverKey(`timeline-${event.clientY < bounds.top + bounds.height / 2 ? "before" : "after"}-${task.id}`);
              }}
              onDrop={(event) => {
                event.preventDefault();
                event.stopPropagation();
                const droppedId = Number(event.dataTransfer.getData("text/plain")) || dragTaskId;
                const bounds = event.currentTarget.getBoundingClientRect();
                if (droppedId) moveTimelineTask(droppedId, dateIso, task.id, event.clientY < bounds.top + bounds.height / 2 ? "before" : "after");
                finishDragging();
              }}
            />)}</div>
          </section>;
        })}</div>
      </section>
      <aside className="task-detail"><span className={`status-pill ${selected.status}`}>{selected.status}</span><h2>{selected.title}</h2>{selected.amount !== undefined && <div className="task-amount-chip">任务金额 <b>¥{selected.amount}</b></div>}<p>{selected.description || "暂无补充说明"}</p><div className="notion-task-link"><span>任务笔记</span>{selected.notionUrl ? <a href={selected.notionUrl} target="_blank" rel="noreferrer">打开 Notion ↗</a> : <button type="button" onClick={() => setEditTaskIdState(selected.id)}>绑定 Notion 页面</button>}</div><label>负责人<select value={selected.owner} onChange={(event) => updateTask(selected.id, { owner: event.target.value })}><option>待分配</option>{members.map(member => <option key={member.name}>{member.name}</option>)}</select></label><label>任务分类<select value={selected.category} onChange={(event) => updateTask(selected.id, { category: event.target.value as Category })}>{categories.map(category => <option key={category}>{category}</option>)}</select></label><label>计划日期<input type="date" value={selected.due} onChange={(event) => updateTask(selected.id, { due: event.target.value })} /></label>{selected.status === "待完成" && <button className="detail-action" onClick={() => updateTask(selected.id, { status: "进行中" })}>安排进时间线</button>}{selected.status === "进行中" && <button className="detail-action" onClick={() => updateTask(selected.id, { status: "已完成", completedAt: new Date().toISOString() })}>标记完成</button>}<section className="review-box"><PanelTitle title="沟通" note="每条沟通保留署名" />{selected.reviews.map(review => <article key={review.id}><div><strong>{review.author}</strong><time>{review.createdAt}</time></div><p>{review.text}</p></article>)}<form onSubmit={addReview}><select value={reviewAuthor} onChange={(event) => setReviewAuthor(event.target.value)}>{members.map(member => <option key={member.name}>{member.name}</option>)}</select><textarea value={reviewText} onChange={(event) => setReviewText(event.target.value)} placeholder="写下沟通或补充…" /><button>发送</button></form></section></aside>
    </section>}

    {view === "review" && <section className="review-page"><div className="review-header"><div><span>本周复盘</span><h1>完成的事，留下有用的经验。</h1></div><div><b>{tasks.filter(t => t.status === "已完成").length}</b><small>已完成任务</small></div></div><div className="review-list">{[...tasks].filter(t => t.status === "已完成").sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt))).map(task => <article key={task.id} onContextMenu={(event) => showTaskMenu(event, task.id)} onClick={() => openTask(task.id)}><span>{task.category}</span><div><h3>{task.title}</h3><p>{task.owner} · {task.reviews.length} 条评价</p></div><button>查看复盘 →</button></article>)}</div></section>}

    {view === "personal" && <PersonalSchedule />}

    {taskMenu && tasks.find((task) => task.id === taskMenu.taskId) && (() => { const task = tasks.find((item) => item.id === taskMenu.taskId)!; return <div className="task-context-menu" role="menu" style={{ left: taskMenu.x, top: taskMenu.y }} onPointerDown={(event) => event.stopPropagation()} onContextMenu={(event) => event.preventDefault()}><div><strong>{task.title}</strong><span>{task.owner} · {task.category}</span></div>{task.status !== "已完成" && <button onClick={() => completeTask(task.id)}><b>✓</b><span>标记完成<small>进入总览的已完成任务</small></span></button>}<button onClick={() => setEditTaskId(task.id)}><b>✎</b><span>编辑任务<small>负责人、日期与分类</small></span></button>{task.status !== "已完成" && task.owner !== "待分配" && <button className="menu-secondary" onClick={() => moveTask(task.id, "待分配")}><b>↩</b><span>退回待安排<small>取消当前负责人</small></span></button>}<button className="menu-danger" onClick={() => deleteTask(task.id)}><b>×</b><span>删除任务<small>删除后无法恢复</small></span></button></div>; })()}
    {showNew && <div className="modal-layer"><form className="task-modal" onSubmit={createTask}><div className="modal-title"><div><strong>新建任务</strong><span>创建后进入待安排，也可以直接指定负责人</span></div><button type="button" onClick={() => setShowNew(false)}>×</button></div><label>任务名称<input name="title" autoFocus required placeholder="输入一件需要协作的事" /></label><div className="form-row"><label>负责人<select name="owner" defaultValue="xzx"><option>待分配</option>{members.map(member => <option key={member.name}>{member.name}</option>)}</select></label><label>任务分类<select name="category">{categories.map(category => <option key={category}>{category}</option>)}</select></label></div><div className="form-row"><label>计划日期<input name="due" type="date" defaultValue={iso(new Date())} required /></label><label>任务金额（选填）<input name="amount" type="number" min="0" step="0.01" inputMode="decimal" placeholder="不填则不计金额" /></label></div><label>补充说明<textarea name="description" placeholder="说明结果、配合方式或注意事项" /></label><label>Notion 任务笔记<input name="notionUrl" type="url" placeholder="粘贴团队共享的 Notion 页面链接" /></label><button className="modal-submit">创建任务</button></form></div>}
    {editTaskId && <EditTaskModal task={tasks.find((task) => task.id === editTaskId)!} onClose={() => setEditTaskId(null)} onSave={(patch) => { updateTask(editTaskId, patch); setEditTaskId(null); }} />}
  </main>;
}

function OverviewTaskDetail({ task, onClose, onEdit, onAddNote }: { task: Task; onClose: () => void; onEdit: () => void; onAddNote: (note: TaskNote) => void }) {
  const [author, setAuthor] = useState("xzx");
  const [text, setText] = useState("");
  function submitNote(event: FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    onAddNote({ id: Date.now(), author, text: text.trim(), createdAt: preciseTime() });
    setText("");
  }
  return <section className="overview-task-detail"><header><div><div className="detail-overline"><span>任务说明</span><time>{task.due.replaceAll("-", "/")}</time></div><div className="detail-title-row"><strong>{task.title}</strong><span className={`detail-category ${task.category}`}>{task.category}</span><span className="detail-status">{task.status === "待完成" ? "待安排" : task.status === "进行中" ? "正在推进" : "已完成"}</span></div></div><button aria-label="关闭任务说明" onClick={onClose}>×</button></header><div className="task-description-top"><span className="description-label">说明</span><p>{task.description || "还没有补充任务说明。"}</p></div><div className="notion-task-link"><span>任务笔记</span>{task.notionUrl ? <a href={task.notionUrl} target="_blank" rel="noreferrer">打开 Notion ↗</a> : <button type="button" onClick={onEdit}>绑定 Notion 页面</button>}</div><div className="task-conversation"><div className="conversation-title"><strong>任务讨论</strong><span>{(task.notes || []).length} 条</span></div><div className="task-note-list">{(task.notes || []).map((note) => { const noteMember = members.find((item) => item.name === note.author); return <article key={note.id}><i className="avatar" style={{ background: noteMember?.color || "#8b8f9b" }}>{note.author[0]}</i><div><header><strong>{note.author}</strong><time>{note.createdAt}</time></header><p>{note.text}</p></div></article>; })}</div><form className="task-note-form" onSubmit={submitNote}><div><select value={author} onChange={(event) => setAuthor(event.target.value)}>{members.map((item) => <option key={item.name}>{item.name}</option>)}</select><button type="button" onClick={onEdit}>编辑说明</button></div><div className="note-composer"><textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="补充进度、问题或需要谁配合…" /><button type="submit">发送</button></div></form></div></section>;
}
function PanelTitle({ title, note }: { title: string; note: string }) { return <div className="panel-title"><div><strong>{title}</strong><span>{note}</span></div></div>; }
function LibrarySection({ title, tasks, selectedId, dragTaskId, isDropTarget, onSelect, onDragStart, onDragEnd, onContextMenu, onReorder, onDragOver, onDrop }: { title: string; tasks: Task[]; selectedId: number; dragTaskId?: number | null; isDropTarget?: boolean; onSelect: (id: number) => void; onDragStart?: (event: ReactDragEvent<HTMLButtonElement>, id: number) => void; onDragEnd?: () => void; onContextMenu: (event: ReactMouseEvent, id: number) => void; onReorder?: (id: number, beforeId: number) => void; onDragOver?: (event: ReactDragEvent<HTMLElement>) => void; onDrop?: (event: ReactDragEvent<HTMLElement>) => void }) { if (title === "已完成") return null; return <section className={`library-section${isDropTarget ? " is-drop-target" : ""}`} onDragOver={onDragOver} onDrop={(event) => { if (!onReorder) { onDrop?.(event); return; } event.preventDefault(); const id = Number(event.dataTransfer.getData("text/plain")) || dragTaskId; const targets = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>(":scope > button")); const target = targets.find((item) => event.clientY < item.getBoundingClientRect().top + item.getBoundingClientRect().height / 2); if (id && target) onReorder(id, Number(target.dataset.taskId)); else onDrop?.(event); onDragEnd?.(); }}><h3>{title === "待完成" ? "待分配" : title}<span>{tasks.length}</span></h3>{tasks.map(task => <button data-task-id={task.id} draggable={Boolean(onDragStart)} className={`${selectedId === task.id ? "active" : ""}${dragTaskId === task.id ? " dragging" : ""}`} key={task.id} onDragStart={onDragStart ? (event) => onDragStart(event, task.id) : undefined} onDragEnd={onDragEnd} onDragEnter={onReorder ? (event) => { event.preventDefault(); event.stopPropagation(); if (dragTaskId && dragTaskId !== task.id) onReorder(dragTaskId, task.id); } : undefined} onDragOver={onReorder ? (event) => { event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = "move"; const id = Number(event.dataTransfer.getData("text/plain")) || dragTaskId; if (id && id !== task.id) onReorder(id, task.id); } : undefined} onDrop={onReorder ? (event) => { event.preventDefault(); event.stopPropagation(); const id = Number(event.dataTransfer.getData("text/plain")) || dragTaskId; if (id && id !== task.id) onReorder(id, task.id); onDragEnd?.(); } : undefined} onContextMenu={(event) => onContextMenu(event, task.id)} onClick={() => onSelect(task.id)}><strong>{task.title}</strong><small>{task.owner} · {task.category}</small></button>)}</section>; }
function CalendarCard({ task, selected, dragging, overdue, dropPosition, onClick, onContextMenu, onDragStart, onDragEnd, onDragOver, onDrop }: { task: Task; selected: boolean; dragging: boolean; overdue: boolean; dropPosition: "before" | "after" | null; onClick: () => void; onContextMenu: (event: ReactMouseEvent, id: number) => void; onDragStart: (event: ReactDragEvent<HTMLButtonElement>, id: number) => void; onDragEnd: () => void; onDragOver: (event: ReactDragEvent<HTMLButtonElement>) => void; onDrop: (event: ReactDragEvent<HTMLButtonElement>) => void }) { return <button draggable title={overdue ? "已逾期" : undefined} className={`calendar-card ${task.category}${task.status === "已完成" ? " completed" : ""}${overdue ? " overdue" : ""}${selected ? " active" : ""}${dragging ? " dragging" : ""}${dropPosition ? ` insert-${dropPosition}` : ""}`} onClick={onClick} onContextMenu={(event) => onContextMenu(event, task.id)} onDragStart={(event) => onDragStart(event, task.id)} onDragEnd={onDragEnd} onDragOver={onDragOver} onDrop={onDrop}><strong>{task.title}</strong><small className="calendar-meta"><span>{task.owner}{task.status === "已完成" ? " · 已完成" : ""}</span>{task.amount !== undefined && <em className="calendar-card-amount">¥{task.amount}</em>}</small></button>; }
function CategoryColumn({ category, tasks, onOpen, onContextMenu }: { category: Category; tasks: Task[]; onOpen: (id: number) => void; onContextMenu: (event: ReactMouseEvent, id: number) => void }) { const order: Status[] = ["待完成", "进行中", "已完成"]; return <section className={`category-column ${category}`}><header><div><i /><strong>{category}</strong></div><span>{tasks.length}</span></header>{order.map((status) => { const group = tasks.filter((task) => task.status === status); return <div className={`status-group status-${status}`} key={status}><div className="status-heading"><span>{status === "待完成" ? "待安排" : status === "进行中" ? "正在进行" : "已完成"}</span><b>{group.length}</b></div>{group.map((task) => <button className={`overview-task ${task.status === "已完成" ? "done" : ""}`} key={task.id} onContextMenu={(event) => onContextMenu(event, task.id)} onClick={() => onOpen(task.id)}><strong>{task.title}</strong><span>{task.owner} · {task.due.slice(5).replace("-", "/")}</span></button>)}{group.length === 0 && <p>暂无</p>}</div>; })}</section>; }
function EditTaskModal({ task, onClose, onSave }: { task: Task; onClose: () => void; onSave: (patch: Partial<Task>) => void }) { function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); const status = String(data.get("status")) as Status; onSave({ title: String(data.get("title")), owner: String(data.get("owner")), category: String(data.get("category")) as Category, due: String(data.get("due")), amount: optionalAmount(data.get("amount")), description: String(data.get("description")), notionUrl: String(data.get("notionUrl") || "").trim(), status, completedAt: status === "已完成" ? task.completedAt || new Date().toISOString() : undefined }); } return <div className="modal-layer"><form className="task-modal" onSubmit={submit}><div className="modal-title"><div><strong>编辑任务</strong><span>修改任务信息、金额与右侧展示的任务说明</span></div><button type="button" onClick={onClose}>×</button></div><label>任务名称<input name="title" defaultValue={task.title} required /></label><div className="form-row"><label>负责人<select name="owner" defaultValue={task.owner}><option>待分配</option>{members.map(member => <option key={member.name}>{member.name}</option>)}</select></label><label>任务分类<select name="category" defaultValue={task.category}>{categories.map(category => <option key={category}>{category}</option>)}</select></label></div><div className="form-row"><label>计划日期<input name="due" type="date" defaultValue={task.due} required /></label><label>计划进度<select name="status" defaultValue={task.status}><option value="待完成">待安排</option><option value="进行中">正在进行</option><option value="已完成">已完成</option></select></label></div><label>任务金额（选填）<input name="amount" type="number" min="0" step="0.01" inputMode="decimal" defaultValue={task.amount ?? ""} placeholder="不填则不计金额" /></label><label>任务说明<textarea name="description" defaultValue={task.description} placeholder="说明任务目标、完成标准和需要配合的事项" /></label><label>Notion 任务笔记<input name="notionUrl" type="url" defaultValue={task.notionUrl || ""} placeholder="粘贴团队共享的 Notion 页面链接" /></label><button className="modal-submit">保存修改</button></form></div>; }
