export const weekPlanKey = (owner, week) => `tongpin-week-plan-v1:${owner}:${week}`;
export function isWeeklyPlanKey(key) {
  if(typeof key !== 'string') return false;
  const match=key.match(/^tongpin-week-plan-v1:(xzx|吃吃|czl|子涵|悦悦):(\d{4}-\d{2}-\d{2})$/);
  if(!match) return false;
  const date=new Date(`${match[2]}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10)===match[2] && date.getUTCDay()===1;
}
export function weekPlanDates(week) {
  return Array.from({length:7},(_,index)=>{const date=new Date(`${week}T12:00:00Z`);date.setUTCDate(date.getUTCDate()+index);return date.toISOString().slice(0,10);});
}
export const emptyWeekPlan = week => ({weekly:'',summary:'',days:Object.fromEntries(weekPlanDates(week).map(date=>[date,'']))});
export function validWeekPlan(value, week) {
  if(!value || Array.isArray(value) || typeof value!=='object' || Object.keys(value).some(key=>!['weekly','summary','days','ballWeekly','ballDays','ballSummary'].includes(key))) return false;
  const text=value=>typeof value==='string' && value.length<=10000;
  if(Object.hasOwn(value,'ballWeekly') && !text(value.ballWeekly)) return false;
  if(Object.hasOwn(value,'ballSummary') && !text(value.ballSummary)) return false;
  if(!text(value.weekly) || !text(value.summary) || !value.days || Array.isArray(value.days) || typeof value.days!=='object') return false;
  const dates=weekPlanDates(week);
  if(Object.hasOwn(value,'ballDays') && (!value.ballDays || Array.isArray(value.ballDays) || typeof value.ballDays!=='object' || Object.keys(value.ballDays).length!==7 || !dates.every(date=>text(value.ballDays[date])))) return false;
  return Object.keys(value.days).length===7 && dates.every(date=>text(value.days[date]));
}
export function mergeWeekPlan(base, draft, latest) {
  return {
    weekly:draft.weekly===base.weekly ? latest.weekly : draft.weekly,
    summary:draft.summary===base.summary ? latest.summary : draft.summary,
    days:Object.fromEntries(Object.keys(draft.days).map(date=>[date,draft.days[date]===base.days[date] ? latest.days[date] : draft.days[date]])),
    ...(Object.hasOwn(draft,'ballWeekly') || Object.hasOwn(latest,'ballWeekly') ? {ballWeekly:(draft.ballWeekly || '')===(base.ballWeekly || '') ? latest.ballWeekly || '' : draft.ballWeekly || ''}:{}),
    ...(Object.hasOwn(draft,'ballSummary') || Object.hasOwn(latest,'ballSummary') ? {ballSummary:(draft.ballSummary || '')===(base.ballSummary || '') ? latest.ballSummary || '' : draft.ballSummary || ''}:{}),
    ...(draft.ballDays || latest.ballDays ? {ballDays:Object.fromEntries(Object.keys(draft.days).map(date=>[date,(draft.ballDays?.[date] || '')===(base.ballDays?.[date] || '') ? latest.ballDays?.[date] || '' : draft.ballDays?.[date] || '']))}:{}),
  };
}
