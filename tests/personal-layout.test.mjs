import test from "node:test";
import assert from "node:assert/strict";
import { computeOverlapLayout, snapStart, toTime } from "../app/lib/personal-layout.mjs";

const task = (id, startTime, endTime) => ({ id, startTime, endTime });

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
