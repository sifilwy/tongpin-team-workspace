import test from 'node:test';
import assert from 'node:assert/strict';
import {applyRepeatEdit,changedTaskFields} from '../app/lib/personal-repeat-edit.mjs';
const fixtures=()=>[1,2,3,4].map((id)=>({id,title:'钢琴',owner:'xzx',category:'学习',seriesId:'piano',due:`2026-09-${String(id+6).padStart(2,'0')}`,repeatDate:`2026-09-${String(id+6).padStart(2,'0')}`,repeatUntil:'2026-10-07',repeatDays:[1,2,3,4,5],startTime:'09:00',endTime:'10:00',note:`第${id}次总结`,done:id===4}));
test('single edit changes only selected occurrence',()=>{
 const tasks=fixtures();const result=applyRepeatEdit(tasks,2,{title:'练琴',startTime:'10:00',endTime:'11:00',note:'新的总结'},'single');
 assert.equal(result[1].title,'练琴');assert.equal(result[1].note,'新的总结');
 for(const i of [0,2,3])assert.deepEqual(result[i],{...tasks[i],note:'新的总结'});
});
test('following schedule edit skips previous/completed occurrences while notes are shared',()=>{
 const tasks=fixtures();const result=applyRepeatEdit(tasks,2,{title:'练琴',category:'练习',endTime:'10:30',note:'修改本次总结'},'following');
 assert.deepEqual(result[0],{...tasks[0],note:'修改本次总结'});assert.deepEqual(result[3],{...tasks[3],note:'修改本次总结'});
 assert.deepEqual(result.slice(1,3).map(t=>t.title),['练琴','练琴']);
 assert.deepEqual(result.slice(1,3).map(t=>t.endTime),['10:30','10:30']);
 assert.ok(result.every(task=>task.note==='修改本次总结'));
});
test('moving following occurrences shifts dates without putting them on one day',()=>{
 const tasks=fixtures();const result=applyRepeatEdit(tasks,2,{due:'2026-09-10'},'following');
 assert.deepEqual(result.map(t=>t.due),['2026-09-07','2026-09-10','2026-09-11','2026-09-10']);
 assert.equal(result[2].repeatDate,'2026-09-09');
 assert.equal(result[2].repeatUntil,'2026-10-09');
 assert.deepEqual(result[2].repeatDays,[3,4,5,6,0]);
});
test('unchanged fields cannot overwrite future individual titles or notes',()=>{
 const tasks=fixtures();tasks[2].title='单独改过的标题';
 const patch=changedTaskFields(tasks[1],{title:'钢琴',endTime:'11:00',note:'第2次总结'});
 assert.deepEqual(patch,{endTime:'11:00'});
 const result=applyRepeatEdit(tasks,2,patch,'following');
 assert.equal(result[2].title,'单独改过的标题');assert.equal(result[2].note,'第3次总结');
});
