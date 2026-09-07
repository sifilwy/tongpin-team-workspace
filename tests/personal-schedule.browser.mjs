// Offline component regression: no server, credentials, or network requests.
// Set PLAYWRIGHT_MODULE_PATH to an installed playwright package if not local.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { rolldown } from 'rolldown';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const project = fileURLToPath(new URL('../', import.meta.url)).replaceAll('\\', '/');
const mocks = `
import { useState } from 'react';
export const useMember = () => 'xzx';
export function useSharedState(key, initial) {
  const [value, update] = useState(() => Object.hasOwn(window.fixture, key) ? window.fixture[key] : (typeof initial === 'function' ? initial() : initial));
  return [value, next => update(current => {
    const value = typeof next === 'function' ? next(current) : next;
    window.fixture[key] = value;
    return value;
  })];
}`;
const entry = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import Schedule from '${project}app/components/PersonalSchedule.tsx';
import Boundary from '${project}app/components/ScheduleBoundary.tsx';
import ReviewNotes from '${project}app/components/ReviewNotes.tsx';
import TaskReviewDialog from '${project}app/components/TaskReviewDialog.tsx';
const root = createRoot(document.getElementById('root'));
let instance = 0;
function Fault() { if (window.failSchedule) throw new Error('Expected regression fault'); return <Schedule />; }
window.renderSchedule = () => root.render(<Boundary key={++instance}><Fault /></Boundary>);
window.renderReviews = (taskId = 101) => root.render(<TaskReviewDialog key={++instance} task={{id:taskId, title:'任务 ' + taskId}} onClose={() => root.render(null)} />);
window.renderSchedule();
`;
const bundle = await rolldown({
  input: 'offline-entry',
  platform: 'browser',
  transform: { define: { 'process.env.NODE_ENV': JSON.stringify('production') } },
  plugins: [{
    name: 'offline-fixtures',
    resolveId(id) {
      if (id === 'offline-entry') return '\0offline-entry.tsx';
      if (id.endsWith('.css')) return '\0empty-style';
      if (id.endsWith('/use-shared-state') || id === './TeamAccess') return '\0fixtures.js';
    },
    load(id) {
      if (id === '\0offline-entry.tsx') return entry;
      if (id === '\0fixtures.js') return mocks;
      if (id === '\0empty-style') return '';
    },
    transform(code, id) {
      if (/\.tsx?$/.test(id)) return { code: ts.transpileModule(code, { compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
      } }).outputText };
    },
  }],
});
const { output } = await bundle.generate({ format: 'iife' });
await bundle.close();
const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE_PATH ? { executablePath: process.env.BROWSER_EXECUTABLE_PATH } : {}) });
try {
  const page = await browser.newPage();
  const errors = [];
  const requests = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => { requests.push(route.request().url()); return route.abort(); });
  await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>');
  await page.evaluate(() => {
    window.fixture = {
      'tongpin-personal-categories-v2': { xzx: ['学习'], czl: ['客户'] },
      'tongpin-personal-tasks-v3': [{ id: 1, title: '旧任务', owner: '吃吃', category: '旧分类', due: null, done: false, note: '', startTime: '09:00', endTime: '10:00' }],
    };
  });
  await page.addScriptTag({ content: output.find(item => item.type === 'chunk').code });
  const owners = ['xzx', '吃吃', 'czl', '子涵', '悦悦'];
  await page.locator('.personal-segment button').first().waitFor();
  assert.deepEqual(await page.locator('.personal-segment button').allTextContents(), owners);
  for (const owner of owners) {
    await page.locator('.personal-segment').getByRole('button', { name: owner, exact: true }).click();
    assert.match(await page.locator('.personal-side-title').innerText(), new RegExp(owner));
    assert.ok(await page.locator('[data-personal-category]').count());
    await page.locator('.personal-create').click();
    const modal = page.locator('.personal-edit-modal');
    for (const editorOwner of owners) {
      await modal.locator('select[name=owner]').selectOption(editorOwner);
      assert.ok(await modal.locator('select[name=category] option').count());
    }
    await modal.locator('header button').click();
  }
  console.log('PASS: legacy document, five member tabs, all editor member/category selections');
  await page.locator('.personal-segment').getByRole('button', { name: '吃吃', exact: true }).click();
  await page.locator('[data-personal-category="旧分类"] button').first().click();
  await page.locator('[data-pending-id="1"]').click();
  await page.locator('input[name=title]').fill('编辑后的旧任务');
  await page.locator('.personal-edit-modal .save').click();
  await page.waitForFunction(() => window.fixture['tongpin-personal-tasks-v3'][0].title === '编辑后的旧任务');
  await page.getByRole('button', { name: '修改旧分类分类名称', exact: true }).click();
  await page.getByRole('textbox', { name: '修改分类名称' }).fill('重命名分类');
  await page.getByRole('button', { name: '保存分类名称', exact: true }).click();
  await page.waitForFunction(() => window.fixture['tongpin-personal-tasks-v3'][0].category === '重命名分类');
  assert.equal(await page.locator('[data-personal-category="旧分类"]').count(), 0);
  await page.getByRole('button', { name: '＋ 新增分类', exact: true }).click();
  await page.getByRole('textbox', { name: '新分类名称' }).fill('新增分类');
  await page.getByRole('button', { name: '保存分类', exact: true }).click();
  await page.locator('.personal-create').click();
  await page.locator('input[name=title]').fill('新任务');
  await page.locator('select[name=category]').selectOption('新增分类');
  await page.locator('.personal-edit-modal .save').click();
  await page.waitForFunction(() => window.fixture['tongpin-personal-tasks-v3'].length === 2);
  await page.evaluate(() => window.renderSchedule());
  await page.locator('.personal-segment').getByRole('button', { name: '吃吃', exact: true }).click();
  assert.equal(await page.locator('[data-personal-category="新增分类"]').count(), 1);
  assert.deepEqual(await page.evaluate(() => window.fixture['tongpin-personal-categories-v2'].czl), ['客户']);
  await page.getByRole('button', { name: '查看全员', exact: true }).click();
  await page.locator('.personal-completed-button').click();
  await page.locator('.personal-completed-view').waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS: edit, rename, create, remount, preserve other member, all/completed views');
  for (const categories of [null, [], {}, { xzx: null, czl: 2, 吃吃: [], 子涵: ['', null] }]) {
    await page.evaluate(categories => {
      window.fixture['tongpin-personal-categories-v2'] = categories;
      window.renderSchedule();
    }, categories);
    for (const owner of owners) {
      await page.locator('.personal-segment').getByRole('button', { name: owner, exact: true }).click();
      assert.ok(await page.locator('[data-personal-category]').count());
    }
  }
  assert.deepEqual(errors, []);
  console.log('PASS: null, array, empty and malformed categories render for every member');
  await page.evaluate(() => { window.failSchedule = true; window.renderSchedule(); });
  await page.getByRole('alert').waitFor();
  await page.evaluate(() => { window.failSchedule = false; });
  await page.getByRole('button', { name: '重新加载日程' }).click();
  await page.locator('.personal-segment').waitFor();
  assert.equal(await page.getByRole('alert').count(), 0);
  assert.ok(errors.every(message => message.includes('Expected regression fault')));
  assert.deepEqual(requests, []);
  console.log('PASS: error boundary and retry; zero network requests');
  await page.evaluate(() => {
    window.reviewDocument = { revision: 0, value: [] };
    window.fetch = async (_url, options) => {
      if (options?.method === 'POST') {
        if (window.failSave) return Response.json({ error: '测试保存失败' }, { status: 500 });
        const body = JSON.parse(options.body);
        window.reviewDocument = { revision: body.revision + 1, value: body.value };
      }
      return Response.json({ document: window.reviewDocument });
    };
    window.renderReviews();
  });
  assert.equal(await page.getByRole('button', { name: '保存复盘' }).isDisabled(), true);
  await page.getByRole('textbox', { name: '写下复盘' }).fill('做得好的地方\n下一步继续改进');
  await page.getByRole('button', { name: '保存复盘' }).click();
  await page.locator('.review-note-list article').waitFor();
  assert.equal(await page.locator('.review-note-list article p').textContent(), '做得好的地方\n下一步继续改进');
  assert.equal(await page.locator('.review-note-list strong').textContent(), 'xzx');
  await page.evaluate(() => window.renderReviews());
  await page.locator('.review-note-list article').waitFor();
  assert.equal(await page.locator('.review-note-list article').count(), 1);
  await page.evaluate(() => window.renderReviews(202));
  await page.getByText('暂无复盘记录。', { exact: true }).waitFor();
  assert.equal(await page.locator('.review-note-list article').count(), 0);
  await page.evaluate(() => window.renderReviews(101));
  await page.locator('.review-note-list article').waitFor();
  await page.evaluate(() => { window.failSave = true; });
  await page.getByRole('textbox', { name: '写下复盘' }).fill('失败时保留这段文字');
  await page.getByRole('button', { name: '保存复盘' }).click();
  await page.getByRole('alert').waitFor();
  assert.equal(await page.getByRole('textbox', { name: '写下复盘' }).inputValue(), '失败时保留这段文字');
  assert.deepEqual(requests, []);
  console.log('PASS: write review, author, multiline text, empty input disabled, remount');
} finally { await browser.close(); }
