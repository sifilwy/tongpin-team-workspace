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
  const saved = await call({ key, revision: 0, value: [{ id: 701, text: '复盘内容\n下一步', author: 'fake', createdAt: 'fake' }] }, cookie);
  assert.equal(saved.status, 200);
  const { document } = await saved.json();
  assert.equal(document.value[0].author, 'czl');
  assert.ok(Number.isFinite(Date.parse(document.value[0].createdAt)));
  assert.equal(JSON.parse(readFileSync(join(directory, 'workspace.json'), 'utf8')).documents[key].value[0].text, '复盘内容\n下一步');
  assert.equal((await call({ key, revision: 0, value: [] }, cookie)).status, 409);
  assert.equal((await call({ key, revision: 1, value: [{ id: 702, text: '  ' }] }, cookie)).status, 400);
  assert.equal((await call({ key, revision: 1, value: [{ id: 702, text: 'x'.repeat(10001) }] }, cookie)).status, 400);
  await call({ action: 'logout' }, cookie);
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
