const dateFrom = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) throw new Error('请先选择安排日期');
  const date = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== value) throw new Error('日期无效');
  return date;
};
export const repeatLabels = { daily: '每天', weekdays: '工作日（周一至周五）', weekly: '每周同一天', custom: '每周自选' };
export const repeatWeekdays = [{day:1,name:'周一'},{day:2,name:'周二'},{day:3,name:'周三'},{day:4,name:'周四'},{day:5,name:'周五'},{day:6,name:'周六'},{day:0,name:'周日'}];
export const repeatDescription = (rule, days = []) => rule === 'custom' ? `每周 ${repeatWeekdays.filter(item=>days.includes(item.day)).map(item=>item.name).join('、')}` : repeatLabels[rule];
export function defaultRepeatUntil(start) {
  const date = dateFrom(start);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + 2);
  date.setUTCDate(0);
  date.setUTCDate(Math.min(day, date.getUTCDate()));
  return date.toISOString().slice(0,10);
}
export function repeatDates(start, until, rule, weekdays = []) {
  if (!Object.hasOwn(repeatLabels, rule)) throw new Error('请选择重复方式');
  const first = dateFrom(start), last = dateFrom(until);
  if (last < first) throw new Error('结束日期不能早于安排日期');
  if (rule === 'custom' && (!Array.isArray(weekdays) || !weekdays.length || weekdays.some(day=>!Number.isInteger(day) || day<0 || day>6))) throw new Error('请至少勾选一周中的一天');
  if (last - first > 366 * 5 * 86400000) throw new Error('重复范围最多为五年，请缩短结束日期');
  const result = [];
  for (const day = new Date(first); day <= last; day.setUTCDate(day.getUTCDate() + 1)) {
    const weekday = day.getUTCDay();
    if (rule === 'weekdays' && (weekday === 0 || weekday === 6)) continue;
    if (rule === 'weekly' && weekday !== first.getUTCDay()) continue;
    if (rule === 'custom' && !weekdays.includes(weekday)) continue;
    result.push(day.toISOString().slice(0,10));
    if (result.length > 1000) throw new Error('一次最多生成 1000 次日程，请缩短结束日期');
  }
  if (!result.length) throw new Error('所选日期范围内没有符合条件的日程');
  return result;
}
