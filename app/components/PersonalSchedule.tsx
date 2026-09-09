"use client";
import { useSharedState } from "../lib/use-shared-state";
import { useMember } from "./TeamAccess";
import { restorePersonalCategories } from "../lib/personal-categories";
import { categoryPalette, personalPalette } from "../lib/personal-colors.mjs";
import { repeatDates, repeatLabels, repeatDescription } from "../lib/personal-repeat.mjs";
import PersonalRepeatFields from "./PersonalRepeatFields";
import { groupPersonalTasks } from "../lib/personal-task-groups.mjs";
import { applyRepeatEdit, changedTaskFields, laterOccurrence, scheduleFields } from "../lib/personal-repeat-edit.mjs";
import PersonalRepeatScope from "./PersonalRepeatScope";
import { unifyRepeatNotes } from "../lib/personal-shared-notes.mjs";
import WeeklyPlanDialog from "./WeeklyPlanDialog";

import { CSSProperties, FormEvent, MouseEvent, PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { computeOverlapLayout, snapStart, toMinutes, toTime } from "../lib/personal-layout.mjs";

type Owner = "xzx" | "吃吃" | "czl" | "子涵" | "悦悦";
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
  seriesId?: string;
  repeatRule?: keyof typeof repeatLabels;
  repeatUntil?: string;
  repeatDate?: string;
  repeatDays?: number[];
};

const PEOPLE: { name: Owner; color: string }[] = [
  { name: "xzx", color: "#d99b39" },
  { name: "吃吃", color: "#e8795c" },
  { name: "czl", color: "#2f9b8f" },
  { name: "子涵", color: "#5488d7" },
  { name: "悦悦", color: "#6c5ce7" },
];
const createDefaultCategories = (): Record<Owner, string[]> => ({
  xzx: ["独立"],
  吃吃: ["独立"],
  czl: ["独立"],
  子涵: ["独立"],
  悦悦: ["独立"],
});
const TASK_KEY = "tongpin-personal-tasks-v3";
const LEGACY_TASK_KEY = "tongpin-personal-tasks-v2";
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
  { id: 904, title: "跟进今日咨询反馈", owner: "xzx", due: iso(addDays(new Date(), 1)), done: false, category: "独立", note: "", startTime: "10:30", endTime: "11:30" },
  { id: 905, title: "补充个人学习清单", owner: "xzx", due: null, done: false, category: "独立", note: "", startTime: "14:00", endTime: "15:00" },
  { id: 906, title: "完成个人周报初稿", owner: "xzx", due: iso(new Date()), done: true, category: "独立", note: "", startTime: "15:30", endTime: "16:30" },
];

export default function PersonalSchedule() {
  const member = useMember() as Owner;
  const [tasks, setTasks] = useSharedState<PersonalTask[]>(TASK_KEY, starterTasks);
  useEffect(()=>{setTasks(current=>unifyRepeatNotes(current));},[tasks]);
  const [savedCategories, setSavedCategories] = useSharedState<Record<Owner, string[]>>(CATEGORY_KEY, createDefaultCategories);
  const [savedColors, setSavedColors] = useSharedState<Record<string, Record<string, string>>>("tongpin-personal-category-colors-v1", {});
  const [colorCategory, setColorCategory] = useState<string | null>(null);
  function categoryStyle(taskOwner: Owner, category: string): CSSProperties {
    const palette = categoryPalette(savedColors, taskOwner, category);
    return { "--category-color": palette.color, "--category-background": palette.background, "--category-border": palette.border } as CSSProperties;
  }
  const categories = useMemo(() => restorePersonalCategories(savedCategories, tasks), [savedCategories, tasks]);
  function setCategories(update: (current: Record<Owner, string[]>) => Record<Owner, string[]>) {
    setSavedCategories(current => update(restorePersonalCategories(current, tasks)));
  }
  const [owner, setOwner] = useState<Owner>(member);
  const [allView, setAllView] = useState(false);
  const [completedView, setCompletedView] = useState(false);
  const [openCategories, setOpenCategories] = useState<Record<Owner, string[]>>(() => createDefaultCategories());
  const [weekOffset, setWeekOffset] = useState(0);
  const [planContext,setPlanContext] = useState<{owner:Owner;week:string} | null>(null);
  const [calendarToday,setCalendarToday] = useState(()=>iso(new Date()));
  useEffect(()=>{const timer=window.setInterval(()=>setCalendarToday(iso(new Date())),60000);return()=>window.clearInterval(timer);},[]);
  const [dragId, setDragId] = useState<number | null>(null);
  const [dropKey, setDropKey] = useState<string | null>(null);
  const [editing, setEditing] = useState<PersonalTask | null>(null);
  const [newDefaults, setNewDefaults] = useState<{ due: string | null; owner: Owner; category?: string; startTime?: string; endTime?: string } | null>(null);
  const selection = useRef<{ pointerId: number; startY: number; anchor: number; due: string; owner: Owner; track: HTMLDivElement } | null>(null);
  const [newRange, setNewRange] = useState<{ due: string; start: number; end: number } | null>(null);
  function rangeAt(clientY: number, track: HTMLDivElement, anchor?: number) {
    const bounds = track.getBoundingClientRect();
    const minute = Math.max(DAY_START, Math.min(DAY_END, Math.round((DAY_START + (clientY - bounds.top) / bounds.height * (DAY_END - DAY_START)) / 15) * 15));
    const start = Math.min(DAY_END - 15, Math.min(anchor ?? minute, minute));
    return { start, end: Math.min(DAY_END, Math.max(start + 15, anchor ?? minute, minute)), minute };
  }
  function beginRange(event: ReactPointerEvent<HTMLDivElement>, due: string) {
    if (event.button !== 0 || !event.isPrimary || event.pointerType === "touch" || event.target !== event.currentTarget) return;
    event.preventDefault();
    const track = event.currentTarget;
    selection.current = { pointerId: event.pointerId, startY: event.clientY, anchor: rangeAt(event.clientY, track).minute, due, owner: allView ? member : owner, track };
    track.setPointerCapture(event.pointerId);
  }
  function updateRange(event: ReactPointerEvent<HTMLDivElement>) {
    const current = selection.current;
    if (!current || current.pointerId !== event.pointerId || Math.abs(event.clientY - current.startY) < 4) return;
    const { start, end } = rangeAt(event.clientY, current.track, current.anchor);
    setNewRange({ due: current.due, start, end });
  }
  function finishRange(event: ReactPointerEvent<HTMLDivElement>) {
    const current = selection.current;
    if (!current || current.pointerId !== event.pointerId) return;
    selection.current = null; setNewRange(null);
    if (current.track.hasPointerCapture(event.pointerId)) current.track.releasePointerCapture(event.pointerId);
    if (Math.abs(event.clientY - current.startY) < 4) return;
    const { start, end } = rangeAt(event.clientY, current.track, current.anchor);
    openNew({ due: current.due, owner: current.owner, startTime: toTime(start), endTime: toTime(end) });
  }
  function cancelRange() { selection.current = null; setNewRange(null); }
  useEffect(() => {
    const cancel = (event: KeyboardEvent) => { if (event.key === "Escape") cancelRange(); };
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, []);
  const [modalOwner, setModalOwner] = useState<Owner>("xzx");
  const [modalDue, setModalDue] = useState("");
  const [formError, setFormError] = useState("");
  const [repeatChange, setRepeatChange] = useState<{id:number;patch:Partial<PersonalTask>;beforeId?:number;fromEditor:boolean} | null>(null);
  const [menu, setMenu] = useState<{ id: number; x: number; y: number } | null>(null);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [renamingCategory, setRenamingCategory] = useState<string | null>(null);
  const [categoryDraft, setCategoryDraft] = useState("");
  const [dragPreview, setDragPreview] = useState<{ due: string; startTime: string; endTime: string } | null>(null);
  const dragPreviewRef = useRef<{ due: string; startTime: string; endTime: string } | null>(null);
  const tasksRef = useRef<PersonalTask[]>(starterTasks);
  const edgeHover = useRef<{ direction: -1 | 0 | 1; since: number }>({ direction: 0, since: 0 });
  const edgeTimer = useRef<number | null>(null);
  const dragOffsetY = useRef(0);
  const pointerDrag = useRef<{ id: number; pointerId: number; startX: number; startY: number; active: boolean; edge?: "start" | "end"; track?: HTMLElement; originalStart?: number; originalEnd?: number } | null>(null);
  const suppressClick = useRef(false);

  useEffect(() => { tasksRef.current = tasks; }, [tasks]);
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
    const cancel = () => { pointerDrag.current = null; endDrag(); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") cancel(); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", escape);
    window.addEventListener("blur", cancel);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", escape);
      window.removeEventListener("blur", cancel);
    };
  }, [allView, dragPreview, owner, tasks]);
  useEffect(() => () => {
    if (edgeTimer.current !== null) window.clearTimeout(edgeTimer.current);
  }, []);

  const now = new Date(`${calendarToday}T12:00:00`);
  const weekStart = addDays(mondayOf(now), weekOffset * 7);
  const dates = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const filtered = useMemo(() => tasks.filter((task) => allView || task.owner === owner), [allView, owner, tasks]);
  const completedTasks = useMemo(() => tasks.filter((task) => task.done).sort((a, b) => (b.due || "").localeCompare(a.due || "")), [tasks]);

  function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = newCategoryName.trim();
    if (!value || categories[owner].includes(value)) return;
    setCategories((current) => ({ ...current, [owner]: [...current[owner], value] }));
    setOpenCategories((current) => ({ ...current, [owner]: [...new Set([...current[owner], value])] }));
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
    setSavedColors(current => {
      const colors = { ...current?.[owner] };
      if (Object.hasOwn(colors, previous)) { const color = colors[previous]; delete colors[previous]; colors[value] = color; }
      return { ...current, [owner]: colors };
    });
    setCategories((current) => ({ ...current, [owner]: current[owner].map((item) => item === previous ? value : item) }));
    setOpenCategories((current) => ({ ...current, [owner]: current[owner].map((item) => item === previous ? value : item) }));
    setTasks((current) => current.map((task) => task.owner === owner && task.category === previous ? { ...task, category: value } : task));
    setRenamingCategory(null);
    setCategoryDraft("");
    setColorCategory(null);
  }

  function openNew(defaults: { due: string | null; owner: Owner; category?: string; startTime?: string; endTime?: string }) {
    setModalDue(defaults.due || ""); setFormError("");
    setModalOwner(defaults.owner);
    setEditing(null);
    setNewDefaults(defaults);
  }

  function openEditor(task: PersonalTask) {
    setModalDue(task.due || ""); setFormError("");
    setModalOwner(task.owner);
    setNewDefaults(null);
    setEditing(task);
  }

  function moveTask(id: number, patch: Partial<PersonalTask>, beforeId?: number) {
    const task = tasks.find(item=>item.id===id);
    if (!task) return;
    const changed = changedTaskFields(task,patch);
    if (task.seriesId && Object.keys(changed).some(key=>scheduleFields.includes(key))) {
      setRepeatChange({id,patch:changed,beforeId,fromEditor:false}); return;
    }
    moveSingleTask(id,changed,beforeId);
  }

  function moveSingleTask(id: number, patch: Partial<PersonalTask>, beforeId?: number) {
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

  function confirmRepeatChange(scope: "single" | "following") {
    if (!repeatChange) return;
    const {id,patch,beforeId,fromEditor} = repeatChange;
    if(scope === "single" && !fromEditor) moveSingleTask(id,patch,beforeId);
    else setTasks(current=>applyRepeatEdit(current,id,patch,scope));
    setRepeatChange(null);
    if(fromEditor) {setEditing(null);setNewDefaults(null);}
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
    const duration = Math.max(15, toMinutes(task.endTime) - toMinutes(task.startTime));
    moveTask(id, { due, owner: allView ? task.owner : owner, startTime, endTime: toTime(Math.min(DAY_END, start + duration)) });
  }

  function pointerPreview(clientY: number, track: HTMLElement, due: string) {
    const bounds = track.getBoundingClientRect();
    const moving = tasks.find((task) => task.id === pointerDrag.current?.id);
    const duration = moving ? Math.max(15, toMinutes(moving.endTime) - toMinutes(moving.startTime)) : 60;
    const safeStart = snapStart({ clientY, trackTop: bounds.top, trackHeight: bounds.height, grabOffset: dragOffsetY.current, duration, dayStart: DAY_START, dayEnd: DAY_END });
    const preview = { due, startTime: toTime(safeStart), endTime: toTime(safeStart + duration) };
    dragPreviewRef.current = preview;
    setDragPreview(preview);
    setDropKey(due);
    return preview;
  }

  function startPointerDrag(event: ReactPointerEvent<HTMLButtonElement>, id: number) {
    if (event.button !== 0) return;
    const task = tasks.find((item) => item.id === id);
    const bounds = event.currentTarget.getBoundingClientRect();
    dragOffsetY.current = task?.due ? Math.max(0, event.clientY - bounds.top) : 0;
    pointerDrag.current = { id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, active: false };
  }

  function startResize(event: ReactPointerEvent<HTMLElement>, task: PersonalTask, edge: "start" | "end") {
    if (event.button !== 0 || !event.isPrimary) return;
    event.preventDefault(); event.stopPropagation(); setMenu(null);
    const track = event.currentTarget.closest<HTMLElement>(".personal-day-track");
    if (!track) return;
    pointerDrag.current = { id: task.id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, active: false, edge, track, originalStart: toMinutes(task.startTime), originalEnd: toMinutes(task.endTime) };
  }

  function movePointerDrag(event: Pick<PointerEvent, "pointerId" | "clientX" | "clientY">) {
    const pointer = pointerDrag.current;
    if (!pointer || pointer.pointerId !== event.pointerId) return;
    if (!pointer.active && Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) < 5) return;
    pointer.active = true;
    suppressClick.current = true;
    setDragId(pointer.id);
    if (pointer.edge && pointer.track?.dataset.due) {
      const timeline = pointer.track.closest<HTMLElement>(".personal-timeline-shell");
      if (timeline) {
        const bounds = timeline.getBoundingClientRect();
        if (event.clientY > bounds.bottom - 30) timeline.scrollTop += 14;
        else if (event.clientY < bounds.top + 60) timeline.scrollTop -= 14;
      }
      const bounds = pointer.track.getBoundingClientRect();
      const minute = Math.round((DAY_START + (event.clientY - bounds.top) / bounds.height * (DAY_END - DAY_START)) / 15) * 15;
      const start = pointer.edge === "start" ? Math.max(DAY_START, Math.min(pointer.originalEnd! - 15, minute)) : pointer.originalStart!;
      const end = pointer.edge === "end" ? Math.min(DAY_END, Math.max(start + 15, minute)) : pointer.originalEnd!;
      const preview = { due: pointer.track.dataset.due, startTime: toTime(start), endTime: toTime(end) };
      dragPreviewRef.current = preview; setDragPreview(preview); setDropKey(preview.due);
      return;
    }
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
    const statusTarget = target?.closest<HTMLElement>("[data-personal-status]");
    if (statusTarget?.dataset.personalStatus && statusTarget.dataset.categoryName) {
      const listItem = target?.closest<HTMLElement>("[data-pending-id]");
      dragPreviewRef.current = null;
      setDragPreview(null);
      setDropKey(listItem ? `list-${listItem.dataset.pendingId}` : `status-${statusTarget.dataset.categoryName}-${statusTarget.dataset.personalStatus}`);
      return;
    }
    const categoryTarget = target?.closest<HTMLElement>("[data-personal-category]");
    if (categoryTarget?.dataset.personalCategory) {
      dragPreviewRef.current = null;
      setDragPreview(null);
      setDropKey(`category-${categoryTarget.dataset.personalCategory}`);
      return;
    }
    dragPreviewRef.current = null;
    setDragPreview(null);
    setDropKey(null);
  }

  function finishPointerDrag(event: Pick<PointerEvent, "pointerId" | "clientX" | "clientY">) {
    const pointer = pointerDrag.current;
    if (!pointer || pointer.pointerId !== event.pointerId) return;
    if (pointer.edge) {
      const preview = dragPreviewRef.current;
      if (pointer.active && preview) moveTask(pointer.id, { startTime: preview.startTime, endTime: preview.endTime });
      pointerDrag.current = null; endDrag(); return;
    }
    if (pointer.active) {
      const target = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
      const track = target?.closest<HTMLElement>(".personal-day-track");
      const listTarget = target?.closest<HTMLElement>("[data-pending-id]");
      const statusTarget = target?.closest<HTMLElement>("[data-personal-status]");
      const categoryTarget = target?.closest<HTMLElement>("[data-personal-category]");
      const preview = dragPreviewRef.current;
      if (track?.dataset.due && preview?.due === track.dataset.due) scheduleTaskAt(pointer.id, preview.due, preview.startTime);
      else if (statusTarget?.dataset.personalStatus && statusTarget.dataset.categoryName) {
        const moving = tasks.find((task) => task.id === pointer.id);
        const pendingStatus = statusTarget.dataset.personalStatus === "pending";
        moveTask(pointer.id, { owner, category: statusTarget.dataset.categoryName, due: pendingStatus ? null : moving?.due || iso(now), done: false }, listTarget ? Number(listTarget.dataset.pendingId) : undefined);
      }
      else if (categoryTarget?.dataset.personalCategory) moveTask(pointer.id, { category: categoryTarget.dataset.personalCategory });
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
    if (editing?.seriesId) {
      const changed=changedTaskFields(editing,patch);
      if(Object.keys(changed).some(key=>scheduleFields.includes(key))) {
        setRepeatChange({id:editing.id,patch:changed,fromEditor:true}); return;
      }
    }
    const rule = String(data.get("repeatRule") || "none");
    if (rule !== "none" && !editing?.seriesId) {
      try {
        const until = String(data.get("repeatUntil") || "");
        const repeatDays = data.getAll("repeatDays").map(Number);
        const occurrences = repeatDates(due, until, rule, repeatDays);
        const seriesId = crypto.randomUUID();
        const nextId = Math.max(Date.now(), ...tasks.map(task => task.id + 1));
        const repeats = occurrences.map((date: string, index: number): PersonalTask => ({
          ...patch, id: editing && index === 0 ? editing.id : nextId + index, due: date,
          done: index === 0 ? editing?.done || false : false,
          note: patch.note, seriesId, repeatRule: rule as keyof typeof repeatLabels, repeatUntil: until, repeatDate: date, repeatDays,
        }));
        setTasks(current => [...repeats, ...current.filter(task => task.id !== editing?.id)]);
      } catch (error) { setFormError((error as Error).message); return; }
    } else if (editing) setTasks((current) => applyRepeatEdit(current,editing.id,changedTaskFields(editing,patch),"single"));
    else setTasks((current) => [{ id: Math.max(Date.now(), ...current.map(task => task.id + 1)), done: false, ...patch }, ...current]);
    setEditing(null);
    setNewDefaults(null);
  }

  function stopRepeating(task: PersonalTask) {
    const from = task.repeatDate || task.due || iso(now);
    const future = tasks.filter(item => item.seriesId === task.seriesId && (item.repeatDate || item.due || "") > from && !item.done);
    if (!window.confirm(`停止这次之后的重复？将移除 ${future.length} 次未完成日程，保留本次和已完成记录。`)) return;
    setTasks(current => current.filter(item => !(item.seriesId === task.seriesId && (item.repeatDate || item.due || "") > from && !item.done)).map(item => item.seriesId === task.seriesId ? {...item, repeatUntil: from} : item));
    setMenu(null); setEditing(null);
  }

  function selectPerson(nextOwner: Owner) {
    setOwner(nextOwner);
    setAllView(false);
    setCompletedView(false);
    setAddingCategory(false);
    setNewCategoryName("");
    setRenamingCategory(null);
    setCategoryDraft("");
  }

  function toggleCategory(item: string) {
    setOpenCategories((current) => ({
      ...current,
      [owner]: current[owner].includes(item) ? current[owner].filter((name) => name !== item) : [...current[owner], item],
    }));
  }

  function openMenu(event: MouseEvent, id: number) {
    event.preventDefault();
    setMenu({ id, x: Math.min(event.clientX, window.innerWidth - 185), y: Math.min(event.clientY, window.innerHeight - 210) });
  }

  const movingTask = tasks.find(task => task.id === dragId);
  const previewConflicts = dragPreview ? tasks.filter(task => task.id !== dragId && task.owner === movingTask?.owner && task.due === dragPreview.due && toMinutes(task.startTime) < toMinutes(dragPreview.endTime) && toMinutes(task.endTime) > toMinutes(dragPreview.startTime)).length : 0;
  return <section className={`personal-v2 ${dragId !== null ? "is-dragging" : ""}`}>
    <aside className="personal-sidebar">
      <div className="personal-segment">{PEOPLE.map((person) => <button key={person.name} className={owner === person.name && !allView ? "active" : ""} onClick={() => selectPerson(person.name)}>{person.name}</button>)}</div>
        <div className="personal-side-title"><div><strong>{owner} 的待办</strong><span>拖到右侧日期即可安排</span></div><button onClick={() => openNew({ owner, due: null })}>＋</button></div>
        <div className="personal-categories">
          {categories[owner].map((item) => {
            const categoryTasks = tasks.filter((task) => task.owner === owner && task.category === item && !task.done);
            const pendingTasks = categoryTasks.filter((task) => task.due === null);
            const activeTasks = categoryTasks.filter((task) => task.due !== null);
            const pendingEntries = groupPersonalTasks(pendingTasks);
            const activeEntries = groupPersonalTasks(activeTasks);
            const opened = openCategories[owner].includes(item);
            if (renamingCategory === item) return <form className="personal-category-form" key={item} onSubmit={renameCategory}><input autoFocus aria-label="修改分类名称" value={categoryDraft} onChange={(event) => setCategoryDraft(event.target.value)} onFocus={(event) => event.currentTarget.select()} /><button aria-label="保存分类名称">✓</button><button type="button" aria-label="取消修改分类" onClick={() => { setRenamingCategory(null); setCategoryDraft(""); }}>×</button></form>;
            const renderTask = ({task, count}: {task: PersonalTask; count: number}, status: "pending" | "active") => <button key={task.seriesId || task.id} data-pending-id={task.id} data-repeat-group={task.seriesId} title={task.seriesId ? `本次：${task.due || "待安排"} ${task.startTime}–${task.endTime}；打开或拖动后可选择修改范围` : undefined} draggable={false} className={`${dragId === task.id ? "dragging" : ""} ${dropKey === `list-${task.id}` ? "insert-before" : ""}`} onPointerDown={(event) => startPointerDrag(event, task.id)} onClick={() => clickTask(task)} onContextMenu={(event) => openMenu(event, task.id)}><strong>{task.title}</strong><small>{status === "pending" ? "待安排" : `${task.seriesId ? "最近未完成" : "正在进行"} · ${task.due?.slice(5).replace("-", "/")}`}</small>{task.seriesId && <span className="personal-series-count">↻ 重复 · 剩余 {count} 次</span>}</button>;
            return <section className="personal-category-section" key={item} style={categoryStyle(owner, item)}>
              <div data-personal-category={item} className={`personal-category-row ${dropKey === `category-${item}` ? "is-over" : ""}`}><button className={opened ? "active" : ""} aria-expanded={opened} onClick={() => toggleCategory(item)}><i>{opened ? "⌄" : "›"}</i><span>{item}</span><b>{pendingEntries.length + activeEntries.length}</b></button><button type="button" className="personal-category-color" aria-label={`设置${item}配色`} title="分类配色" aria-expanded={colorCategory === item} onClick={() => setColorCategory(colorCategory === item ? null : item)}><i /></button><button className="personal-category-rename" title="修改分类名称" aria-label={`修改${item}分类名称`} onClick={() => { setAddingCategory(false); setRenamingCategory(item); setCategoryDraft(item); }}>✎</button></div>
              {colorCategory === item && <div className="personal-color-picker" role="group" aria-label={`${item}配色`}>{personalPalette.map(palette => <button key={palette.id} type="button" aria-label={palette.name} aria-pressed={categoryPalette(savedColors, owner, item).id === palette.id} style={{background: palette.color}} onClick={() => { setSavedColors(current => ({...current, [owner]: {...current?.[owner], [item]: palette.id}})); setColorCategory(null); }} />)}</div>}{opened && <div className="personal-category-panel">
                <div className={`personal-status-block ${dropKey === `status-${item}-pending` ? "is-over" : ""}`} data-personal-status="pending" data-category-name={item}><header><span>待安排</span><div className="personal-pending-actions"><b>{pendingEntries.length}</b><button type="button" aria-label={`添加${item}待安排任务`} title="添加待安排任务" onClick={()=>openNew({owner,due:null,category:item})}>＋</button></div></header><div className="personal-pending-list">{pendingEntries.map((entry) => renderTask(entry, "pending"))}</div></div>
                <div className={`personal-status-block ${dropKey === `status-${item}-active` ? "is-over" : ""}`} data-personal-status="active" data-category-name={item}><header><span>正在进行</span><b>{activeEntries.length}</b></header><div className="personal-pending-list">{activeEntries.map((entry) => renderTask(entry, "active"))}</div></div>
              </div>}
            </section>;
          })}
          {addingCategory ? <form className="personal-category-form" onSubmit={addCategory}><input autoFocus aria-label="新分类名称" value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} placeholder="分类名称" /><button aria-label="保存分类">✓</button><button type="button" aria-label="取消新增分类" onClick={() => { setAddingCategory(false); setNewCategoryName(""); }}>×</button></form> : <button className="add-category" onClick={() => { setRenamingCategory(null); setCategoryDraft(""); setAddingCategory(true); }}>＋ 新增分类</button>}
        </div>
    </aside>

    <main className="personal-main">
      <header className="personal-topbar"><div><span>{completedView ? "全部成员" : allView ? "全部成员" : owner}</span><strong>{completedView ? "已完成任务" : `${weekStart.getFullYear()}年${String(weekStart.getMonth() + 1).padStart(2, "0")}月`}</strong></div><div className="personal-top-actions"><button className={`all-view-button ${allView ? "active" : ""}`} onClick={() => { if (allView) { setAllView(false); setCompletedView(false); } else setAllView(true); }}>{allView ? "返回我的日程" : "查看全员"}</button>{allView && <button className={`personal-completed-button ${completedView ? "active" : ""}`} onClick={() => setCompletedView((value) => !value)}>已完成 <b>{completedTasks.length}</b></button>}<button type="button" className="personal-plan-button" onClick={()=>setPlanContext({owner:allView ? member : owner,week:iso(weekStart)})}>计划</button><button className="personal-create" onClick={() => openNew({ owner: allView ? "xzx" : owner, due: iso(now) })}>＋ 添加</button>{!completedView && <div className="personal-week-switch"><button aria-label="上一周" onClick={() => setWeekOffset((value) => value - 1)}>‹</button><button onClick={() => setWeekOffset(0)}>本周</button><button aria-label="下一周" onClick={() => setWeekOffset((value) => value + 1)}>›</button></div>}</div></header>

      {completedView ? <section className="personal-completed-view"><header><div><strong>全部已完成</strong><span>先集中放在这里，后续再细分</span></div><b>{completedTasks.length}</b></header><div className="personal-completed-grid">{completedTasks.map((task) => { const person = PEOPLE.find((item) => item.name === task.owner)!; return <button key={task.id} onClick={() => clickTask(task)} onContextMenu={(event) => openMenu(event, task.id)}><i style={{ background: person.color }}>{task.owner[0]}</i><span><strong>{task.title}</strong><small>{task.owner} · {task.category} · {task.due?.replaceAll("-", "/") || "未安排"}</small></span><em>已完成</em></button>; })}</div></section> : <>
      {dragId !== null && <><div className="personal-edge prev" /><div className="personal-edge next" /></>}
      <div className="personal-timeline-shell">
        <aside className="personal-time-axis"><header /><div>{HOURS.map((hour) => <span key={hour} style={{ top: `${((hour * 60 - DAY_START) / (DAY_END - DAY_START)) * 100}%` }}>{String(hour).padStart(2, "0")}:00</span>)}</div></aside>
        <div className="personal-calendar">{dates.map((date, index) => {
          const due = iso(date);
          const dayTasks = filtered.filter((task) => task.due === due).map(task => pointerDrag.current?.edge && task.id === dragId && dragPreview ? {...task, ...dragPreview} : task).sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
          const overlapLayout = computeOverlapLayout(dayTasks);
          return <section key={due} className={`personal-date ${due === iso(now) ? "today" : ""} ${dropKey === due ? "is-over" : ""}`}>
            <header><span>{["周一", "周二", "周三", "周四", "周五", "周六", "周日"][index]}</span><b>{date.getDate()}</b></header>
            <div className="personal-day-track" data-due={due} onPointerDown={event => beginRange(event, due)} onPointerMove={updateRange} onPointerUp={finishRange} onPointerCancel={cancelRange} onLostPointerCapture={cancelRange}>{newRange?.due === due && <div className="personal-new-range" style={{ top: `${(newRange.start - DAY_START) / (DAY_END - DAY_START) * 100}%`, height: `${(newRange.end - newRange.start) / (DAY_END - DAY_START) * 100}%` }}><span>{toTime(newRange.start)}–{toTime(newRange.end)}</span></div>}{dragPreview?.due === due && <div className={`personal-drop-preview ${previewConflicts ? "has-conflict" : ""}`} style={{ top: `${((toMinutes(dragPreview.startTime) - DAY_START) / (DAY_END - DAY_START)) * 100}%`, height: `${(toMinutes(dragPreview.endTime) - toMinutes(dragPreview.startTime)) / (DAY_END - DAY_START) * 100}%` }}><span className="personal-preview-start" role="status">{dragPreview.startTime}–{dragPreview.endTime} · {toMinutes(dragPreview.endTime) - toMinutes(dragPreview.startTime)} 分钟{previewConflicts > 0 && ` · 与 ${previewConflicts} 项日程重叠`}</span><span className="personal-preview-end">{dragPreview.endTime}</span></div>}{dayTasks.map((task) => {
              const person = PEOPLE.find((item) => item.name === task.owner)!;
              const start = Math.max(DAY_START, toMinutes(task.startTime));
              const end = Math.min(DAY_END, Math.max(start + 15, toMinutes(task.endTime)));
              const placement = overlapLayout.get(task.id) || { column: 0, columns: 1 };
              const width = 100 / placement.columns;
              const style = { ...categoryStyle(task.owner, task.category), top: `${((start - DAY_START) / (DAY_END - DAY_START)) * 100}%`, height: `calc(${((end - start) / (DAY_END - DAY_START)) * 100}% - 4px)`, left: `calc(${placement.column * width}% + 3px)`, width: `calc(${width}% - 6px)` };
              return <button key={task.id} data-schedule-id={task.id} title={`${task.title}
${task.startTime}–${task.endTime}
${task.owner} · ${task.category}${task.note?.trim() ? `
${task.note}` : ""}`} style={style} draggable={false} className={`personal-card ${end - start <= 30 ? "compact" : ""} ${task.done ? "done" : ""} ${dragId === task.id ? "dragging" : ""}`} onPointerDown={(event) => startPointerDrag(event, task.id)} onClick={() => clickTask(task)} onContextMenu={(event) => openMenu(event, task.id)}><strong>{task.seriesId && <span className="personal-repeat-mark" aria-label="重复日程">↻ </span>}{task.title}</strong><time>{task.startTime}–{task.endTime}</time><small><i style={{ background: person.color }}>{task.owner[0]}</i>{allView && task.owner}<em>{task.category}</em></small>{task.note?.trim() && <span className="personal-card-summary">{task.note}</span>}{(["start", "end"] as const).map(edge => <span key={edge} className={`personal-resize-handle ${edge}`} data-resize-edge={edge} title={edge === "start" ? "拖动调整开始时间" : "拖动调整结束时间"} onPointerDown={event => startResize(event, task, edge)} onClick={event => { event.preventDefault(); event.stopPropagation(); }} />)}</button>;
            })}</div>
          </section>;
        })}</div>
      </div></>}
    </main>

    {menu && (() => { const task = tasks.find((item) => item.id === menu.id); if (!task) return null; return <div className="personal-context" style={{ left: menu.x, top: menu.y }} onPointerDown={(event) => event.stopPropagation()}><strong>{task.title}</strong><button onClick={() => { setTasks((current) => current.map((item) => item.id === task.id ? { ...item, done: !item.done } : item)); setMenu(null); }}>{task.done ? "恢复未完成" : "标记完成"}</button><button onClick={() => { openEditor(task); setMenu(null); }}>修改任务</button>{task.due && <button onClick={() => { moveTask(task.id, { due: null, done: false }); setMenu(null); }}>移回待办</button>}{task.seriesId && <button onClick={() => stopRepeating(task)}>停止后续重复</button>}<button className="danger" onClick={() => { if (window.confirm(`确认删除“${task.title}”？`)) setTasks((current) => current.filter((item) => item.id !== task.id)); setMenu(null); }}>删除任务</button></div>; })()}

    {(editing || newDefaults) && <div className="personal-modal-bg"><form className="personal-edit-modal" onSubmit={submitTask}><header><strong>{editing ? "修改个人任务" : "新建个人任务"}</strong><button type="button" onClick={() => { setEditing(null); setNewDefaults(null); }}>×</button></header><label>任务名称<input name="title" autoFocus required defaultValue={editing?.title || ""} placeholder="准备完成什么" /></label><div><label>成员<select name="owner" value={modalOwner} onChange={(event) => setModalOwner(event.target.value as Owner)}>{PEOPLE.map((person) => <option key={person.name}>{person.name}</option>)}</select></label><label>个人分类<select key={modalOwner} name="category" defaultValue={editing?.owner === modalOwner && categories[modalOwner].includes(editing.category) ? editing.category : newDefaults?.owner === modalOwner && newDefaults.category && categories[modalOwner].includes(newDefaults.category) ? newDefaults.category : categories[modalOwner][0]}>{categories[modalOwner].map((item) => <option key={item}>{item}</option>)}</select></label></div><label>安排日期<input name="due" type="date" value={modalDue} onChange={event => setModalDue(event.target.value)} /><small>留空则进入左侧待办</small></label><div className="personal-time-fields"><label>开始时间<input name="startTime" type="time" step="900" defaultValue={editing?.startTime || newDefaults?.startTime || "09:00"} /></label><label>结束时间<input name="endTime" type="time" step="900" defaultValue={editing?.endTime || newDefaults?.endTime || "10:00"} /></label></div>{editing?.seriesId ? <section className="personal-repeat-info"><strong>{editing.repeatRule ? repeatDescription(editing.repeatRule, editing.repeatDays) : "重复日程"} · 至 {editing.repeatUntil}</strong><p>保存时可选择修改本次或本次及以后。备注在整组重复日程中统一共享。</p><button type="button" onClick={() => stopRepeating(editing)}>停止后续重复</button></section> : <PersonalRepeatFields due={modalDue} />}{formError && <p className="personal-form-error" role="alert">{formError}</p>}<label>备注<textarea name="note" defaultValue={editing?.note || ""} placeholder="写下这项日程的备注（选填）" /></label><button className="save">保存</button></form></div>}
    {planContext && <WeeklyPlanDialog key={`${planContext.owner}:${planContext.week}`} owner={planContext.owner} week={planContext.week} pending={tasks.filter(task=>task.owner===planContext.owner && !task.done && task.due===null)} categories={categories[planContext.owner]} onAddPending={(title,category)=>setTasks(current=>[{id:Math.max(Date.now(),...current.map(task=>task.id+1)),title,category,owner:planContext.owner,due:null,done:false,note:'',startTime:'09:00',endTime:'10:00'},...current])} onClose={()=>setPlanContext(null)} />}
    {repeatChange && (() => { const task=tasks.find(item=>item.id===repeatChange.id); return task ? <PersonalRepeatScope title={task.title} date={task.due || ""} futureCount={tasks.filter(item=>laterOccurrence(item,task)).length} onChoose={confirmRepeatChange} onCancel={()=>setRepeatChange(null)} /> : null; })()}
  </section>;
}
