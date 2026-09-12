import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {rolldown} from 'rolldown';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const root=fileURLToPath(new URL('../',import.meta.url)).replaceAll('\\','/');
const entry=`import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import {useSharedState} from '${root}app/lib/use-shared-state.ts';
import UndoButton from '${root}app/components/UndoButton.tsx';
import Editor from '${root}app/components/PlanPendingEditor.tsx';
function App(){const [tasks,setTasks]=useSharedState('tongpin-personal-tasks-v3',[]);const [editing,setEditing]=useState(null);return <><pre id="data">{JSON.stringify(tasks)}</pre>
<button id="add" onClick={()=>setTasks(current=>[...current,{id:2,title:'新增',done:false,note:''}])}>添加</button>
<button id="rename" onClick={()=>setTasks(current=>current.map(task=>task.id===1?{...task,title:'新名'}:task))}>改名</button>
<button id="remove" onClick={()=>setTasks(current=>current.filter(task=>task.id!==1))}>删除</button>
<button id="edit" onClick={()=>setEditing({...tasks.find(task=>task.id===1)})}>编辑</button><UndoButton global />
{editing && <Editor task={editing} onSave={(id,patch)=>setTasks(current=>current.map(task=>task.id===id?{...task,...patch}:task))} onClose={()=>setEditing(null)} />}</>};createRoot(document.getElementById('root')).render(<App/>);`;
const bundle=await rolldown({input:'fixture',platform:'browser',transform:{define:{'process.env.NODE_ENV':'"production"'}},plugins:[{
 name:'fixture',resolveId(id){if(id==='fixture')return '\0fixture.tsx';if(id.endsWith('.css'))return '\0style';},
 load(id){if(id==='\0fixture.tsx')return entry;if(id==='\0style')return '';},
 transform(code,id){if(/\.tsx?$/.test(id))return {code:ts.transpileModule(code,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText};}
}]});const {output}=await bundle.generate({format:'iife'});await bundle.close();
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE_PATH?{executablePath:process.env.BROWSER_EXECUTABLE_PATH}:{})});
try{
 const page=await browser.newPage();let doc={revision:1,value:[{id:1,title:'原名',category:'独立',done:false,note:''}]};
 await page.route('**/*',async route=>{
  if(!route.request().url().includes('/api/team')){await route.fulfill({contentType:'text/html',body:'<div id="root"></div>'});return;}
  if(route.request().method()==='POST'){const body=route.request().postDataJSON();if(body.revision!==doc.revision){await route.fulfill({status:409,json:{document:doc}});return;}doc={revision:doc.revision+1,value:body.value};}
  await route.fulfill({json:{document:doc}});
 });
 await page.goto('http://undo.test/');await page.addScriptTag({content:output[0].code});
 const data=()=>page.locator('#data').textContent().then(JSON.parse);
 await page.waitForFunction(()=>document.querySelector('#data').textContent.includes('原名'));
 const undo=async()=>{await page.locator('#add').focus();await page.keyboard.press('Control+z');};
 assert.equal(await page.locator('[data-undo-button]').count(),0);
 await page.locator('#add').click();await undo();assert.equal((await data()).length,1);
 await page.locator('#rename').click();
 await page.waitForResponse(response=>response.request().method()==='POST');
 doc={revision:doc.revision+1,value:doc.value.map(task=>({...task,note:'其他成员新增备注'}))};
 await page.waitForFunction(()=>document.querySelector('#data').textContent.includes('其他成员新增备注'));
 await undo();assert.equal((await data())[0].title,'原名');assert.equal((await data())[0].note,'其他成员新增备注');
 await page.locator('#remove').click();assert.equal((await data()).length,0);
 await page.locator('#remove').focus();await page.keyboard.press('Control+z');assert.equal((await data()).length,1);
 await page.locator('#edit').click();const editor=page.getByRole('dialog',{name:'编辑待安排任务'});
 await editor.getByRole('textbox',{name:'任务名称',exact:true}).fill('自动保存的新名');
 await page.waitForFunction(()=>document.querySelector('#data').textContent.includes('自动保存的新名'));
 await editor.getByRole('button',{name:'关闭',exact:true}).focus();await page.keyboard.press('Control+z');await editor.waitFor({state:'hidden'});assert.equal((await data())[0].title,'原名');
 await page.locator('#edit').click();await editor.getByRole('textbox',{name:'任务名称',exact:true}).fill('尚未自动保存');
 await editor.getByRole('button',{name:'关闭',exact:true}).focus();await page.keyboard.press('Control+z');await editor.waitFor({state:'hidden'});assert.equal((await data())[0].title,'原名');
 console.log('PASS: real shared-state hook undo before/after sync, restore deletion, preserve remote note, Ctrl+Z, autosaved and pending editor changes');
}finally{await browser.close();}
