import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const directory = mkdtempSync(join(tmpdir(), 'tongpin-api-test-'));
process.env.TONGPIN_DATA_DIR = directory;
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
  } finally { rmSync(directory, { recursive: true }); }
});
