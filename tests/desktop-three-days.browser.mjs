import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFileSync, mkdirSync } from 'node:fs';
import { rolldown } from 'rolldown';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const project=fileURLToPath(new URL('../',import.meta.url)).replaceAll('\\','/');
const entry=`import React from 'react';import {createRoot} from 'react-dom/client';import Agenda from '${project}app/desktop/page.tsx';const root=createRoot(document.getElementById('root'));let key=0;window.renderAgenda=()=>root.render(<Agenda key={++key}/>);window.renderAgenda();`;
const bundle=await rolldown({input:'offline-entry',platform:'browser',transform:{define:{'process.env.NODE_ENV':'"production"'}},plugins:[{name:'desktop-fixture',resolveId(id){if(id==='offline-entry')return '\0entry.tsx';if(id.endsWith('.css'))return '\0style';},load(id){if(id==='\0entry.tsx')return entry;if(id==='\0style')return '';},transform(code,id){if(/\.tsx?$/.test(id))return{code:ts.transpileModule(code,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText};}}]});
const {output}=await bundle.generate({format:'iife'});await bundle.close();
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH});
try {
  const page=await browser.newPage({viewport:{width:410,height:820},timezoneId:'Asia/Shanghai'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body><div id="root"></div></body></html>'}));
  await page.goto('https://widget.test/');
  await page.clock.install({time:new Date('2026-09-30T12:00:00+08:00')});
  await page.evaluate(()=>{
    window.rows=[
      {id:1,title:'今天上午',owner:'xzx',due:'2026-09-30',startTime:'09:00',endTime:'10:00',done:true},
      {id:2,title:'今天下午',owner:'xzx',due:'2026-09-30',startTime:'14:00',endTime:'15:00'},
      {id:3,title:'明天任务',owner:'xzx',due:'2026-10-01',startTime:'10:00',endTime:'11:00'},
      {id:4,title:'后天任务',owner:'xzx',due:'2026-10-02',startTime:'11:00',endTime:'12:00'},
      {id:5,title:'范围外任务',owner:'xzx',due:'2026-10-03',startTime:'10:00',endTime:'11:00'},
      {id:6,title:'他人任务',owner:'czl',due:'2026-09-30',startTime:'09:00',endTime:'10:00'}];
    window.writes=0;window.fetch=async(_url,options)=>{if(options?.method&&options.method!=='GET')window.writes++;return Response.json({document:{revision:1,value:window.rows}});};
  });
  await page.addStyleTag({content:readFileSync(new URL('../app/desktop/desktop.css',import.meta.url),'utf8')});
  await page.addScriptTag({content:output[0].code});
  await page.getByText('今天下午',{exact:true}).waitFor();
  assert.equal(await page.locator('.desk-focus').count(),0);
  assert.equal(await page.locator('.desk-events li').count(),2);
  await page.getByRole('button',{name:'近三天',exact:true}).click();
  await page.getByText('后天任务',{exact:true}).waitFor();
  assert.equal(await page.locator('.desk-day-group').count(),3);
  assert.deepEqual(await page.locator('.desk-day-group').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('aria-label'))),['2026-09-30','2026-10-01','2026-10-02']);
  assert.equal(await page.getByText('范围外任务',{exact:true}).count(),0);
  assert.equal(await page.getByText('他人任务',{exact:true}).count(),0);
  await page.evaluate(()=>window.renderAgenda());
  await page.getByRole('button',{name:'近三天',pressed:true}).waitFor();
  await page.getByRole('button',{name:'2026-10-01',exact:true}).click();
  await page.getByRole('button',{name:'单日',pressed:true}).waitFor();
  assert.equal(await page.locator('.desk-events li').count(),1);
  await page.getByRole('button',{name:'近三天',exact:true}).click();
  await page.evaluate(()=>{window.rows=window.rows.filter(row=>row.id!==3);});
  await page.clock.runFor(15000);
  await page.getByText('暂无安排',{exact:true}).waitFor();
  assert.equal(await page.locator('.desk-day-group').count(),3);
  assert.equal(await page.evaluate(()=>window.writes),0);
  await page.evaluate(()=>{
    window.revision=2;
    window.rows[1].note='保留原来的备注';
    window.mode='normal';
    window.fetch=async(_url,options)=>{
      const document=()=>({revision:window.revision,value:structuredClone(window.rows)});
      if(options?.method==='POST') {
        window.writes++;
        if(window.mode==='offline')throw Error('offline');
        if(window.mode==='unauthorized')return new Response('',{status:401});
        const payload=JSON.parse(options.body);
        if(window.mode==='conflict'){
          window.mode='normal';window.revision++;
          window.rows[1].note='网页上刚更新的备注';
          window.rows.find(row=>row.owner==='czl').title='别人的最新任务';
          return Response.json({document:document()},{status:409});
        }
        if(window.mode==='hold')await new Promise(resolve=>window.releaseSave=resolve);
        if(payload.revision!==window.revision)return Response.json({document:document()},{status:409});
        window.rows=payload.value;window.revision++;
        return Response.json({document:document()});
      }
      if(window.mode==='hold-poll') {
        const snapshot=document();window.mode='normal';
        return await new Promise(resolve=>window.releasePoll=()=>resolve(Response.json({document:snapshot})));
      }
      return Response.json({document:document()});
    };
  });
  await page.getByRole('button',{name:'完成任务：今天下午',exact:true}).click();
  await page.getByRole('button',{name:'取消完成：今天下午',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.rows[1].note),'保留原来的备注');
  await page.evaluate(()=>window.mode='conflict');
  await page.getByRole('button',{name:'取消完成：今天下午',exact:true}).click();
  await page.getByRole('button',{name:'完成任务：今天下午',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.rows[1].note),'网页上刚更新的备注');
  assert.equal(await page.evaluate(()=>window.rows.find(row=>row.owner==='czl').title),'别人的最新任务');
  await page.evaluate(()=>window.mode='offline');
  await page.getByRole('button',{name:'完成任务：今天下午',exact:true}).click();
  await page.getByRole('alert').waitFor();
  assert.equal(await page.getByRole('button',{name:'完成任务：今天下午',exact:true}).isEnabled(),true);
  assert.equal(await page.evaluate(()=>window.rows[1].done),false);
  await page.evaluate(()=>window.mode='unauthorized');
  await page.getByRole('button',{name:'完成任务：今天下午',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'登录已过期'}).waitFor();
  await page.evaluate(()=>window.mode='hold');
  await page.getByRole('button',{name:'完成任务：今天下午',exact:true}).click();
  await page.waitForFunction(()=>typeof window.releaseSave==='function');
  assert.equal(await page.locator('.desk-task-toggle:enabled').count(),0);
  await page.evaluate(()=>{window.mode='normal';window.releaseSave();});
  await page.getByRole('button',{name:'取消完成：今天下午',exact:true}).waitFor();
  // An older poll resolving after a successful save must not undo the UI.
  await page.evaluate(()=>window.mode='hold-poll');
  await page.clock.runFor(15000);
  await page.waitForFunction(()=>typeof window.releasePoll==='function');
  await page.getByRole('button',{name:'取消完成：今天下午',exact:true}).click();
  await page.getByRole('button',{name:'完成任务：今天下午',exact:true}).waitFor();
  await page.evaluate(()=>window.releasePoll());
  await page.clock.runFor(100);
  assert.equal(await page.getByRole('button',{name:'完成任务：今天下午',exact:true}).count(),1);
  await page.evaluate(()=>{
    for(let id=20;id<40;id++)window.rows.push({id,title:'滚动任务'+id,owner:'xzx',due:'2026-09-30',startTime:'16:00',endTime:'17:00',done:false});
    window.revision++;window.renderAgenda();
  });
  await page.getByText('滚动任务39',{exact:true}).waitFor();
  await page.mouse.move(220,650);await page.mouse.wheel(0,1700);
  await page.waitForFunction(()=>window.scrollY>200);
  await page.getByRole('button',{name:'完成任务：滚动任务39',exact:true}).click();
  await page.getByRole('button',{name:'取消完成：滚动任务39',exact:true}).waitFor();
  await page.evaluate(()=>window.renderAgenda());
  await page.getByRole('button',{name:'取消完成：滚动任务39',exact:true}).waitFor();
  assert.deepEqual(errors,[]);
  mkdirSync(new URL('../work/',import.meta.url),{recursive:true});
  await page.screenshot({path:fileURLToPath(new URL('../work/desktop-three-days.png',import.meta.url))});
  console.log('PASS: three-day view, cross-month, empty days, preferences, completion/undo/persistence, CAS conflict, preserve other tasks, offline/401, duplicate protection, stale poll, wheel scrolling');
} finally {await browser.close();}
