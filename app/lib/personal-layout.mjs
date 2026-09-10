/** @typedef {{ id: number, startTime: string, endTime: string }} LayoutTask */

export const toMinutes = (value = "09:00") => {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
};

export const toTime = (minutes) => `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

export const DAY_START = 7 * 60;
export const DAY_END = 26 * 60;
// A calendar column continues after midnight until 02:00 on the next date.
export const scheduleMinutes = (value) => {
  const minute = toMinutes(value);
  return minute < DAY_START ? minute + 1440 : minute;
};
export const scheduleTimeLabel = (value) => `${toMinutes(value) < DAY_START ? '次日 ' : ''}${value}`;
const dateKey = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const shiftDate = (date, offset) => { const next = new Date(date); next.setDate(next.getDate()+offset); return next; };

export function currentTimePosition(now) {
  const minute = now.getHours()*60 + now.getMinutes();
  if (minute > 120 && minute < DAY_START) return null;
  const afterMidnight = minute <= 120;
  return { due:dateKey(afterMidnight ? shiftDate(now,-1) : now), minute:minute + (afterMidnight ? 1440 : 0), label:`${afterMidnight ? '次日 ' : ''}${toTime(minute)}` };
}

export function calendarDates(now, count = 7, offset = 0) {
  const start = new Date(now);
  // Keep the current overnight portion visible, including Sunday into Monday.
  if (start.getHours()*60+start.getMinutes() <= 120) start.setDate(start.getDate()-1);
  start.setHours(12,0,0,0);
  if (count === 7) start.setDate(start.getDate()-((start.getDay()+6)%7));
  return Array.from({length:count},(_,index)=>shiftDate(start,offset*count+index));
}

/**
 * Assigns every overlapping interval to a parallel column. Intervals that only
 * touch at an endpoint do not overlap. Connected overlap groups share a stable
 * column count, so two, three, or more simultaneous tasks never cover each other.
 * @param {LayoutTask[]} dayTasks
 * @returns {Map<number, { column: number, columns: number }>}
 */
export function computeOverlapLayout(dayTasks) {
  const result = new Map();
  const sorted = [...dayTasks].sort((a, b) => scheduleMinutes(a.startTime) - scheduleMinutes(b.startTime) || scheduleMinutes(a.endTime) - scheduleMinutes(b.endTime));
  /** @type {LayoutTask[]} */
  let group = [];
  let groupEnd = -1;
  const placeGroup = () => {
    /** @type {number[]} */
    const columnEnds = [];
    /** @type {{ task: LayoutTask, column: number }[]} */
    const assigned = [];
    group.forEach((task) => {
      const start = scheduleMinutes(task.startTime);
      const end = Math.max(start + 15, scheduleMinutes(task.endTime));
      let column = columnEnds.findIndex((columnEnd) => columnEnd <= start);
      if (column < 0) column = columnEnds.length;
      columnEnds[column] = end;
      assigned.push({ task, column });
    });
    assigned.forEach(({ task, column }) => result.set(task.id, { column, columns: columnEnds.length }));
  };
  sorted.forEach((task) => {
    const start = scheduleMinutes(task.startTime);
    const end = Math.max(start + 15, scheduleMinutes(task.endTime));
    if (group.length && start >= groupEnd) {
      placeGroup();
      group = [];
      groupEnd = -1;
    }
    group.push(task);
    groupEnd = Math.max(groupEnd, end);
  });
  if (group.length) placeGroup();
  return result;
}

export function snapStart({ clientY, trackTop, trackHeight, grabOffset = 0, duration = 60, dayStart, dayEnd, step = 15 }) {
  const pixelsPerMinute = trackHeight / (dayEnd - dayStart);
  const rawStart = dayStart + (clientY - trackTop - grabOffset) / pixelsPerMinute;
  const snapped = Math.round(rawStart / step) * step;
  return Math.max(dayStart, Math.min(snapped, dayEnd - duration));
}
