export const scheduleFields = ['title','owner','category','due','startTime','endTime'];
const shiftDate = (date, offset) => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0,10);
};
export const changedTaskFields = (task, patch) => Object.fromEntries(Object.entries(patch).filter(([key,value])=>JSON.stringify(task[key])!==JSON.stringify(value)));
export const laterOccurrence = (task, anchor) => Boolean(anchor.seriesId && task.seriesId === anchor.seriesId && (task.repeatDate || task.due || '') > (anchor.repeatDate || anchor.due || '') && !task.done);

/** Apply only changed schedule fields to future unfinished occurrences.
 * Notes are shared by the entire series, independently of schedule scope. Date changes
 * shift each future date by the same offset instead of collapsing onto one day.
 */
export function applyRepeatEdit(tasks, id, patch, scope) {
  const anchor = tasks.find(task=>task.id===id);
  if (!anchor) return tasks;
  const shared = Object.fromEntries(Object.entries(patch).filter(([key])=>scheduleFields.includes(key)));
  if(Object.hasOwn(shared,'startTime') || Object.hasOwn(shared,'endTime')) {
    shared.startTime = patch.startTime ?? anchor.startTime;
    shared.endTime = patch.endTime ?? anchor.endTime;
  }
  const anchorDate = anchor.due || anchor.repeatDate;
  const shift = Object.hasOwn(shared,'due') && anchorDate && shared.due ? Math.round((new Date(`${shared.due}T12:00:00Z`)-new Date(`${anchorDate}T12:00:00Z`))/86400000) : 0;
  const dates = task => shift ? {
    ...(task.repeatUntil ? {repeatUntil:shiftDate(task.repeatUntil,shift)} : {}),
    ...(task.repeatDays?.length ? {repeatDays:task.repeatDays.map(day=>(day+shift%7+7)%7)} : {}),
  } : {};
  return tasks.map(task=>{
    const note = anchor.seriesId && task.seriesId === anchor.seriesId && Object.hasOwn(patch,'note') ? {note:patch.note} : {};
    if(task.id===id) return {...task,...patch,...(scope==='following' ? dates(task) : {})};
    if(scope!=='following' || !laterOccurrence(task,anchor)) return Object.keys(note).length ? {...task,...note} : task;
    const next = {...shared};
    if(Object.hasOwn(shared,'due')) next.due = shared.due === null ? null : task.due || task.repeatDate ? shiftDate(task.due || task.repeatDate,shift) : null;
    return {...task,...next,...dates(task),...note};
  });
}
