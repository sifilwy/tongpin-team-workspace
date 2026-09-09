import test from 'node:test';
import assert from 'node:assert/strict';
import {weekPlanKey,isWeeklyPlanKey,weekPlanDates,emptyWeekPlan,validWeekPlan,mergeWeekPlan} from '../app/lib/weekly-plan.mjs';
test('weekly storage keys isolate member/week and reject invalid Mondays',()=>{
 assert.ok(isWeeklyPlanKey(weekPlanKey('xzx','2026-09-07')));
 assert.notEqual(weekPlanKey('xzx','2026-09-07'),weekPlanKey('xzx','2026-09-14'));
 assert.notEqual(weekPlanKey('xzx','2026-09-07'),weekPlanKey('czl','2026-09-07'));
 for(const key of ['tongpin-week-plan-v1:xzx:2026-09-08','tongpin-week-plan-v1:unknown:2026-09-07','tongpin-week-plan-v1:xzx:2026-02-30'])assert.equal(isWeeklyPlanKey(key),false);
});
test('days span month/year boundaries and plan fields stay inside selected week',()=>{
 assert.deepEqual(weekPlanDates('2026-12-28'),['2026-12-28','2026-12-29','2026-12-30','2026-12-31','2027-01-01','2027-01-02','2027-01-03']);
 const plan=emptyWeekPlan('2026-09-07');assert.ok(validWeekPlan(plan,'2026-09-07'));
 assert.equal(validWeekPlan({...plan,days:{...plan.days,'2026-09-14':'wrong week'}},'2026-09-07'),false);
 assert.equal(validWeekPlan({...plan,summary:'a'.repeat(10001)},'2026-09-07'),false);
});
test('conflict merge preserves remotely updated days and only changes edited fields',()=>{
 const base=emptyWeekPlan('2026-09-07');
 const draft={...base,weekly:'本周计划',days:{...base.days,'2026-09-07':'周一安排'}};
 const latest={...base,summary:'他处总结',days:{...base.days,'2026-09-08':'周二安排'}};
 const merged=mergeWeekPlan(base,draft,latest);
 assert.equal(merged.weekly,'本周计划');assert.equal(merged.summary,'他处总结');
 assert.equal(merged.days['2026-09-07'],'周一安排');assert.equal(merged.days['2026-09-08'],'周二安排');
});
