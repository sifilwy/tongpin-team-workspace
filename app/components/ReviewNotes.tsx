"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useMember } from "./TeamAccess";
import "../review-notes.css";

type ReviewNote = { id: number; author: string; text: string; createdAt: string; taskId?: number };

export default function ReviewNotes({ taskId }: { taskId: number }) {
  const member = useMember();
  const [notes, setNotes] = useState<ReviewNote[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const key = "tongpin-review-notes-v1";
  useEffect(() => {
    let stopped = false;
    fetch(`/api/team?key=${key}`).then(async response => {
      if (!response.ok) throw new Error("复盘暂时加载失败，请刷新后重试。");
      const data = await response.json();
      if (!stopped) setNotes(data.document?.value || []);
    }).catch(error => { if (!stopped) setError(error.message); }).finally(() => { if (!stopped) setLoading(false); });
    return () => { stopped = true; };
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!text.trim() || saving || loading) return;
    const note = { id: Date.now(), author: member, text: text.trim(), createdAt: new Date().toISOString(), taskId };
    setSaving(true); setError("");
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const current = await fetch(`/api/team?key=${key}`);
        if (!current.ok) throw new Error("连接失败，文字已保留，请重试。");
        const { document } = await current.json();
        const response = await fetch("/api/team", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, revision: document?.revision || 0, value: [note, ...(document?.value || []).filter((item: ReviewNote) => item.id !== note.id)] }) });
        const data = await response.json();
        if (response.status === 409) continue;
        if (!response.ok) throw new Error(data.error || "保存失败，文字已保留，请重试。");
        setNotes(data.document.value); setText(""); return;
      }
      throw new Error("其他成员正在更新，文字已保留，请再次保存。");
    } catch (error) { setError(error instanceof Error ? error.message : "保存失败，文字已保留，请重试。"); }
    finally { setSaving(false); }
  }
  const visibleNotes = notes.filter(note => note.taskId === taskId);
  return <section className="review-notes" aria-label="任务复盘">
    <form onSubmit={submit}>
      <label htmlFor="review-note">写下复盘</label>
      <p>记录这项任务的收获、问题和下一步。</p>
      <textarea id="review-note" value={text} onChange={event => setText(event.target.value)} maxLength={10000} required disabled={saving} placeholder="这次有什么收获？下次准备怎么做？" />
      <footer><span>{member} · {loading ? "正在加载…" : "保存到当前任务"}</span><button disabled={!text.trim() || saving || loading}>{saving ? "正在保存…" : "保存复盘"}</button></footer>
      {error && <p role="alert">{error}</p>}
    </form>

    <div className="review-note-list" aria-live="polite">
      {!loading && visibleNotes.length === 0 && <p className="review-note-empty">暂无复盘记录。</p>}
      {[...visibleNotes].sort((a, b) => b.id - a.id).map(note => <article key={note.id}>
        <header><strong>{note.author}</strong><time dateTime={note.createdAt}>{new Date(note.createdAt).toLocaleString("zh-CN", { hour12: false })}</time></header>
        <p>{note.text}</p>
      </article>)}
    </div>
  </section>;
}
