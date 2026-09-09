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

test('tagged plans accept legacy data and merge independent category edits without data loss',()=>{
 const week='2026-09-07';const base={...emptyWeekPlan(week),weekly:'原有独立计划'};
 const draft={...base,ballWeekly:'皮球计划'};
 const latest={...base,summary:'本周总结',days:{...base.days,'2026-09-09':'共享记录'},ballWeekly:'其他页面的皮球计划'};
 assert.ok(validWeekPlan(base,week));assert.ok(validWeekPlan(draft,week));
 const result=mergeWeekPlan(base,draft,latest);
 assert.equal(result.weekly,'原有独立计划');assert.equal(result.summary,'本周总结');
 assert.equal(result.ballWeekly,'皮球计划');assert.equal(result.days['2026-09-09'],'共享记录');
 assert.equal(mergeWeekPlan(base,{...base,weekly:'独立更新'},latest).ballWeekly,latest.ballWeekly);
 assert.equal(mergeWeekPlan(latest,{...latest,ballWeekly:''},latest).ballWeekly,'');
 assert.equal(validWeekPlan({...base,ballWeekly:'x'.repeat(10001)},week),false);
 assert.equal(validWeekPlan({...base,ballWeekly:null},week),false);
});

test('daily records and weekly summaries are separate per tag and merge concurrent edits',()=>{
 const week='2026-09-07';const blank=emptyWeekPlan(week);
 const base={...blank,summary:'原有共用总结',days:{...blank.days,[week]:'原有共用记录'},ballWeekly:'原有皮球计划'};
 const draft={...base,ballDays:{...blank.days,[week]:'皮球周一'},ballSummary:'皮球本周总结'};
 const latest={...base,summary:'独立新总结',ballDays:{...blank.days,'2026-09-08':'其他页面皮球周二'}};
 assert.ok(validWeekPlan(draft,week));
 const result=mergeWeekPlan(base,draft,latest);
 assert.equal(result.days[week],'原有共用记录');assert.equal(result.summary,'独立新总结');
 assert.equal(result.ballDays[week],'皮球周一');assert.equal(result.ballDays['2026-09-08'],'其他页面皮球周二');
 assert.equal(result.ballWeekly,'原有皮球计划');assert.equal(result.ballSummary,'皮球本周总结');
 const cleared=mergeWeekPlan(result,{...result,ballSummary:'',ballDays:{...result.ballDays,[week]:''}},result);
 assert.equal(cleared.ballDays[week],'');assert.equal(cleared.ballSummary,'');assert.equal(cleared.days[week],'原有共用记录');
 assert.deepEqual(mergeWeekPlan(base,{...base,weekly:'独立修改'},result).ballDays,result.ballDays);
 assert.equal(validWeekPlan({...draft,ballSummary:'x'.repeat(10001)},week),false);
 assert.equal(validWeekPlan({...draft,ballDays:{[week]:'缺失日期'}},week),false);
 assert.equal(validWeekPlan({...draft,ballDays:{...blank.days,[week]:'x'.repeat(10001)}},week),false);
});
