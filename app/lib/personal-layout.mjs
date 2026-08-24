/** @typedef {{ id: number, startTime: string, endTime: string }} LayoutTask */

export const toMinutes = (value = "09:00") => {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
};

export const toTime = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/**
 * Assigns every overlapping interval to a parallel column. Intervals that only
 * touch at an endpoint do not overlap. Connected overlap groups share a stable
 * column count, so two, three, or more simultaneous tasks never cover each other.
 * @param {LayoutTask[]} dayTasks
 * @returns {Map<number, { column: number, columns: number }>}
 */
export function computeOverlapLayout(dayTasks) {
  const result = new Map();
  const sorted = [...dayTasks].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime) || toMinutes(a.endTime) - toMinutes(b.endTime));
  /** @type {LayoutTask[]} */
  let group = [];
  let groupEnd = -1;
  const placeGroup = () => {
    /** @type {number[]} */
    const columnEnds = [];
    /** @type {{ task: LayoutTask, column: number }[]} */
    const assigned = [];
    group.forEach((task) => {
      const start = toMinutes(task.startTime);
      const end = Math.max(start + 15, toMinutes(task.endTime));
      let column = columnEnds.findIndex((columnEnd) => columnEnd <= start);
      if (column < 0) column = columnEnds.length;
      columnEnds[column] = end;
      assigned.push({ task, column });
    });
    assigned.forEach(({ task, column }) => result.set(task.id, { column, columns: columnEnds.length }));
  };
  sorted.forEach((task) => {
    const start = toMinutes(task.startTime);
    const end = Math.max(start + 15, toMinutes(task.endTime));
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
