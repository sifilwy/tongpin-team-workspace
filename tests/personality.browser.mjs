import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';
import {rolldown} from 'rolldown';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const project=fileURLToPath(new URL('../',import.meta.url)).replaceAll('\\','/');
const entry=`import React from 'react';import {createRoot} from 'react-dom/client';import Page from '${project}app/page.tsx';import Access from '${project}app/components/TeamAccess.tsx';const root=createRoot(document.getElementById('root'));let n=0;window.renderApp=()=>root.render(<Access key={++n}><Page/></Access>);window.renderApp();`;
const bundle=await rolldown({input:'offline-entry',platform:'browser',transform:{define:{'process.env.NODE_ENV':'"production"'}},plugins:[{name:'fixture',resolveId(id){if(id==='offline-entry')return '\0entry.tsx';if(id.endsWith('.css'))return '\0style';},load(id){if(id==='\0entry.tsx')return entry;if(id==='\0style')return '';},transform(code,id){if(/\.tsx?$/.test(id))return{code:ts.transpileModule(code,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText};}}]});
const {output}=await bundle.generate({format:'iife'});await bundle.close();
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH});
try {
 const page=await browser.newPage({viewport:{width:1280,height:1000},timezoneId:'Asia/Shanghai'});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body><div id="root"></div></body></html>'}));
 await page.goto('https://private.test/');
 await page.evaluate(()=>{
  window.member='xzx';window.docs={};window.mode='normal';window.privateWrites=0;window.privateReads=0;
  window.fetch=async(url,options={})=>{
   const key=new URL(url,location.origin).searchParams.get('key') || (options.body?JSON.parse(options.body).key:null);
   const privateKey='tongpin-personality-xzx-v1';
   if(key===privateKey){window.privateReads++;if(window.member!=='xzx')return Response.json({error:'denied'},{status:403});}
   if(options.method==='POST'){
    const payload=JSON.parse(options.body);
    if(key===privateKey){window.privateWrites++;if(window.mode==='offline')throw Error('offline');if(window.mode==='conflict'){window.mode='normal';window.docs[key].revision++;window.docs[key].value.entries.push({id:'concurrent',date:'2026-09-08',action:'另一页面的记录',reflection:''});return Response.json({document:window.docs[key]},{status:409});}}
    if(payload.revision!==(window.docs[key]?.revision||0))return Response.json({document:window.docs[key]},{status:409});
    window.docs[key]={revision:payload.revision+1,value:payload.value};
   }
   return Response.json(key?{member:window.member,document:window.docs[key]||null}:{member:window.member});
  };
 });
 for(const css of ['app/globals.css','app/components/personality.css'])await page.addStyleTag({content:readFileSync(new URL('../'+css,import.meta.url),'utf8').replace('@import "tailwindcss";','')});
 await page.addScriptTag({content:output[0].code});
 await page.getByRole('button',{name:'人格改变',exact:true}).click();
 await page.getByLabel('我想成为怎样的人').fill('更坦诚地表达需要');
 await page.getByLabel('我正在练习的改变').fill('遇到问题先说出一个需求');
 await page.getByRole('button',{name:'保存方向',exact:true}).click();
 await page.locator('.personality-saved').filter({hasText:'已保存'}).waitFor();
 await page.getByLabel('这次，我做了什么').fill('今天主动说了自己的想法');
 await page.getByLabel('我的感受和下一步').fill('有些紧张，但想继续尝试');
 await page.getByRole('button',{name:'个人日程',exact:true}).click();
 await page.getByRole('button',{name:'人格改变',exact:true}).click();
 assert.equal(await page.getByLabel('这次，我做了什么').inputValue(),'今天主动说了自己的想法');
 await page.evaluate(()=>window.mode='offline');
 await page.getByRole('button',{name:'保存这次记录',exact:true}).click();
 await page.locator('.personality-error').waitFor();
 assert.equal(await page.getByLabel('这次，我做了什么').inputValue(),'今天主动说了自己的想法');
 await page.evaluate(()=>window.mode='conflict');
 await page.getByRole('button',{name:'保存这次记录',exact:true}).click();
 await page.getByText('今天主动说了自己的想法',{exact:true}).waitFor();
 assert.equal(await page.locator('.personality-record').count(),2);
 await page.locator('.personality-record').filter({hasText:'今天主动说了自己的想法'}).getByRole('button',{name:'编辑记录'}).click();
 await page.getByLabel('我的感受和下一步').fill('修改后的感受');
 await page.getByRole('button',{name:'保存修改',exact:true}).click();
 await page.getByText('修改后的感受',{exact:true}).waitFor();
 await page.evaluate(()=>window.renderApp());
 await page.getByRole('button',{name:'人格改变',exact:true}).click();
 await page.getByText('修改后的感受',{exact:true}).waitFor();
 assert.equal(await page.getByLabel('我想成为怎样的人').inputValue(),'更坦诚地表达需要');
 assert.equal(await page.evaluate(()=>Object.keys(localStorage).some(key=>key.includes('personality'))),false);
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.locator('.personality-page').evaluate(node=>node.scrollWidth<=node.clientWidth),true);
 await page.setViewportSize({width:1280,height:1000});
 // A lost session clears already-visible private content and drafts.
 await page.evaluate(()=>{window.member='czl';window.dispatchEvent(new Event('pageshow'));});
 await page.getByText('请重新登录后查看。',{exact:true}).waitFor();
 assert.equal(await page.getByText('修改后的感受',{exact:true}).count(),0);
 for(const member of ['czl','吃吃','子涵','悦悦']){
  await page.evaluate(member=>{window.member=member;window.privateReads=0;window.renderApp();},member);
  await page.getByRole('button',{name:'协作总览',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'人格改变',exact:true}).count(),0);
  assert.equal(await page.locator('.personality-page').count(),0);
  assert.equal(await page.evaluate(()=>window.privateReads),0);
 }
 assert.deepEqual(errors,[]);
 console.log('PASS: xzx-only tab, private save/edit/remount, draft preservation, offline, conflict keeps other records, no localStorage, mobile, session expiry clears content, other members never mount/fetch');
}finally{await browser.close();}
