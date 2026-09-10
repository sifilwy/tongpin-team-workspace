const key = 'tongpin-personal-tasks-v3';
import {rememberDocumentUndo} from '../lib/undo-history.mjs';

async function request(options, signal) {
  const response = await fetch(`/api/team?key=${key}`, {
    cache: 'no-store', ...options,
    signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]),
  });
  if (response.status === 401) throw new Error('登录已过期，请重新进入');
  if (!response.ok && response.status !== 409) throw new Error('连接失败，请稍后重试');
  const body = await response.json();
  const document = body.document;
  if (document !== null && (!document || !Number.isInteger(document.revision) || !Array.isArray(document.value))) {
    throw new Error('日程数据暂时无法读取，请重试');
  }
  return { conflict: response.status === 409, document };
}

export async function readTasks(signal) {
  const result = await request({}, signal);
  if (result.conflict) throw new Error('日程正在更新，请重试');
  return result.document;
}

// Rebase only this task's completion flag on the latest whole-document revision.
// Never recreate deleted tasks or overwrite another member's concurrent changes.
export async function saveTaskDone(id, done, signal) {
  let document = await readTasks(signal);
  for (let attempt = 0; attempt < 4; attempt++) {
    const rows = document?.value;
    const matches = rows?.filter(task => task?.id === id);
    if (matches?.length !== 1 || matches[0].owner !== 'xzx') throw new Error('这个任务已被修改或删除，请刷新日程');
    if (matches[0].done === done) return document;
    const result = await request({
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, revision: document.revision, value: rows.map(task => task?.id === id ? { ...task, done } : task) }),
    }, signal);
    document = result.document;
    if (!result.conflict) {
      if (!document?.value.some(task => task?.id === id && task.owner === 'xzx' && task.done === done)) throw new Error('保存尚未确认，请刷新后重试');
      rememberDocumentUndo(key,rows,document.value);
      return document;
    }
  }
  throw new Error('日程正在被更新，请再点一次');
}
