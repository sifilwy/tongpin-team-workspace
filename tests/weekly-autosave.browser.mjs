import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {rolldown} from 'rolldown';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const root=fileURLToPath(new URL('../',import.meta.url)).replaceAll('\\','/');
const entry=`import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import Plan from '${root}app/components/WeeklyPlanDialog.tsx';import Undo from '${root}app/components/UndoButton.tsx';function App(){const [open,setOpen]=useState(true);return <><button id="open" onClick={()=>setOpen(true)}>打开</button><Undo global/>{open && <Plan owner="xzx" week="2026-09-07" onAddPending={()=>{}} onEditPending={()=>{}} onClose={()=>setOpen(false)}/>}</>};createRoot(document.getElementById('root')).render(<App/>);`;
const bundle=await rolldown({input:'fixture',platform:'browser',transform:{define:{'process.env.NODE_ENV':'"production"'}},plugins:[{
 name:'fixture',resolveId(id){if(id==='fixture')return '\0fixture.tsx';if(id.endsWith('.css'))return '\0style';},
 load(id){if(id==='\0fixture.tsx')return entry;if(id==='\0style')return '';},
 transform(code,id){if(/\.tsx?$/.test(id))return {code:ts.transpileModule(code,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText};}
}]});const {output}=await bundle.generate({format:'iife'});await bundle.close();
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE_PATH?{executablePath:process.env.BROWSER_EXECUTABLE_PATH}:{})});
try{
 const page=await browser.newPage();
 const {emptyWeekPlan}=await import('../app/lib/weekly-plan.mjs');
 let doc={revision:1,value:emptyWeekPlan('2026-09-07')},hold=false,fail=false,release,postStarted;
 await page.route('**/*',async route=>{
  if(!route.request().url().includes('/api/team')){await route.fulfill({contentType:'text/html',body:'<div id="root"></div>'});return;}
  if(route.request().method()==='POST'){
   const body=route.request().postDataJSON();
   if(hold){hold=false;postStarted?.();await new Promise(resolve=>release=resolve);}
   if(fail){await route.fulfill({status:500,json:{error:'模拟断网'}});return;}
   if(body.revision!==doc.revision){await route.fulfill({status:409,json:{document:doc}});return;}
   doc={revision:doc.revision+1,value:body.value};
  }
  await route.fulfill({json:{document:doc}});
 });
 await page.goto('http://autosave.test/');await page.addScriptTag({content:output[0].code});
 const plan=page.getByRole('dialog',{name:'每周计划',exact:true});const weekly=plan.getByRole('textbox',{name:'本周计划',exact:true});
 const saved=()=>page.waitForFunction(()=>document.querySelector('.weekly-plan-dialog footer [role=status]').textContent==='已自动保存');
 const undo=async()=>{await plan.getByRole('button',{name:'关闭',exact:true}).focus();await page.keyboard.press('Control+z');};
 await weekly.waitFor();assert.equal(await plan.getByRole('button',{name:'保存',exact:true}).count(),0);assert.equal(await page.locator('[data-undo-button]').count(),0);
 await weekly.fill('自动保存的每周计划');await saved();assert.equal(doc.value.weekly,'自动保存的每周计划');assert.equal(await plan.isVisible(),true);
 hold=true;const started=new Promise(resolve=>postStarted=resolve);
 await weekly.fill('请求中的第一版');await started;
 assert.equal(await weekly.isEnabled(),true);
 await weekly.fill('继续输入的最终版');
 await plan.getByRole('button',{name:'皮球',exact:true}).click();await weekly.fill('皮球计划');
 doc={revision:doc.revision+1,value:{...doc.value,summary:'其他页面的总结'}};
 release();await saved();
 // A second debounced request persists edits made during the first response.
 await saved();assert.equal(doc.value.weekly,'继续输入的最终版');assert.equal(doc.value.ballWeekly,'皮球计划');assert.equal(doc.value.summary,'其他页面的总结');
 await plan.getByRole('textbox',{name:'周一计划',exact:true}).fill('皮球周一');await saved();assert.equal(doc.value.ballDays['2026-09-07'],'皮球周一');
 await plan.locator('summary').click();await plan.getByRole('textbox',{name:'本周总结',exact:true}).fill('皮球总结');await saved();assert.equal(doc.value.ballSummary,'皮球总结');
 await plan.getByRole('button',{name:'独立',exact:true}).click();
 assert.equal(await weekly.inputValue(),'继续输入的最终版');
 await weekly.fill('要撤销的计划');await saved();await undo();
 await page.waitForFunction(()=>document.querySelector('textarea[aria-label="本周计划"]').value==='继续输入的最终版');assert.equal(doc.value.weekly,'继续输入的最终版');
 // Native text undo must remain available inside the focused textarea.
 await weekly.click();await weekly.press('End');await page.keyboard.type('a');await page.keyboard.press('Control+z');
 assert.equal(await weekly.inputValue(),'继续输入的最终版');
 fail=true;await weekly.fill('断网时的内容');await plan.getByRole('alert').waitFor();
 assert.equal(await weekly.inputValue(),'断网时的内容');assert.equal(await plan.isVisible(),true);
 fail=false;await plan.getByRole('button',{name:'重试',exact:true}).click();await saved();assert.equal(doc.value.weekly,'断网时的内容');
 await weekly.fill('立即关闭的最后输入');await plan.getByRole('button',{name:'关闭计划',exact:true}).click();await plan.waitFor({state:'hidden'});
 assert.equal(doc.value.weekly,'立即关闭的最后输入');await page.locator('#open').click();await weekly.waitFor();assert.equal(await weekly.inputValue(),'立即关闭的最后输入');
 console.log('PASS: no save/undo buttons, live autosave, continued typing during delayed CAS conflict, separate category/day/summary, shortcut and native text undo, failure retry, immediate close/reopen');
}finally{await browser.close();}
