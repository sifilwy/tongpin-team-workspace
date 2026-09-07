import test from 'node:test';
import assert from 'node:assert/strict';
import { taskTotal } from '../app/lib/task-amount.mjs';
test('legacy amounts retain one output; unknown quantities never count as earned', () => {
  assert.equal(taskTotal({ amount: 100 }), 100);
  assert.equal(taskTotal({ amount: 100, quantity: null }), 0);
  assert.equal(taskTotal({ amount: 100, quantity: 0 }), 0);
  assert.equal(taskTotal({ amount: 100, quantity: 7 }), 700);
  assert.equal(taskTotal({ quantity: 7 }), 0);
  assert.equal(taskTotal({ amount: .1, quantity: 7 }), .7);
});
