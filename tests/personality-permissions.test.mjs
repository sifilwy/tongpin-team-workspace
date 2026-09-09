import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PERSONALITY_KEY,emptyPersonality} from '../app/lib/personality-data.mjs';
const directory=mkdtempSync(join(tmpdir(),'tongpin-private-test-'));
process.env.TONGPIN_DATA_DIR=directory;
delete process.env.TONGPIN_PUBLIC_ORIGIN;
const {handleTeam}=await import('../app/lib/team-store.ts');
const get=(cookie='',key=PERSONALITY_KEY)=>handleTeam(new Request(`http://localhost/api/team?key=${encodeURIComponent(key)}`,{headers:{cookie}}));
const post=(body,cookie='')=>handleTeam(new Request('http://localhost/api/team',{method:'POST',headers:{cookie,'Content-Type':'application/json'},body:JSON.stringify(body)}));
after(()=>{assert.ok(directory.startsWith(join(tmpdir(),'tongpin-private-test-')));rmSync(directory,{recursive:true,force:true});});
test('private personality data is available only to an authenticated xzx session',async()=>{
  assert.equal((await get()).status,401);
  const codes=JSON.parse(readFileSync(join(directory,'invitations.json'),'utf8'));
  const cookies={};
  for(const [name,code] of Object.entries(codes)){const response=await post({action:'login',code});cookies[name]=response.headers.get('set-cookie').split(';')[0];}
  const value={vision:'private vision fixture',practice:'one small change',entries:[{id:'entry-one',date:'2026-09-09',action:'attempt',reflection:'reflection'}]};
  assert.equal((await post({key:PERSONALITY_KEY,revision:0,value},cookies.xzx)).status,200);
  const restored=await get(cookies.xzx);
  assert.equal(restored.headers.get('cache-control'),'no-store');
  assert.deepEqual((await restored.json()).document.value,value);
  for(const name of Object.keys(cookies).filter(name=>name!=='xzx')) {
    for(const response of [await get(cookies[name]),await post({key:PERSONALITY_KEY,revision:0,value,member:'xzx',owner:'xzx'},cookies[name]),await post({key:PERSONALITY_KEY,revision:1,value:emptyPersonality()},cookies[name])]) {
      assert.equal(response.status,403);
      const body=await response.json();assert.equal('document' in body,false);assert.equal(JSON.stringify(body).includes(value.vision),false);
    }
  }
  assert.deepEqual((await (await get(cookies.xzx)).json()).document.value,value);
  assert.equal((await get('tongpin_session=forged')).status,401);
  assert.equal((await get(cookies.xzx,'__proto__')).status,400);
  for(const invalid of [{...value,vision:'a'.repeat(10001)},{...value,entries:[{...value.entries[0],date:'2026-02-30'}]},{...value,entries:[value.entries[0],value.entries[0]]},{...value,entries:[{...value.entries[0],action:' ',reflection:''}]},{...value,unexpected:'field'}])assert.equal((await post({key:PERSONALITY_KEY,revision:1,value:invalid},cookies.xzx)).status,400);
  assert.equal((await post({key:PERSONALITY_KEY,revision:0,value},cookies.xzx)).status,409);
  await post({action:'logout'},cookies.xzx);
  assert.equal((await get(cookies.xzx)).status,401);
  assert.equal((await post({key:PERSONALITY_KEY,revision:1,value},cookies.xzx)).status,401);
});
