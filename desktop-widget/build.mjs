import { mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sdk = join(root, 'work', 'webview2', 'sdk');
const output = join(root, 'outputs', 'TongpinWidget');
if (!existsSync(join(sdk, 'lib', 'net462', 'Microsoft.Web.WebView2.Core.dll'))) {
  mkdirSync(join(root, 'work', 'webview2'), { recursive: true });
  // Fixed script text and cwd: no shell interpolation of paths, URLs or user data.
  execFileSync('powershell.exe', ['-NoProfile', '-Command', "$ErrorActionPreference='Stop'; Invoke-WebRequest -UseBasicParsing 'https://api.nuget.org/v3-flatcontainer/microsoft.web.webview2/1.0.4191.47/microsoft.web.webview2.1.0.4191.47.nupkg' -OutFile 'work/webview2/sdk.zip'; Expand-Archive -LiteralPath 'work/webview2/sdk.zip' -DestinationPath 'work/webview2/sdk' -Force"], { cwd: root, stdio: 'inherit', windowsHide: true });
}
mkdirSync(output, { recursive: true });
for (const name of ['Microsoft.Web.WebView2.Core.dll', 'Microsoft.Web.WebView2.WinForms.dll']) copyFileSync(join(sdk, 'lib', 'net462', name), join(output, name));
copyFileSync(join(sdk, 'runtimes', 'win-x64', 'native', 'WebView2Loader.dll'), join(output, 'WebView2Loader.dll'));
copyFileSync(join(sdk, 'LICENSE.txt'), join(output, 'WebView2-LICENSE.txt'));
copyFileSync(join(sdk, 'NOTICE.txt'), join(output, 'WebView2-NOTICE.txt'));
copyFileSync(join(root, 'desktop-widget', 'README.md'), join(output, '使用说明.md'));
copyFileSync(join(root, 'desktop-widget', 'icon.ico'), join(output, 'tongpin-calendar.ico'));
execFileSync(join(process.env.WINDIR, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe'), [
  '/nologo', '/target:winexe', '/platform:x64', '/optimize+', '/win32manifest:desktop-widget\\app.manifest', '/win32icon:desktop-widget\\icon.ico', '/resource:desktop-widget\\widget-ui.js,WidgetUI',
  '/out:outputs\\TongpinWidget\\TongpinWidget.exe', ...['System.dll','System.Core.dll','System.Drawing.dll','System.Windows.Forms.dll','System.Net.Http.dll','System.Web.Extensions.dll','outputs\\TongpinWidget\\Microsoft.Web.WebView2.Core.dll','outputs\\TongpinWidget\\Microsoft.Web.WebView2.WinForms.dll'].map(name => '/reference:' + name), 'desktop-widget\\Widget.cs'
], { cwd: root, stdio: 'inherit', windowsHide: true });
console.log('Built: ' + join(output, 'TongpinWidget.exe'));
