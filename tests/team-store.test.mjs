import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const directory = mkdtempSync(join(tmpdir(), 'tongpin-api-test-'));
process.env.TONGPIN_DATA_DIR = directory;
const originalOrigin = process.env.TONGPIN_PUBLIC_ORIGIN;
delete process.env.TONGPIN_PUBLIC_ORIGIN;
after(() => {
  if (originalOrigin === undefined) delete process.env.TONGPIN_PUBLIC_ORIGIN;
  else process.env.TONGPIN_PUBLIC_ORIGIN = originalOrigin;
  rmSync(directory, { recursive: true, force: true });
});
const { handleTeam } = await import('../app/lib/team-store.ts');
const call = (body, cookie = '') => handleTeam(new Request('http://localhost/api/team', { method: 'POST', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));

test('weekly plans persist separately across weeks and members with revision protection',async()=>{
 const {emptyWeekPlan,weekPlanKey}=await import('../app/lib/weekly-plan.mjs');
 await handleTeam(new Request('http://localhost/api/team'));
 const codes=JSON.parse(readFileSync(join(directory,'invitations.json'),'utf8'));
 const login=await call({action:'login',code:codes.xzx});const cookie=login.headers.get('set-cookie').split(';')[0];
 const key=weekPlanKey('xzx','2026-09-07');const value={...emptyWeekPlan('2026-09-07'),weekly:'这周的计划',ballWeekly:'皮球这周的计划',summary:'这周的总结',ballSummary:'皮球总结',ballDays:{...emptyWeekPlan('2026-09-07').days,'2026-09-07':'皮球周一记录'}};
 assert.equal((await call({key,revision:0,value},cookie)).status,200);
 assert.equal((await call({key,revision:0,value},cookie)).status,409);
 for(const other of [weekPlanKey('xzx','2026-09-14'),weekPlanKey('czl','2026-09-07')]){
  const result=await handleTeam(new Request(`http://localhost/api/team?key=${encodeURIComponent(other)}`,{headers:{cookie}}));
  assert.equal((await result.json()).document,null);
 }
 const restored=await handleTeam(new Request(`http://localhost/api/team?key=${encodeURIComponent(key)}`,{headers:{cookie}}));
 assert.deepEqual((await restored.json()).document.value,value);
 assert.equal((await call({key,revision:1,value:{...value,days:{}}},cookie)).status,400);
 assert.equal((await call({key:weekPlanKey('xzx','2026-09-08'),revision:0,value},cookie)).status,400);
});

test('personal category colors persist per member and reject unknown colors', async()=>{
  await handleTeam(new Request('http://localhost/api/team'));
  const codes=JSON.parse(readFileSync(join(directory,'invitations.json'),'utf8'));
  const login=await call({action:'login',code:codes.xzx});
  const cookie=login.headers.get('set-cookie').split(';')[0];
  const key='tongpin-personal-category-colors-v1';
  const value={xzx:{学习:'blue'},czl:{学习:'rose'}};
  assert.equal((await call({key,revision:0,value},cookie)).status,200);
  const restored=await handleTeam(new Request(`http://localhost/api/team?key=${key}`,{headers:{cookie}}));
  assert.deepEqual((await restored.json()).document.value,value);
  assert.equal((await call({key,revision:1,value:{xzx:{学习:'bad'}}},cookie)).status,400);
  assert.equal((await call({key,revision:1,value:[]},cookie)).status,400);
});
test('invitation identity, durable data, attribution and concurrent revision protection', async () => {
  try {
    assert.equal((await handleTeam(new Request('http://localhost/api/team'))).status, 401);
    const codes = JSON.parse(readFileSync(join(directory, 'invitations.json'), 'utf8'));
    assert.equal(Object.keys(codes).length, 5);
    assert.equal((await call({ action: 'login', code: 'wrong' })).status, 401);
    const login = await call({ action: 'login', code: codes.czl });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    assert.equal((await login.json()).member, 'czl');
    const key = 'tongpin-tasks-v8';
    assert.equal((await call({ key, revision: 0, value: [] }, cookie)).status, 200);
    const saved = await call({ key, revision: 1, value: [{ id: 1, title: 'test', status: '已完成', reviews: [{ id: 2, text: 'hello', author: 'fake' }] }] }, cookie);
    const result = await saved.json();
    assert.equal(result.document.value[0].completedBy, 'czl');
    assert.equal(result.document.value[0].reviews[0].author, 'czl');
    assert.equal((await call({ key, revision: 1, value: [] }, cookie)).status, 409);
    assert.equal(JSON.parse(readFileSync(join(directory, 'workspace.json'), 'utf8')).documents[key].value.length, 1);
    assert.equal((await call({ key, revision: 2, value: [null] }, cookie)).status, 400);
    await call({ action: 'logout' }, cookie);
    assert.equal((await call({ key, revision: 2, value: [] }, cookie)).status, 401);
  } finally { delete process.env.TONGPIN_PUBLIC_ORIGIN; }
});

test('HTTPS proxy origin accepts matching requests and secures login and logout cookies', async () => {
  process.env.TONGPIN_PUBLIC_ORIGIN = 'https://tongpin.example/';
  await handleTeam(new Request('http://localhost/api/team'));
  const codes = JSON.parse(readFileSync(join(directory, 'invitations.json'), 'utf8'));
  const post = (body, origin, cookie = '') => handleTeam(new Request('http://localhost/api/team', {
    method: 'POST', headers: { 'Content-Type': 'application/json', origin, cookie }, body: JSON.stringify(body),
  }));
  try {
    for (const origin of ['http://tongpin.example', 'https://other.example', 'http://localhost']) {
      assert.equal((await post({ action: 'login', code: codes.czl }, origin)).status, 403);
    }
    const login = await post({ action: 'login', code: codes.czl }, 'https://tongpin.example');
    assert.equal(login.status, 200);
    const header = login.headers.get('set-cookie');
    for (const attribute of ['HttpOnly', 'SameSite=Strict', 'Path=/', 'Secure']) assert.ok(header.includes(attribute));
    const logout = await post({ action: 'logout' }, 'https://tongpin.example', header.split(';')[0]);
    assert.equal(logout.status, 200);
    assert.match(logout.headers.get('set-cookie'), /Max-Age=0; Secure$/);
  } finally { delete process.env.TONGPIN_PUBLIC_ORIGIN; }
});

test('review notes persist with authenticated authors and reject empty content', async () => {
  await handleTeam(new Request('http://localhost/api/team'));
  const codes = JSON.parse(readFileSync(join(directory, 'invitations.json'), 'utf8'));
  const login = await call({ action: 'login', code: codes.czl });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const key = 'tongpin-review-notes-v1';
  const saved = await call({ key, revision: 0, value: [{ id: 701, taskId: 101, text: '复盘内容\n下一步', author: 'fake', createdAt: 'fake' }] }, cookie);
  assert.equal(saved.status, 200);
  const { document } = await saved.json();
  assert.equal(document.value[0].author, 'czl');
  assert.equal(document.value[0].taskId, 101);
  assert.ok(Number.isFinite(Date.parse(document.value[0].createdAt)));
  assert.equal(JSON.parse(readFileSync(join(directory, 'workspace.json'), 'utf8')).documents[key].value[0].text, '复盘内容\n下一步');
  assert.equal((await call({ key, revision: 0, value: [] }, cookie)).status, 409);
  assert.equal((await call({ key, revision: 1, value: [{ id: 702, taskId: 101, text: '  ' }] }, cookie)).status, 400);
  assert.equal((await call({ key, revision: 1, value: [{ id: 702, taskId: 101, text: 'x'.repeat(10001) }] }, cookie)).status, 400);
  await call({ action: 'logout' }, cookie);
});

test('assistants and actual output counts persist without changing the owner', async () => {
  const codes = JSON.parse(readFileSync(join(directory, 'invitations.json'), 'utf8'));
  const login = await call({ action: 'login', code: codes.czl });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const key = 'tongpin-tasks-v8';
  const existing = await (await handleTeam(new Request(`http://localhost/api/team?key=${key}`, {headers:{cookie}}))).json();
  const revision = existing.document.revision;
  const task = { id: 801, owner: 'xzx', amount: 100, quantity: null, assistants: ['吃吃', 'czl'], reviews: [], status: '进行中' };
  assert.equal((await call({key,revision,value:[task]},cookie)).status,200);
  const completed = await (await call({key,revision:revision+1,value:[{...task,status:'已完成',quantity:7}]},cookie)).json();
  assert.equal(completed.document.value[0].owner,'xzx');
  assert.equal(completed.document.value[0].quantity,7);
  assert.deepEqual(completed.document.value[0].assistants,['吃吃','czl']);
  assert.equal((await call({key,revision:revision+2,value:[{...task,quantity:-1}]},cookie)).status,400);
  assert.equal((await call({key,revision:revision+2,value:[{...task,assistants:['unknown']}]},cookie)).status,400);
  await call({action:'logout'},cookie);
});

test('without proxy configuration cookie security follows the request scheme', async () => {
  await handleTeam(new Request('http://localhost/api/team'));
  const codes = JSON.parse(readFileSync(join(directory, 'invitations.json'), 'utf8'));
  for (const protocol of ['http:', 'https:']) {
    const origin = `${protocol}//localhost`;
    const response = await handleTeam(new Request(`${origin}/api/team`, {
      method: 'POST', headers: { origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', code: codes.czl }),
    }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('set-cookie').includes('; Secure'), protocol === 'https:');
  }
});
