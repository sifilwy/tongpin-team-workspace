import test from 'node:test';
import assert from 'node:assert/strict';
import { rebase } from '../app/lib/use-shared-state.ts';
test('simultaneous edits retain other members changes and messages', () => {
  const base = [{ id: 1, title: 'task', owner: 'xzx', reviews: [] }];
  const local = [{ ...base[0], title: 'renamed', reviews: [{ id: 2, text: 'local' }] }];
  const remote = [{ ...base[0], owner: 'czl', reviews: [{ id: 3, text: 'remote' }] }, { id: 4, title: 'new' }];
  const result = rebase(base, local, remote);
  assert.equal(result[0].title, 'renamed');
  assert.equal(result[0].owner, 'czl');
  assert.deepEqual(result[0].reviews.map(x => x.id), [2, 3]);
  assert.equal(result[1].id, 4);
});
test('remote deletion does not resurrect a stale task', () => {
  assert.deepEqual(rebase([{ id: 1, title: 'old' }], [{ id: 1, title: 'edit' }], []), []);
});
