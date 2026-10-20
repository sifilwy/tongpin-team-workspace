import {test} from 'node:test';
import assert from 'node:assert/strict';
import {syncFromPersonal,syncFromTeam,initializeTaskSync,TEAM_TASKS,PERSONAL_TASKS} from '../app/lib/task-sync.mjs';
const p={id:10,title:'本周会议',owner:'xzx',category:'运营',due:'2026-10-20',done:false,note:'准备材料',startTime:'14:00',endTime:'15:00'};
const t={id:20,title:'本周会议',owner:'xzx',category:'运营',due:'2026-10-20',status:'进行中',description:'准备材料',reviews:[{id:1,text:'原来的讨论',author:'czl'}],assistants:['吃吃']};
test('bootstrap links exact counterparts, preserves private tasks, metadata and schedules, runs once',()=>{
 const privateTask={...p,id:11,category:'独立'};
 const state={documents:{[TEAM_TASKS]:{revision:2,value:[t]},[PERSONAL_TASKS]:{revision:4,value:[p,privateTask]}}};
 assert.equal(initializeTaskSync(state),true);
 assert.equal(state.documents[TEAM_TASKS].value.length,1);
 assert.deepEqual(state.documents[PERSONAL_TASKS].value.find(x=>x.id===11),privateTask);
 const linked=state.documents[PERSONAL_TASKS].value.find(x=>x.id===10);
 assert.equal(linked.teamTaskId,20);assert.equal(linked.startTime,'14:00');
 assert.deepEqual(state.documents[TEAM_TASKS].value[0].reviews,t.reviews);
 const saved=structuredClone(state);assert.equal(initializeTaskSync(state),false);assert.deepEqual(state,saved);
});
test('team task creation, reassignment, note edits, completion and deletion flow to personal',()=>{
 let result=syncFromTeam([], [t], []);
 const id=result.personal[0].id;
 assert.equal(result.personal[0].due,t.due);
 result=syncFromTeam([t],[{...t,owner:'czl',description:'修改备注',status:'已完成'}],result.personal);
 assert.deepEqual([result.personal[0].id,result.personal[0].owner,result.personal[0].note,result.personal[0].done],[id,'czl','修改备注',true]);
 assert.equal(syncFromTeam([t],[],result.personal).personal.length,0);
 assert.equal(syncFromTeam([t],[{...t,owner:'待分配'}],result.personal).personal.length,0);
});
test('personal create, time changes, repeat metadata and deletion preserve collaboration discussions',()=>{
 let result=syncFromPersonal([], [{...p,seriesId:'series',repeatRule:'daily',repeatUntil:'2026-11-20'}], [], 'xzx');
 const before=result.personal;
 result.team[0].reviews=t.reviews;
 result=syncFromPersonal(before,before.map(x=>({...x,startTime:'16:00',endTime:'17:00',note:'修改',done:true})),result.team,'czl','2026-10-20T12:00:00Z');
 assert.equal(result.team[0].status,'已完成');assert.equal(result.team[0].completedBy,'czl');
 assert.equal(result.team[0].personalSchedule.seriesId,'series');assert.equal(result.team[0].personalSchedule.startTime,'16:00');
 assert.deepEqual(result.team[0].reviews,t.reviews);
 assert.equal(syncFromPersonal(result.personal,[],result.team,'xzx').team.length,0);
 // Ctrl+Z can restore the deleted personal entry and its collaboration metadata.
 const restored=syncFromPersonal([],result.personal,[],'xzx');
 assert.equal(restored.team[0].id,result.team[0].id);assert.deepEqual(restored.team[0].reviews,t.reviews);
});
test('independent opt-out removes collaboration task, opt-in restores same identity and comments',()=>{
 const first=syncFromTeam([], [t], []);
 const privateResult=syncFromPersonal(first.personal,first.personal.map(x=>({...x,category:'独立'})),first.team,'xzx');
 assert.equal(privateResult.team.length,0);assert.equal(privateResult.personal[0].teamTaskId,undefined);
 const shared=syncFromPersonal(privateResult.personal,privateResult.personal.map(x=>({...x,category:'生活'})),[],'xzx');
 assert.equal(shared.team[0].id,20);assert.deepEqual(shared.team[0].reviews,t.reviews);
});
test('pending tasks retain planned date on unrelated edits, scheduling updates both sides',()=>{
 const waiting={...t,status:'待完成'};
 let result=syncFromTeam([], [waiting], []);
 assert.equal(result.personal[0].due,null);
 result=syncFromPersonal(result.personal,result.personal.map(x=>({...x,note:'只改备注'})),result.team,'xzx');
 assert.equal(result.team[0].status,'待完成');assert.equal(result.team[0].due,'2026-10-20');
 result=syncFromPersonal(result.personal,result.personal.map(x=>({...x,due:'2026-10-21'})),result.team,'xzx');
 assert.equal(result.team[0].status,'进行中');assert.equal(result.team[0].due,'2026-10-21');
});
test('all-member tasks stay a single shared record and repeated same-title dates stay distinct',()=>{
 const input=[{...p,owner:'全员',seriesId:'repeat'},{...p,id:11,owner:'全员',due:'2026-10-21',seriesId:'repeat'},{...p,id:12,category:'独立'}];
 const r=syncFromPersonal([],input,[],'xzx');assert.equal(r.team.length,2);
 const next=syncFromTeam(r.team,r.team,r.personal);
 assert.equal(next.personal.length,3);assert.equal(next.personal.filter(p=>p.owner==='全员').length,2);
});
test('collaboration note changes keep repeat notes unified without changing other dates',()=>{
 const first={...t,personalSchedule:{seriesId:'s',startTime:'10:00',endTime:'11:00'}};
 const second={...first,id:21,due:'2026-10-21'};
 const before=syncFromTeam([], [first,second], []);
 const after=syncFromTeam(before.team,[{...first,description:'统一备注'},second],before.personal);
 assert.deepEqual(after.team.map(t=>t.description),['统一备注','统一备注']);
 assert.deepEqual(after.personal.map(p=>p.note),['统一备注','统一备注']);
 assert.deepEqual(after.personal.map(p=>p.due),['2026-10-20','2026-10-21']);
});
