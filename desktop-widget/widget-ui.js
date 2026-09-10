// Render desktop controls in the same compositor as the agenda, rather than in
// sibling WinForms HWNDs, which may appear black when parented to Explorer.
document.addEventListener('DOMContentLoaded', () => {
  if (location.origin !== 'https://yanxue-sync.top') return;
  const style = document.createElement('style');
  style.textContent = 'body{padding-top:36px!important;box-sizing:border-box}body .desktop-agenda{padding:12px 16px 18px;min-height:calc(100vh - 36px)}body .desk-header{display:none}body .desk-top{margin-top:0}html{overflow-y:auto}::-webkit-scrollbar{width:8px}::-webkit-scrollbar-thumb{background:#bdcbe1;border-radius:5px}';
  document.head.append(style);
  const host = document.createElement('div');
  host.id = 'tongpin-widget-controls';
  host.style.cssText = 'position:fixed;inset:0 0 auto 0;height:36px;z-index:2147483647;';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `<style>
    :host{font-family:'Segoe UI','Microsoft YaHei',sans-serif;color:#233558;font-size:13px}
    *{box-sizing:border-box}header{height:36px;display:flex;align-items:center;background:#e8eef9;padding-left:16px;cursor:grab;user-select:none;touch-action:none}
    strong{font-size:14px;font-weight:500;flex:1}button{font:inherit;border:0;cursor:pointer;color:inherit}
    header button{height:36px;width:40px;background:#dfe8f8;font-size:24px;font-weight:600;line-height:1}
    header button.website{width:80px;background:transparent;font-size:11px;font-weight:400;color:#59729c}
    header button:hover{background:#c8d8f1}header button[data-command=close]:hover{background:#f3c9ce;color:#852634}
    button:focus-visible{outline:2px solid #4269b9;outline-offset:-3px}
    .menu{position:absolute;right:6px;top:40px;padding:5px;background:#fff;border:1px solid #dae2ef;border-radius:10px;box-shadow:0 8px 24px #23355826;min-width:158px}
    .menu[hidden]{display:none}.menu button{display:block;text-align:left;width:100%;padding:9px 12px;border-radius:6px;background:transparent;font-size:13px}.menu button:hover{background:#edf2fb}
    .resize{position:fixed;z-index:5;touch-action:none}.resize[data-edge=n]{top:0;left:12px;right:12px;height:5px;cursor:n-resize}.resize[data-edge=s]{bottom:0;left:12px;right:12px;height:6px;cursor:s-resize}.resize[data-edge=e]{right:0;top:12px;bottom:12px;width:6px;cursor:e-resize}.resize[data-edge=w]{left:0;top:12px;bottom:12px;width:6px;cursor:w-resize}
    .resize[data-edge=ne]{top:0;right:0;cursor:ne-resize}.resize[data-edge=nw]{top:0;left:0;cursor:nw-resize}.resize[data-edge=sw]{bottom:0;left:0;cursor:sw-resize}.resize[data-edge=se]{bottom:0;right:0;cursor:se-resize;width:18px;height:18px;background:repeating-linear-gradient(135deg,transparent 0 4px,#91a5c7 4px 5px,transparent 5px 8px);clip-path:polygon(100% 0,100% 100%,0 100%)}.resize[data-edge^=n]:not([data-edge=n]),.resize[data-edge=sw]{width:12px;height:12px}
  </style><header><strong>同屏</strong><button id="website" class="website" data-command="website" aria-label="打开网站" title="用浏览器打开工作台">打开网站 ↗</button><button id="more" aria-label="更多选项" title="更多选项" aria-expanded="false">⋯</button><button id="collapse" data-command="collapse" aria-label="收起为小圆点" title="收起为小圆点">−</button><button id="close" data-command="close" aria-label="关闭组件" title="关闭组件">×</button></header>
  <div class="menu" hidden><button data-command="website">打开网站 ↗</button><button data-command="refresh">刷新日程</button><button data-command="reset">恢复右侧位置</button><button data-command="collapse">收起为小圆点</button><button data-command="close">退出组件</button></div>`;
  const menu = shadow.querySelector('.menu');
  for (const edge of ['n','s','e','w','ne','nw','se','sw']) {
    const handle = document.createElement('div'); handle.className = 'resize'; handle.dataset.edge = edge;
    handle.title = '拖动调整大小'; shadow.append(handle);
  }
  shadow.querySelector('header').title = '直接拖动这里移动日程';
  const more = shadow.getElementById('more');
  const hideMenu = () => { menu.hidden = true; more.setAttribute('aria-expanded', 'false'); };
  let gesture = null, frame = 0;
  const sendDelta = () => { frame = 0; if (gesture) window.chrome.webview.postMessage('gesture-delta:' + gesture.dx + ',' + gesture.dy); };
  shadow.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.target.closest('button,.menu')) return;
    const target = event.target.closest('.resize,header'); if (!target) return;
    hideMenu(); event.preventDefault();
    gesture = { target, pointerId:event.pointerId, x:event.screenX, y:event.screenY, ratio:window.devicePixelRatio, dx:0, dy:0 };
    try { target.setPointerCapture(event.pointerId); } catch {}
    window.chrome.webview.postMessage('gesture-start:' + (target.dataset.edge || 'move'));
  });
  window.addEventListener('pointermove', event => {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    gesture.dx = Math.round((event.screenX - gesture.x) * gesture.ratio); gesture.dy = Math.round((event.screenY - gesture.y) * gesture.ratio);
    if (!frame) frame = requestAnimationFrame(sendDelta);
  });
  const finishGesture = cancel => {
    if (!gesture) return;
    if (frame) cancelAnimationFrame(frame); frame = 0;
    if (!cancel) sendDelta();
    const ended = gesture; gesture = null;
    window.chrome.webview.postMessage(cancel ? 'gesture-cancel' : 'gesture-end');
    try { ended.target.releasePointerCapture(ended.pointerId); } catch {}
  };
  window.addEventListener('pointerup', () => finishGesture(false));
  window.addEventListener('pointercancel', () => finishGesture(true));
  shadow.addEventListener('lostpointercapture', () => finishGesture(false));
  window.addEventListener('blur', () => finishGesture(false));
  shadow.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button === more) { menu.hidden = !menu.hidden; more.setAttribute('aria-expanded', String(!menu.hidden)); return; }
    const command = button.dataset.command;
    if (command) { hideMenu(); window.chrome.webview.postMessage(command); }
  });
  document.addEventListener('pointerdown', event => { if (!event.composedPath().includes(host)) hideMenu(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') { hideMenu(); finishGesture(true); } });
  document.documentElement.append(host);
  window.chrome.webview.postMessage('ui-ready');
});
