"use client";
import { useEffect, useRef } from "react";
import ReviewNotes from "./ReviewNotes";

export default function TaskReviewDialog({ task, onClose }: { task: { id: number; title: string }; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close(); }, []);
  return <dialog ref={dialog} className="task-review-dialog" aria-labelledby="task-review-title" onCancel={onClose}>
    <header className="task-review-heading"><div><span>任务复盘</span><h2 id="task-review-title">{task.title}</h2></div><button type="button" aria-label="关闭复盘" onClick={onClose}>×</button></header>
    <ReviewNotes key={task.id} taskId={task.id} />
  </dialog>;
}
