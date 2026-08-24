"use client";

import { FormEvent, MouseEvent as ReactMouseEvent, useState } from "react";
import { categories, members, Category, Review, Task } from "../lib/model";

type Props = {
  tasks: Task[];
  activeCategory: Category;
  focusTaskId: number | null;
  onCategoryChange: (category: Category) => void;
  onUpdateTask: (id: number, patch: Partial<Task>) => void;
  onContextMenu: (event: ReactMouseEvent, id: number) => void;
  onExit: () => void;
};

const completedDate = (task: Task) => task.completedAt
  ? new Date(task.completedAt).toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" })
  : "—";

const preciseTime = () => {
  const now = new Date();
  return `${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
};

export default function CompletedWorkspace({ tasks, focusTaskId, onUpdateTask, onContextMenu, onExit }: Props) {
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const completed = tasks.filter((task) => task.status === "已完成");
  const selected = completed.find((task) => task.id === selectedTaskId) ?? null;

  return <section className="completed-workspace">
    <button className="completed-exit" onClick={onExit}>‹ 返回人员分配</button>
    <header className="completed-header">
      <div><span>协作总览</span><h1>已完成任务</h1></div>
      <div><b>{completed.length}</b><small>项任务</small></div>
    </header>
    <div className={`completed-body${selected ? " has-communication" : ""}`}>
      <div className="completed-groups">
        {categories.map((category) => <section className={`completed-group ${category}`} key={category}>
          <header><h2>{category}</h2><span>{completed.filter((task) => task.category === category).length}</span></header>
          <div className="completed-list">
            {completed.filter((task) => task.category === category).map((task) => <CompletedTaskRow key={task.id} task={task} focused={task.id === focusTaskId} selected={task.id === selectedTaskId} onOpen={() => setSelectedTaskId(task.id)} onContextMenu={(event) => onContextMenu(event, task.id)} onUpdate={(patch) => onUpdateTask(task.id, patch)} />)}
          </div>
        </section>)}
      </div>
      {selected && <CommunicationPanel task={selected} onClose={() => setSelectedTaskId(null)} onUpdate={(patch) => onUpdateTask(selected.id, patch)} />}
    </div>
  </section>;
}

function CompletedTaskRow({ task, focused, selected, onOpen, onUpdate, onContextMenu }: { task: Task; focused: boolean; selected: boolean; onOpen: () => void; onUpdate: (patch: Partial<Task>) => void; onContextMenu: (event: ReactMouseEvent) => void }) {
  function redo() {
    onUpdate({ status: task.owner === "待分配" ? "待完成" : "进行中", completedAt: undefined, completedBy: undefined, deliverable: undefined });
  }

  return <article className={`completed-task-card${focused ? " focused" : ""}${selected ? " selected" : ""}`} onClick={onOpen} onContextMenu={onContextMenu}>
    <div className="completed-task-head"><button className="completed-task-open" type="button">{task.title}</button><span className="completed-by">{task.completedBy || task.owner}</span></div>
    <div className="completed-task-meta"><time>{completedDate(task)}</time><button type="button" onClick={(event) => { event.stopPropagation(); redo(); }}>重做</button></div>
  </article>;
}

function CommunicationPanel({ task, onClose, onUpdate }: { task: Task; onClose: () => void; onUpdate: (patch: Partial<Task>) => void }) {
  const [author, setAuthor] = useState(members[0].name);
  const [text, setText] = useState("");

  function send(event: FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    const message: Review = { id: Date.now(), author, text: text.trim(), createdAt: preciseTime() };
    onUpdate({ reviews: [...task.reviews, message] });
    setText("");
  }

  return <aside className="completed-communication-panel">
    <header><div><span>任务沟通</span><strong>{task.title}</strong><small>完成人：{task.completedBy || "待确认"} · {completedDate(task)}</small></div><button aria-label="关闭沟通面板" onClick={onClose}>×</button></header>
    {task.notionUrl && <a className="completed-notion-link" href={task.notionUrl} target="_blank" rel="noreferrer">打开 Notion 任务笔记 ↗</a>}
    <div className="completed-communication-list">{task.reviews.length === 0 ? <p className="communication-empty">还没有沟通记录</p> : task.reviews.map((message) => <article key={message.id}><div><strong>{message.author}</strong><time>{message.createdAt}</time></div><p>{message.text}</p></article>)}</div>
    <form className="completed-communication-form" onSubmit={send}><select value={author} onChange={(event) => setAuthor(event.target.value)}>{members.map((member) => <option key={member.name}>{member.name}</option>)}</select><textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="补充沟通、结果或需要配合的事项…" /><button>发送</button></form>
  </aside>;
}
