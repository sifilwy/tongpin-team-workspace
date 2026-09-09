import test from 'node:test';
import assert from 'node:assert/strict';
import {unifyRepeatNotes} from '../app/lib/personal-shared-notes.mjs';
import {applyRepeatEdit} from '../app/lib/personal-repeat-edit.mjs';
test('legacy series notes are shared without losing distinct text; normalization is idempotent',()=>{
 const tasks=[{id:1,seriesId:'a',due:'2026-09-09',note:'甲'},{id:2,seriesId:'a',due:'2026-09-10',note:'乙',done:true},{id:3,seriesId:'a',due:'2026-09-11',note:'甲'},{id:4,seriesId:'b',note:'另一组'},{id:5,note:'普通备注'}];
 const next=unifyRepeatNotes(tasks);
 assert.deepEqual(next.map(t=>t.note),['甲\n\n乙','甲\n\n乙','甲\n\n乙','另一组','普通备注']);
 assert.equal(unifyRepeatNotes(next),next);
 assert.equal(tasks[0].note,'甲');
});
test('editing or clearing any occurrence note updates its entire series only',()=>{
 const tasks=[{id:1,seriesId:'a',note:'旧备注'},{id:2,seriesId:'a',note:'旧备注',done:true},{id:3,seriesId:'b',note:'其他'}];
 const updated=applyRepeatEdit(tasks,2,{note:'统一备注'},'single');
 assert.deepEqual(updated.map(t=>t.note),['统一备注','统一备注','其他']);
 const cleared=applyRepeatEdit(updated,1,{note:''},'single');
 assert.deepEqual(cleared.map(t=>t.note),['','','其他']);
 assert.equal(unifyRepeatNotes(cleared),cleared);
});
