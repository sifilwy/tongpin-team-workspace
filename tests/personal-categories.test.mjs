import test from 'node:test';
import assert from 'node:assert/strict';
import { restorePersonalCategories, personalOwners } from '../app/lib/personal-categories.ts';

test('member order stays consistent with the schedule', () => {
  assert.deepEqual(personalOwners, ['xzx', '吃吃', 'czl', '子涵', '悦悦']);
});

test('old xzx/czl-only document supports every member and editor', () => {
  const legacy = { xzx: ['学习'], czl: ['客户'] };
  const categories = restorePersonalCategories(legacy);
  for (const owner of personalOwners) {
    assert.ok(categories[owner].length);
    assert.doesNotThrow(() => categories[owner].map(name => name));
    assert.equal(categories[owner].includes(categories[owner][0]), true);
  }
  assert.deepEqual(categories.xzx, ['学习']);
  assert.deepEqual(legacy, { xzx: ['学习'], czl: ['客户'] });
});
test('missing, malformed and empty categories do not crash the schedule', () => {
  for (const input of [null, undefined, [], {}, { xzx: null, czl: 2, 吃吃: [], 子涵: ['', null] }]) {
    const categories = restorePersonalCategories(input);
    for (const owner of personalOwners) assert.deepEqual(categories[owner], ['独立']);
  }
});
test('preserves existing task categories and deduplicates names without rewriting text', () => {
  const categories = restorePersonalCategories({ xzx: [' 学习 ', ' 学习 ', '', null], 吃吃: '内容' }, [{ owner: '悦悦', category: '跟进' }, { owner: 'xzx', category: '阅读' }]);
  assert.deepEqual(categories.xzx, [' 学习 ', '阅读']);
  assert.deepEqual(categories.吃吃, ['内容']);
  assert.deepEqual(categories.悦悦, ['跟进']);
  assert.deepEqual(restorePersonalCategories(categories), categories);
});
