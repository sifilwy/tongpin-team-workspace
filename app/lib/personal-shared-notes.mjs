/** Preserve all distinct legacy notes when a series first becomes shared. */
export function unifyRepeatNotes(tasks) {
  const notes = new Map();
  for (const task of [...tasks].sort((a,b)=>(a.repeatDate || a.due || '').localeCompare(b.repeatDate || b.due || ''))) {
    if (!task.seriesId) continue;
    const values = notes.get(task.seriesId) || [];
    const note = typeof task.note === 'string' ? task.note.trim() : '';
    if (note && !values.includes(note)) values.push(note);
    notes.set(task.seriesId, values);
  }
  let changed = false;
  const next = tasks.map(task=>{
    if(!task.seriesId) return task;
    const note = notes.get(task.seriesId).join('\n\n');
    if(note === (task.note || '')) return task;
    changed = true;
    return {...task,note};
  });
  return changed ? next : tasks;
}
