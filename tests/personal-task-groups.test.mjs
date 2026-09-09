import test from 'node:test';
import assert from 'node:assert/strict';
import { groupPersonalTasks } from '../app/lib/personal-task-groups.mjs';

test('repeat series becomes one sidebar entry without deleting any occurrences',()=>{
  const tasks=[{id:1,seriesId:'piano',due:'2026-09-10'},{id:2,seriesId:'piano',due:'2026-09-07'},{id:3,seriesId:'piano',due:'2026-09-09'}];
  const original=JSON.stringify(tasks);
  assert.deepEqual(groupPersonalTasks(tasks),[{task:tasks[1],count:3}]);
  assert.equal(JSON.stringify(tasks),original);
  assert.deepEqual(groupPersonalTasks(tasks.filter(t=>t.id!==2)),[{task:tasks[2],count:2}]);
});
test('same titles without a shared series remain separate and order is retained',()=>{
  const tasks=[{id:1,title:'钢琴',due:'2026-09-10'},{id:2,title:'钢琴',seriesId:'a',due:'2026-09-10'},{id:3,title:'钢琴',seriesId:'b',due:'2026-09-10'},{id:4,title:'钢琴',due:'2026-09-09'},{id:5,title:'钢琴',seriesId:'a',due:'2026-09-09'}];
  const groups=groupPersonalTasks(tasks);
  assert.deepEqual(groups.map(g=>g.task.id),[1,5,3,4]);
  assert.deepEqual(groups.map(g=>g.count),[1,2,1,1]);
});
