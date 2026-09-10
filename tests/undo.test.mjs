import test from 'node:test';
import assert from 'node:assert/strict';
import {reverseChange,rememberUndo,forgetUndo,undoLast,canUndo} from '../app/lib/undo-history.mjs';

test('undo changes only edited task fields and retains other members updates',()=>{
 const before=[{id:1,title:'原名',done:false,note:'原备注'},{id:2,title:'另一任务'}];
 const after=[{...before[0],title:'改名',done:true},before[1]];
 const current=[{...after[0],note:'其他成员的新备注'},after[1],{id:3,title:'新增的其他任务'}];
 assert.deepEqual(reverseChange(before,after,current),[{...before[0],note:'其他成员的新备注'},before[1],current[2]]);
 assert.equal(current[0].title,'改名');
 assert.throws(()=>reverseChange(before,after,[{...after[0],title:'又被修改'},after[1]]),/后续修改/);
});
test('undo additions, deletions and reordering without deleting new unrelated tasks',()=>{
 const a={id:1,title:'a'},b={id:2,title:'b'},c={id:3,title:'c'};
 assert.deepEqual(reverseChange([a],[a,b],[a,b,c]),[a,c]);
 assert.deepEqual(reverseChange([a,b],[b],[b,c]),[a,b,c]);
 assert.deepEqual(reverseChange([a,b],[b,a],[b,a,c]),[a,b,c]);
 assert.throws(()=>reverseChange([a],[a,b],[a,{...b,title:'别人的修改'}]),/后续修改/);
});
test('undo a weekly plan leaves other tags and days untouched',()=>{
 const before={weekly:'原计划',ballWeekly:'皮球',days:{mon:'周一',tue:''}};
 const after={...before,weekly:'新计划',days:{...before.days,mon:'修改周一'}};
 const current={...after,ballWeekly:'皮球新计划',days:{...after.days,tue:'其他页面的周二'}};
 assert.deepEqual(reverseChange(before,after,current),{...before,ballWeekly:'皮球新计划',days:{mon:'周一',tue:'其他页面的周二'}});
});
test('undo history runs backwards and retains entries on failure',async()=>{
 const scope=Symbol();const calls=[];
 rememberUndo(scope,()=>calls.push(1));rememberUndo(scope,()=>calls.push(2));
 assert.equal(await undoLast(),true);assert.equal(await undoLast(),true);assert.deepEqual(calls,[2,1]);
 rememberUndo(scope,()=>{throw Error('offline');});await assert.rejects(undoLast(),/offline/);assert.equal(canUndo(),true);
 forgetUndo(scope);assert.equal(canUndo(),false);
});
