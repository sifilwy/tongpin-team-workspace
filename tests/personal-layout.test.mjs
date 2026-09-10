import test from "node:test";
import assert from "node:assert/strict";
import { computeOverlapLayout, snapStart, toTime, scheduleMinutes, calendarDates, currentTimePosition, DAY_START, DAY_END } from "../app/lib/personal-layout.mjs";

const task = (id, startTime, endTime) => ({ id, startTime, endTime });

test('overnight durations, overlap columns and dragging retain the midnight boundary',()=>{
  assert.equal(scheduleMinutes('01:00')-scheduleMinutes('23:00'),120);
  assert.equal(scheduleMinutes('02:00')-scheduleMinutes('00:30'),90);
  const layout=computeOverlapLayout([task(1,'23:00','01:00'),task(2,'00:30','01:30'),task(3,'01:30','02:00')]);
  assert.equal(layout.get(1).columns,2);assert.equal(layout.get(2).columns,2);
  assert.equal(layout.get(3).columns,1);
  const start=snapStart({clientY:1140,trackTop:0,trackHeight:1140,duration:120,dayStart:DAY_START,dayEnd:DAY_END});
  assert.equal(toTime(start),'00:00');assert.equal(toTime(start+120),'02:00');
});

test('current line uses the actual date through midnight and hides outside displayed hours',()=>{
  const now=new Date(2026,8,10,1,25);
  assert.deepEqual(currentTimePosition(now),{due:'2026-09-09',minute:1525,label:'次日 01:25'});
  assert.deepEqual(currentTimePosition(new Date(2026,8,10,13,25)),{due:'2026-09-10',minute:805,label:'13:25'});
  assert.equal(currentTimePosition(new Date(2026,8,10,2,1)),null);
  assert.equal(currentTimePosition(new Date(2026,8,10,6,59)),null);
  assert.equal(currentTimePosition(new Date(2026,8,10,7,0)).minute,420);
});

test('calendar windows show correct days, navigation, month and overnight week boundaries',()=>{
  const days=(now,count,offset=0)=>calendarDates(now,count,offset).map(date=>[date.getFullYear(),date.getMonth()+1,date.getDate()]);
  assert.deepEqual(days(new Date(2026,8,10,13),3),[[2026,9,10],[2026,9,11],[2026,9,12]]);
  assert.deepEqual(days(new Date(2026,11,30,13),4),[[2026,12,30],[2026,12,31],[2027,1,1],[2027,1,2]]);
  assert.deepEqual(days(new Date(2026,8,10,13),3,-1),[[2026,9,7],[2026,9,8],[2026,9,9]]);
  assert.deepEqual(days(new Date(2026,8,7,1,25),7)[6],[2026,9,6]);
  assert.deepEqual(days(new Date(2026,8,7,7),7)[0],[2026,9,7]);
});

test("three partially overlapping tasks receive three parallel columns", () => {
  const layout = computeOverlapLayout([
    task(1, "09:00", "10:00"),
    task(2, "09:15", "10:15"),
    task(3, "09:30", "10:30"),
  ]);
  assert.deepEqual([...layout.values()].map((item) => item.columns), [3, 3, 3]);
  assert.deepEqual([...layout.values()].map((item) => item.column), [0, 1, 2]);
});

test("a freed overlap column is reused instead of shrinking every card", () => {
  const layout = computeOverlapLayout([
    task(1, "09:00", "10:00"),
    task(2, "09:00", "12:00"),
    task(3, "10:00", "11:00"),
  ]);
  assert.equal(layout.get(1).columns, 2);
  assert.equal(layout.get(2).columns, 2);
  assert.equal(layout.get(3).columns, 2);
  assert.equal(layout.get(3).column, 0);
});

test("pointer time snaps to 15 minutes and preserves duration near day end", () => {
  const elevenSeven = snapStart({ clientY: 247, trackTop: 0, trackHeight: 900, duration: 60, dayStart: 420, dayEnd: 1320 });
  assert.equal(toTime(elevenSeven), "11:00");
  const nearEnd = snapStart({ clientY: 899, trackTop: 0, trackHeight: 900, duration: 90, dayStart: 420, dayEnd: 1320 });
  assert.equal(toTime(nearEnd), "20:30");
});
