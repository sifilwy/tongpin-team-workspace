import test from 'node:test';
import assert from 'node:assert/strict';
import { repeatDates, defaultRepeatUntil } from '../app/lib/personal-repeat.mjs';
import { categoryPalette } from '../app/lib/personal-colors.mjs';

test('daily repeats cross month/year and include the end date',()=>{
  assert.deepEqual(repeatDates('2026-12-30','2027-01-02','daily'),['2026-12-30','2026-12-31','2027-01-01','2027-01-02']);
  assert.deepEqual(repeatDates('2028-02-28','2028-03-01','daily'),['2028-02-28','2028-02-29','2028-03-01']);
});
test('weekdays skip weekends and weekly repeats retain the starting weekday',()=>{
  assert.deepEqual(repeatDates('2026-09-11','2026-09-15','weekdays'),['2026-09-11','2026-09-14','2026-09-15']);
  assert.deepEqual(repeatDates('2026-09-07','2026-09-21','weekly'),['2026-09-07','2026-09-14','2026-09-21']);
  assert.throws(()=>repeatDates('2026-09-12','2026-09-13','weekdays'));
});
test('invalid or excessive recurrence cannot create partial schedules',()=>{
  for(const args of [['','2026-12-01','daily'],['2026-02-30','2026-03-01','daily'],['2026-09-09','2026-09-08','daily'],['2026-01-01','2030-01-01','daily'],['2026-01-01','2026-02-01','unknown']]) assert.throws(()=>repeatDates(...args));
  assert.equal(defaultRepeatUntil('2026-09-09'),'2026-10-09');
});
test('category colors are independent per member and old documents use purple',()=>{
  assert.equal(categoryPalette({xzx:{学习:'blue'},czl:{学习:'rose'}},'xzx','学习').id,'blue');
  assert.equal(categoryPalette({xzx:{学习:'blue'},czl:{学习:'rose'}},'czl','学习').id,'rose');
  assert.equal(categoryPalette(null,'xzx','学习').id,'purple');
  assert.equal(categoryPalette({xzx:{学习:'invalid'}},'xzx','学习').id,'purple');
});

test('custom Wednesday/Thursday selection and one-calendar-month defaults',()=>{
  assert.deepEqual(repeatDates('2026-09-07','2026-09-21','custom',[3,4]),['2026-09-09','2026-09-10','2026-09-16','2026-09-17']);
  assert.throws(()=>repeatDates('2026-09-07','2026-09-21','custom',[]));
  assert.equal(defaultRepeatUntil('2026-01-31'),'2026-02-28');
  assert.equal(defaultRepeatUntil('2028-01-31'),'2028-02-29');
  assert.equal(defaultRepeatUntil('2026-12-15'),'2027-01-15');
});
