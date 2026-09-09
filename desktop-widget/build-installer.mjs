import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
execFileSync(process.execPath,['desktop-widget/build.mjs'],{cwd:root,stdio:'inherit',windowsHide:true});
mkdirSync(join(root,'public/downloads'),{recursive:true});
execFileSync('powershell.exe',['-NoProfile','-Command',"$ErrorActionPreference='Stop'; $payloadFiles=@('TongpinWidget.exe','Microsoft.Web.WebView2.Core.dll','Microsoft.Web.WebView2.WinForms.dll','WebView2Loader.dll','WebView2-LICENSE.txt','WebView2-NOTICE.txt','tongpin-calendar.ico','使用说明.md') | ForEach-Object {Join-Path 'outputs/TongpinWidget' $_}; Compress-Archive -LiteralPath $payloadFiles -DestinationPath 'work/widget-payload.zip' -Force"],{cwd:root,stdio:'inherit',windowsHide:true});
const file='TongpinWidgetSetup-20260909.exe';
execFileSync(join(process.env.WINDIR,'Microsoft.NET/Framework64/v4.0.30319/csc.exe'),[
 '/nologo','/target:winexe','/platform:x64','/optimize+','/win32manifest:desktop-widget\\app.manifest','/win32icon:desktop-widget\\icon.ico','/resource:work\\widget-payload.zip,Payload',`/out:public\\downloads\\${file}`,
 ...['System.dll','System.Core.dll','System.Drawing.dll','System.Windows.Forms.dll','System.IO.Compression.dll'].map(name=>'/reference:'+name),'desktop-widget\\Installer.cs'
],{cwd:root,stdio:'inherit',windowsHide:true});
const bytes=readFileSync(join(root,'public/downloads',file));
writeFileSync(join(root,'public/downloads/widget-release.json'),JSON.stringify({file,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length},null,2)+'\n');
console.log(`Installer built: ${file} (${bytes.length} bytes)`);
