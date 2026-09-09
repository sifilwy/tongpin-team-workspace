// Offline component regression: no server, credentials, or network requests.
// Set PLAYWRIGHT_MODULE_PATH to an installed playwright package if not local.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { rolldown } from 'rolldown';
import ts from 'typescript';
import { readFileSync, mkdirSync } from 'node:fs';
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
import Workspace from '${project}app/page.tsx';
import DesktopAgenda from '${project}app/desktop/page.tsx';
const root = createRoot(document.getElementById('root'));
let instance = 0;
function Fault() { if (window.failSchedule) throw new Error('Expected regression fault'); return <Schedule />; }
window.renderSchedule = () => root.render(<Boundary key={++instance}><Fault /></Boundary>);
window.renderReviews = (taskId = 101) => root.render(<TaskReviewDialog key={++instance} task={{id:taskId, title:'任务 ' + taskId}} onClose={() => root.render(null)} />);
window.renderWorkspace = () => root.render(<Workspace key={++instance} />);
window.renderDesktop = () => root.render(<DesktopAgenda key={++instance} />);
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
      if (id.endsWith('/use-shared-state') || id.endsWith('/TeamAccess')) return '\0fixtures.js';
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
  await page.setViewportSize({ width: 1400, height: 1800 });
  await page.addStyleTag({ content: '.personal-day-track{height:450px;width:140px;position:relative}.personal-card{position:absolute}.personal-context{position:fixed;z-index:100}.personal-new-range{position:absolute;pointer-events:none}' });
  const track = page.locator('.personal-day-track').first();
  await track.scrollIntoViewIfNeeded();
  const bounds = await track.boundingBox();
  const x = bounds.x + bounds.width / 2;
  const y = hour => bounds.y + (hour - 7) / 15 * bounds.height;
  await page.mouse.move(x, y(9)); await page.mouse.down();
  await page.mouse.move(x, y(10.5), { steps: 8 });
  assert.equal(await page.locator('.personal-new-range').count(), 1);
  await page.mouse.up();
  assert.equal(await page.locator('input[name=startTime]').inputValue(), '09:00');
  assert.equal(await page.locator('input[name=endTime]').inputValue(), '10:30');
  assert.equal(await page.locator('select[name=owner]').inputValue(), '悦悦');
  const selectedDate = await track.getAttribute('data-due');
  assert.equal(await page.locator('input[name=due]').inputValue(), selectedDate);
  await page.locator('input[name=title]').fill('拖动新建验证');
  await page.locator('.personal-edit-modal .save').click();
  assert.ok(await page.evaluate(due => window.fixture['tongpin-personal-tasks-v3'].some(t => t.title === '拖动新建验证' && t.startTime === '09:00' && t.endTime === '10:30' && t.due === due), selectedDate));
  await track.scrollIntoViewIfNeeded();
  const nextBounds = await track.boundingBox();
  const y2 = hour => nextBounds.y + (hour - 7) / 15 * nextBounds.height;
  await page.mouse.move(x, y2(14)); await page.mouse.down(); await page.mouse.move(x, y2(13), {steps:8}); await page.mouse.up();
  assert.equal(await page.locator('input[name=startTime]').inputValue(), '13:00');
  assert.equal(await page.locator('input[name=endTime]').inputValue(), '14:00');
  await page.locator('.personal-edit-modal header button').click();
  await page.mouse.click(x, y2(15));
  assert.equal(await page.locator('.personal-edit-modal').count(), 0);
  await page.mouse.move(x, y2(16)); await page.mouse.down(); await page.mouse.move(x, y2(17), {steps:8}); await page.keyboard.press('Escape'); await page.mouse.up();
  assert.equal(await page.locator('.personal-edit-modal').count(), 0);
  await track.locator('.personal-card').filter({ hasText: '拖动新建验证' }).click();
  assert.equal(await page.locator('.personal-edit-modal header strong').textContent(), '修改个人任务');
  await page.getByRole('textbox', { name: '总结', exact: true }).fill('第一行总结\n第二行总结');
  await page.locator('.personal-edit-modal .save').click();
  assert.equal(await page.locator('.personal-card-check').count(), 0);
  const summaryCard = track.locator('.personal-card').filter({hasText:'拖动新建验证'});
  await summaryCard.scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  await summaryCard.click({button:'right'});
  await page.getByRole('button', {name:'标记完成',exact:true}).click();
  assert.ok(await page.evaluate(() => window.fixture['tongpin-personal-tasks-v3'].find(t => t.title === '拖动新建验证').done));
  await summaryCard.click({button:'right'});
  await page.getByRole('button', {name:'恢复未完成',exact:true}).click();
  await page.addStyleTag({ content: readFileSync(new URL('../app/personal-schedule-fixes.css', import.meta.url), 'utf8') });
  await summaryCard.evaluate(card => { card.style.width='220px'; card.style.height='180px'; });
  assert.equal(await summaryCard.locator('.personal-card-summary').isVisible(), true);
  assert.equal(await summaryCard.locator('.personal-card-summary').textContent(), '第一行总结\n第二行总结');
  await summaryCard.evaluate(card => { card.style.height='60px'; });
  assert.equal(await summaryCard.locator('.personal-card-summary').isVisible(), false);
  await summaryCard.evaluate(card => { card.style.height='180px'; card.style.width='80px'; });
  assert.equal(await summaryCard.locator('.personal-card-summary').isVisible(), false);
  console.log('PASS: no completion circle; right-click completion and restore; summary saved and shown only when card space allows');
  console.log('PASS: blank-slot drag creates correct date/member/time; reverse drag, click threshold, Escape, existing card edit');
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
  await page.evaluate(() => {
    window.fixture['tongpin-tasks-v8'] = [];
    window.fixture['tongpin-messages-v8'] = [];
    window.renderWorkspace();
  });
  await page.locator('.create-button').click();
  const taskForm = page.locator('.task-modal');
  await taskForm.locator('input[name=title]').fill('七次产出任务');
  await taskForm.locator('input[name=amount]').fill('100');
  assert.equal(await taskForm.locator('input[name=quantity]').inputValue(), '');
  await taskForm.getByRole('checkbox', {name:'吃吃',exact:true}).check();
  await taskForm.getByRole('checkbox', {name:'czl',exact:true}).check();
  await taskForm.getByRole('button', {name:'创建任务',exact:true}).click();
  const newTask = await page.evaluate(() => window.fixture['tongpin-tasks-v8'][0]);
  assert.equal(newTask.owner, 'xzx');
  assert.deepEqual(newTask.assistants, ['吃吃','czl']);
  assert.equal(newTask.quantity, null);
  await page.getByRole('button', {name:'任务时间线',exact:true}).click();
  const assistedCard = page.locator('.calendar-card').filter({hasText:'七次产出任务'});
  await assistedCard.waitFor();
  assert.equal(await assistedCard.locator('.calendar-assistants').textContent(), '吃吃、czl');
  await assistedCard.click();
  await page.locator('.task-detail').getByRole('checkbox',{name:'吃吃',exact:true}).uncheck();
  assert.equal(await assistedCard.locator('.calendar-assistants').textContent(), 'czl');
  await page.locator('.task-detail').getByRole('checkbox',{name:'czl',exact:true}).uncheck();
  assert.equal(await assistedCard.locator('.calendar-assistants').count(), 0);
  await page.locator('.task-detail').getByRole('checkbox',{name:'吃吃',exact:true}).check();
  await page.locator('.task-detail').getByRole('checkbox',{name:'czl',exact:true}).check();
  await page.evaluate(() => window.renderWorkspace());
  await page.getByRole('button', {name:'任务时间线',exact:true}).click();
  assert.equal(await assistedCard.locator('.calendar-assistants').textContent(), '吃吃、czl');
  assert.equal(await page.evaluate(() => window.fixture['tongpin-tasks-v8'][0].owner), 'xzx');
  await page.getByRole('button', {name:'协作总览',exact:true}).click();
  console.log('PASS: timeline shows assistants, live edits and removal, retained after remount with owner unchanged');
  await page.locator('.lane-task').filter({hasText:'七次产出任务'}).click({button:'right'});
  await page.getByRole('button', {name:/标记完成/}).click();
  const completion = page.getByRole('dialog', {name:'确认实际产出'});
  await completion.waitFor();
  await completion.locator('input[name=quantity]').fill('7');
  assert.match(await completion.locator('.task-billing p').textContent(), /700/);
  await completion.getByRole('button', {name:'确认次数并完成',exact:true}).click();
  assert.equal(await page.evaluate(() => window.fixture['tongpin-tasks-v8'][0].quantity), 7);
  assert.equal(await page.evaluate(() => window.fixture['tongpin-tasks-v8'].length), 1);
  await page.getByRole('button', {name:'‹ 返回人员分配',exact:true}).click();
  await page.getByRole('button', {name:'金额',exact:true}).click();
  const amountRows = page.locator('.amount-member-grid article');
  assert.match(await amountRows.first().textContent(), /700/);
  assert.match(await amountRows.nth(1).locator('header>b').textContent(), /¥0/);
  console.log('PASS: assistants independent, quantity initially unknown, confirm seven outputs on completion, one task and 700 credited only to owner');
  await page.setViewportSize({width:460,height:960});
  await page.addStyleTag({content:readFileSync(new URL('../app/desktop/desktop.css',import.meta.url),'utf8')});
  await page.evaluate(() => {
    const date = new Date();
    const due = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    window.desktopData = [
      {id:1,owner:'xzx',title:'整理今日咨询记录',due,startTime:'09:00',endTime:'10:00',category:'咨询',done:true},
      {id:2,owner:'xzx',title:'准备下一次团队沟通',due,startTime:'14:00',endTime:'15:30',category:'协作',done:false},
      {id:3,owner:'xzx',title:'阅读与学习',due,startTime:'21:00',endTime:'22:00',category:'个人',done:false},
      {id:4,owner:'czl',title:'其他成员不应显示',due,startTime:'14:00',endTime:'15:00',category:'个人',done:false},
      {id:5,owner:'xzx',title:'记录一个新的想法',due:null,category:'个人',done:false},
    ];
    window.desktopWrites = 0;
    window.fetch = async (_url, options) => {
      if (options?.method && options.method!=='GET') window.desktopWrites++;
      return Response.json({document:{revision:1,value:window.desktopData}});
    };
    window.renderDesktop();
  });
  await page.locator('.desk-events li').first().waitFor();
  assert.equal(await page.locator('.desk-events li').count(),3);
  assert.equal(await page.getByText('其他成员不应显示').count(),0);
  assert.equal(await page.evaluate(()=>window.desktopWrites),0);
  mkdirSync(new URL('../work/',import.meta.url),{recursive:true});
  await page.screenshot({path:fileURLToPath(new URL('../work/desktop-preview.png',import.meta.url)),fullPage:true});
  await page.getByRole('button',{name:'下一周',exact:true}).click();
  await page.getByText('这一天还没有安排',{exact:true}).waitFor();
  await page.getByRole('button',{name:'今天',exact:true}).click();
  assert.equal(await page.locator('.desk-events li').count(),3);
  await page.evaluate(()=>{window.desktopData.push({id:6,owner:'xzx',title:'同步新增任务',due:window.desktopData[0].due,startTime:'18:00',endTime:'19:00',category:'同步',done:false});});
  await page.locator('.desk-events').getByText('同步新增任务',{exact:true}).waitFor({timeout:20000});
  assert.equal(await page.evaluate(()=>window.desktopWrites),0);
  console.log('PASS: desktop shows only xzx, date navigation, pending tasks and automatic read-only refresh');
  await page.setViewportSize({width:1600,height:1000});
  await page.addStyleTag({content:'.personal-day-track{height:auto;width:auto}'});
  await page.addStyleTag({content:readFileSync(new URL('../app/personal-schedule-v2.css',import.meta.url),'utf8') + '\n' + readFileSync(new URL('../app/personal-schedule-fixes.css',import.meta.url),'utf8')});
  await page.evaluate(() => {
    const monday=new Date(); monday.setDate(monday.getDate()-((monday.getDay()+6)%7));
    const due=`${monday.getFullYear()}-${String(monday.getMonth()+1).padStart(2,'0')}-${String(monday.getDate()).padStart(2,'0')}`;
    const ranges=[['08:00','09:00'],['09:00','10:00'],['10:00','12:00'],['12:00','12:15'],['12:15','12:30'],['12:30','13:00'],['13:00','14:00'],['13:00','14:00'],['13:00','14:00']];
    window.fixture['tongpin-personal-tasks-v3']=ranges.map(([startTime,endTime],i)=>({id:800+i,title:'完整的长标题用于检查日程内容是否挤压和重叠',owner:'xzx',due,done:false,category:'很长的分类名称',note:'保存的总结内容',startTime,endTime}));
    window.renderSchedule();
  });
  await page.locator('[data-schedule-id="800"]').waitFor();
  for (const zoom of [1,1.5,2]) {
    await page.evaluate(zoom=>document.querySelector('.personal-v2').style.zoom=zoom,zoom);
    const boxes=await page.locator('[data-schedule-id]').evaluateAll(cards=>cards.map(card=>{
      const r=card.getBoundingClientRect();
      const parts=[...card.querySelectorAll('strong,time,small')].filter(el=>getComputedStyle(el).display!=='none').map(el=>{const b=el.getBoundingClientRect();return {top:b.top,bottom:b.bottom};});
      return {id:Number(card.dataset.scheduleId),top:r.top,bottom:r.bottom,left:r.left,right:r.right,parts};
    }));
    for(let i=0;i<6;i++) assert.ok(boxes[i+1].top-boxes[i].bottom>=3.5*zoom,'Adjacent events must have a visible gap');
    for(const box of boxes) for(const part of box.parts) assert.ok(part.top>=box.top && part.bottom<=box.bottom+1,JSON.stringify({zoom,box,part}));
    const parallel=boxes.slice(6).sort((a,b)=>a.left-b.left);
    assert.ok(parallel[0].right<parallel[1].left && parallel[1].right<parallel[2].left,'Concurrent events must remain separated');
  }
  await page.evaluate(()=>document.querySelector('.personal-v2').style.zoom=1);
  await page.locator('[data-schedule-id="803"]').click();
  assert.equal(await page.locator('input[name=startTime]').inputValue(),'12:00');
  assert.equal(await page.locator('input[name=endTime]').inputValue(),'12:15');
  assert.equal(await page.locator('input[name=title]').inputValue(),'完整的长标题用于检查日程内容是否挤压和重叠');
  console.log('PASS: adjacent 15/30/60-minute events stay separated, long-title metadata fits, concurrent cards separate at 100/150/200 percent zoom, short events remain editable');
  await page.locator('.personal-edit-modal header button').click();
  const resizingCard=page.locator('[data-schedule-id="800"]');
  const resizeTo=async(edge,hour)=>{
    const handle=resizingCard.locator(`[data-resize-edge="${edge}"]`);
    await handle.scrollIntoViewIfNeeded();
    const box=await handle.boundingBox();
    const trackBox=await resizingCard.locator('..').boundingBox();
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
    await page.mouse.down();
    await page.mouse.move(box.x+box.width/2,trackBox.y+(hour-7)/15*trackBox.height,{steps:8});
  };
  const savedTimes=()=>page.evaluate(()=>{const t=window.fixture['tongpin-personal-tasks-v3'].find(t=>t.id===800);return [t.startTime,t.endTime];});
  await resizeTo('end',9.5);
  assert.match(await page.locator('.personal-preview-start').textContent(),/08:00–09:30.*90.*重叠/);
  assert.equal(await page.locator('.personal-preview-end').textContent(),'09:30');
  assert.deepEqual(await savedTimes(),['08:00','09:00']);
  await page.mouse.up();
  assert.deepEqual(await savedTimes(),['08:00','09:30']);
  assert.equal(await page.locator('.personal-edit-modal').count(),0);
  await resizeTo('end',8.25); await page.mouse.up();
  assert.deepEqual(await savedTimes(),['08:00','08:15']);
  await resizeTo('start',7.75); await page.mouse.up();
  assert.deepEqual(await savedTimes(),['07:45','08:15']);
  await resizeTo('end',9); await page.keyboard.press('Escape'); await page.mouse.up();
  assert.deepEqual(await savedTimes(),['07:45','08:15']);
  assert.equal(await page.locator('.personal-drop-preview').count(),0);
  await resizeTo('end',9);
  await page.evaluate(()=>window.dispatchEvent(new PointerEvent('pointercancel',{pointerId:1})));
  await page.mouse.up();
  assert.deepEqual(await savedTimes(),['07:45','08:15']);
  const shortCard=page.locator('[data-schedule-id="803"]');
  await shortCard.scrollIntoViewIfNeeded();
  const shortBox=await shortCard.boundingBox();
  const moveTrack=await shortCard.locator('..').boundingBox();
  await page.mouse.move(shortBox.x+shortBox.width/2,shortBox.y+shortBox.height/2); await page.mouse.down();
  await page.mouse.move(shortBox.x+shortBox.width/2,moveTrack.y+7/15*moveTrack.height+shortBox.height/2,{steps:8});
  assert.match(await page.locator('.personal-preview-start').textContent(),/14:00–14:15.*15/);
  const previewBox=await page.locator('.personal-drop-preview').boundingBox();
  assert.ok(Math.abs(previewBox.height-moveTrack.height/60)<1,'Move preview must show the full 15-minute range');
  await page.mouse.up();
  assert.deepEqual(await page.evaluate(()=>{const t=window.fixture['tongpin-personal-tasks-v3'].find(t=>t.id===803);return [t.startTime,t.endTime];}),['14:00','14:15']);
  await page.evaluate(()=>window.renderSchedule());
  await page.locator('[data-schedule-id="800"]').waitFor();
  assert.deepEqual(await savedTimes(),['07:45','08:15']);
  console.log('PASS: resize both edges, extend/shorten at 15-minute steps, conflict and end-boundary preview, no writes before release, Escape/pointercancel rollback, preserve short duration when moving, remount');
} finally { await browser.close(); }
