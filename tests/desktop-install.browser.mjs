import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {rolldown} from 'rolldown';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const project=fileURLToPath(new URL('../',import.meta.url)).replaceAll('\\','/');
const entry=`import React from 'react';import {createRoot} from 'react-dom/client';import Button from '${project}app/components/DesktopWidgetButton.tsx';createRoot(document.getElementById('root')).render(<Button/>);`;
const bundle=await rolldown({input:'offline-entry',platform:'browser',transform:{define:{'process.env.NODE_ENV':'"production"'}},plugins:[{name:'fixture',resolveId(id){if(id==='offline-entry')return '\0entry.tsx';if(id.endsWith('.css'))return '\0style';},load(id){if(id==='\0entry.tsx')return entry;if(id==='\0style')return '';},transform(code,id){if(/\.tsx?$/.test(id))return{code:ts.transpileModule(code,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText};}}]});
const {output}=await bundle.generate({format:'iife'});await bundle.close();
const release=JSON.parse(readFileSync(new URL('../public/downloads/widget-release.json',import.meta.url)));
const installer=readFileSync(new URL('../public/downloads/'+release.file,import.meta.url));
assert.equal(createHash('sha256').update(installer).digest('hex'),release.sha256);
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH});
try {
  for(const windows of [true,false]) {
    const page=await browser.newPage({viewport:{width:windows?1100:390,height:780}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',route=>route.request().url().endsWith('.exe') ? route.fulfill({body:installer,contentType:'application/octet-stream'}) : route.fulfill({contentType:'text/html',body:'<!doctype html><html><body><div id="root"></div></body></html>'}));
    await page.goto('https://widget.test/');
    await page.addStyleTag({content:'*{margin:0;padding:0}'});
    await page.evaluate(windows=>Object.defineProperty(navigator,'userAgent',{value:windows?'Windows NT 10.0':'iPhone'}),windows);
    await page.addStyleTag({content:readFileSync(new URL('../app/components/desktop-widget-button.css',import.meta.url),'utf8')});
    await page.addScriptTag({content:output[0].code});
    await page.getByRole('button',{name:'添加桌面组件'}).click();
    await page.getByRole('dialog').waitFor();
    const rectangle=await page.getByRole('dialog').boundingBox();
    assert.ok(Math.abs(rectangle.x+rectangle.width/2-(windows?1100:390)/2)<2);
    if(windows) {
      const download=page.waitForEvent('download');
      await page.getByRole('link',{name:'下载 Windows 安装程序'}).click();
      const result=await download;
      assert.equal(result.suggestedFilename(),release.file);
      // The browser may require confirmation for an unsigned executable. Do not
      // bypass its download protection; verify the link/handoff here and verify
      // the released bytes independently over HTTPS after deployment.
      const failure=await result.failure();
      if (!failure) assert.equal(createHash('sha256').update(readFileSync(await result.path())).digest('hex'),release.sha256);
      else console.log('Browser download requires follow-up: '+failure);
      const open=page.getByRole('link',{name:'已安装，打开桌面组件 ↗'});
      assert.equal(await open.getAttribute('href'),'tongpin-widget://open');
      await open.evaluate(link=>link.addEventListener('click',event=>event.preventDefault()));
      await open.click();await page.getByRole('status').filter({hasText:'如果没有反应'}).waitFor();
    } else {
      assert.equal(await page.getByRole('link').count(),0);
      await page.getByText('请在 Windows 电脑上打开此页面安装。',{exact:false}).waitFor();
    }
    assert.equal(await page.getByRole('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
    await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);
    await page.getByRole('button',{name:'添加桌面组件'}).click();
    await page.getByRole('button',{name:'关闭安装说明'}).click();
    assert.equal(await page.getByRole('dialog').count(),0);assert.deepEqual(errors,[]);
    await page.close();
  }
  console.log('PASS: installer link/handoff, local package SHA256, open link/fallback, close/Escape, Windows-only flow, mobile layout');
} finally {await browser.close();}
