/**
 * Sidebar only: keep the first position of a series, but open its earliest
 * unfinished occurrence. Callers separate member, category and status first.
 * @template {{id:number,seriesId?:string,due?:string|null,startTime?:string}} T
 * @param {T[]} tasks
 * @returns {{task:T,count:number}[]}
 */
export function groupPersonalTasks(tasks) {
  const entries = [];
  const series = new Map();
  const dateKey = task => `${task.due || ''} ${task.startTime || ''}`;
  for (const task of tasks) {
    const entry = task.seriesId ? series.get(task.seriesId) : undefined;
    if (entry) {
      entry.count++;
      if (dateKey(task) < dateKey(entry.task)) entry.task = task;
    } else {
      const next = { task, count: 1 };
      entries.push(next);
      if (task.seriesId) series.set(task.seriesId, next);
    }
  }
  return entries;
}
