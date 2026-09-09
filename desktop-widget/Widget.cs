using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

static class Program
{
    [STAThread]
    static void Main(string[] args)
    {
        if (args.Length > 0 && args[0] == "--open-from-web") {
            if (args.Length != 2 || (!string.Equals(args[1], "tongpin-widget://open", StringComparison.OrdinalIgnoreCase) && !string.Equals(args[1], "tongpin-widget://open/", StringComparison.OrdinalIgnoreCase))) return;
            args = new string[0];
        }
        bool verify = Array.IndexOf(args, "--verify") >= 0;
        bool fresh;
        using (var mutex = new Mutex(true, "Local\\TongpinWidget" + (verify ? "Verification" : ""), out fresh))
        using (var reveal = new EventWaitHandle(false, EventResetMode.AutoReset, "Local\\TongpinWidgetReveal" + (verify ? "Verification" : "")))
        using (var exitForUpdate = new EventWaitHandle(false, EventResetMode.AutoReset, "Local\\TongpinWidgetExitForUpdate" + (verify ? "Verification" : "")))
        {
            if (!fresh) { reveal.Set(); return; }
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
            string code = Array.IndexOf(args, "--signin-stdin") >= 0 ? Console.In.ReadLine() : null;
            Application.Run(new Widget(verify, code, reveal, exitForUpdate));
        }
    }
}

sealed class Widget : Form
{
    const string Origin = "https://yanxue-sync.top";
    readonly bool verify;
    string signInCode;
    readonly string dataPath;
    readonly WebView2 browser = new WebView2();
    readonly NotifyIcon tray = new NotifyIcon();
    readonly ContextMenuStrip menu = new ContextMenuStrip();

    readonly Label status = new Label();
    readonly Panel header = new Panel();
    readonly Button collapseButton = new Button();
    readonly Button closeButton = new Button();
    readonly PetButton bubble = new PetButton();
    readonly Form bubbleWindow = new Form();
    readonly ToolTip tips = new ToolTip();
    readonly System.Windows.Forms.Timer recovery = new System.Windows.Forms.Timer();
    readonly System.Windows.Forms.Timer activation = new System.Windows.Forms.Timer();
    bool closing, testing, collapsed, bubbleDragged, webToolbar;
    float scale;
    Point dragStart, bubbleStart;
    Rectangle expandedBounds;
    Rectangle gestureBounds;
    string gesture = "";
    Rectangle desired;
    string renderHealth = "starting";
    bool probing;
    readonly JavaScriptSerializer json = new JavaScriptSerializer();

    public Widget(bool verification, string code, EventWaitHandle reveal, EventWaitHandle exitForUpdate)
    {
        verify = verification; signInCode = code;
        dataPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), verify ? "TongpinWidgetVerification" : "TongpinWidget");
        Directory.CreateDirectory(dataPath);
        Text = "同屏";
        Icon = System.Drawing.Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        BackColor = Color.FromArgb(243, 245, 250);
        StartPosition = FormStartPosition.Manual;
        AutoScaleMode = AutoScaleMode.None;
        FormBorderStyle = FormBorderStyle.None;
        ShowInTaskbar = false;
        var working = Screen.PrimaryScreen.WorkingArea;
        using (var g = CreateGraphics()) scale = g.DpiX / 96f;
        int width = Math.Min((int)(410 * scale), working.Width - 40);
        int height = Math.Min((int)(820 * scale), working.Height - 48);
        desired = new Rectangle(working.Right - width - 22, working.Top + 24, width, height);
        if (!verify) LoadPosition();
        Bounds = desired;
        header.Dock = DockStyle.None; header.Height = (int)(36 * scale); header.BackColor = Color.FromArgb(232, 238, 249);
        status.Text = "同屏";
        status.Font = new Font("Microsoft YaHei UI", 9);
        status.ForeColor = Color.FromArgb(102, 119, 148);
        status.Dock = DockStyle.Fill;
        status.Padding = new Padding((int)(14 * scale), (int)(3 * scale), 0, 0);
        var actions = new Button { Text = "•••", Dock = DockStyle.Right, Width = (int)(42 * scale), FlatStyle = FlatStyle.Flat, BackColor = header.BackColor, ForeColor = status.ForeColor };
        actions.FlatAppearance.BorderSize = 0;
        actions.AccessibleName = "日程组件菜单";
        actions.Click += delegate { menu.Show(actions, new Point(0, actions.Height)); };
        SetupHeaderButton(collapseButton, "−", "收起为小圆点");
        SetupHeaderButton(closeButton, "×", "关闭日程组件");
        collapseButton.Click += delegate { Collapse(); };
        closeButton.Click += delegate { Close(); };
        closeButton.FlatAppearance.MouseOverBackColor = Color.FromArgb(248, 210, 212);
        header.Controls.Add(status); header.Controls.Add(actions); header.Controls.Add(collapseButton); header.Controls.Add(closeButton);
        browser.Dock = DockStyle.None;
        browser.DefaultBackgroundColor = BackColor;
        Controls.Add(browser); Controls.Add(header);
        bubbleWindow.FormBorderStyle = FormBorderStyle.None;
        bubbleWindow.AutoScaleMode = AutoScaleMode.None;
        bubbleWindow.StartPosition = FormStartPosition.Manual;
        bubbleWindow.ShowInTaskbar = false;
        bubbleWindow.Icon = Icon;
        bubbleWindow.Text = "同屏 · 点击展开";
        bubbleWindow.BackColor = Color.FromArgb(75, 112, 181);
        bubbleWindow.ClientSize = new Size((int)(54 * scale), (int)(54 * scale));
        bubble.Dock = DockStyle.Fill;
        bubble.AccessibleName = "展开日程";
        bubble.ContextMenuStrip = menu;
        tips.SetToolTip(bubble, "点击展开日程 · 拖动移动 · 右键退出");
        bubble.Click += delegate { if (!bubbleDragged) Expand(); };
        bubble.MouseDown += delegate(object sender, MouseEventArgs e) { if (e.Button != MouseButtons.Left) return; bubbleDragged = false; dragStart = Cursor.Position; bubbleStart = desired.Location; bubble.Capture = true; };
        bubble.MouseMove += delegate(object sender, MouseEventArgs e) {
            if (!bubble.Capture || e.Button != MouseButtons.Left || !collapsed) return;
            Point delta = new Point(Cursor.Position.X - dragStart.X, Cursor.Position.Y - dragStart.Y);
            if (Math.Abs(delta.X) + Math.Abs(delta.Y) > 5 * scale) bubbleDragged = true;
            if (bubbleDragged) { desired.Location = new Point(bubbleStart.X + delta.X, bubbleStart.Y + delta.Y); ClampPosition(); PositionOnDesktop(); }
        };
        bubble.MouseUp += delegate { bubble.Capture = false; };
        bubbleWindow.Controls.Add(bubble);
        using (var circle = new GraphicsPath()) { circle.AddEllipse(bubbleWindow.ClientRectangle); bubbleWindow.Region = new Region(circle); }
        menu.Items.Add("展开日程", null, delegate { Reveal(); });
        menu.Items.Add("收起为小圆点", null, delegate { Collapse(); });
        menu.Items.Add("刷新日程", null, delegate { if (browser.CoreWebView2 != null) browser.Reload(); });
        menu.Items.Add("恢复右侧位置", null, delegate { ResetPosition(); });
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("退出组件", null, delegate { Close(); });
        tray.Text = "同屏";
        tray.Icon = Icon;
        tray.ContextMenuStrip = menu;
        tray.Visible = true;
        tray.DoubleClick += delegate { Reveal(); };
        activation.Interval = 300;
        activation.Tick += delegate { if (!closing && exitForUpdate.WaitOne(0)) { Close(); return; } if (!closing && reveal.WaitOne(0)) Reveal(); };
        activation.Start();
        recovery.Interval = 5000;
        recovery.Tick += async delegate {
            if (!verify && !closing) { await ProbeRenderer(); WriteStatus(collapsed ? "collapsed" : renderHealth); }
        };
        Shown += async delegate { PositionOnDesktop(); recovery.Start(); await InitializeBrowser(); };
        FormClosing += delegate(object sender, FormClosingEventArgs e) { closing = true; recovery.Stop(); if (!verify) { SavePosition(); WriteStatus("closed:" + e.CloseReason); } tray.Visible = false; };
        FormClosed += delegate { activation.Dispose(); bubbleWindow.Dispose(); browser.Dispose(); tray.Dispose(); menu.Dispose(); recovery.Dispose(); tips.Dispose(); };
        Resize += delegate { LayoutSurface(); RoundCorners(); };
        LayoutSurface();
        Microsoft.Win32.SystemEvents.DisplaySettingsChanged += DisplayChanged;
        Microsoft.Win32.SystemEvents.PowerModeChanged += PowerChanged;
        FormClosed += delegate { Microsoft.Win32.SystemEvents.DisplaySettingsChanged -= DisplayChanged; Microsoft.Win32.SystemEvents.PowerModeChanged -= PowerChanged; };
    }

    void LayoutSurface()
    {
        if (header == null || browser == null) return;
        int barHeight = webToolbar ? 0 : (int)(36 * scale);
        header.Visible = !webToolbar;
        header.SetBounds(0, 0, ClientSize.Width, barHeight);
        browser.SetBounds(0, barHeight, ClientSize.Width, Math.Max(1, ClientSize.Height - barHeight));
        header.BringToFront();
    }

    void SetupHeaderButton(Button button, string label, string name)
    {
        button.Text = label; button.AccessibleName = name;
        button.Dock = DockStyle.Right; button.Width = (int)(40 * scale);
        button.FlatStyle = FlatStyle.Flat; button.FlatAppearance.BorderSize = 0;
        button.Font = new Font("Segoe UI", 15, FontStyle.Bold); button.ForeColor = Color.FromArgb(35, 53, 88); button.BackColor = Color.FromArgb(221, 231, 249);
        tips.SetToolTip(button, name);
    }
    void Collapse()
    {
        if (collapsed || closing) return;
        gesture = "";
        expandedBounds = desired;
        collapsed = true;
        int diameter = (int)(54 * scale);
        desired = new Rectangle(expandedBounds.Right - diameter, expandedBounds.Top, diameter, diameter);
        ClampPosition(); ShowBubble();
        Hide();
        WriteStatus("collapsed");
    }
    void Expand()
    {
        if (!collapsed || closing) return;
        collapsed = false;
        desired = expandedBounds;
        bubbleWindow.Hide();
        ClampPosition(); PositionOnDesktop(); Show(); WindowState = FormWindowState.Normal; Activate(); LayoutSurface(); RoundCorners();
        WriteStatus("expanded");
    }
    void ShowBubble()
    {
        bubbleWindow.Show();
        // The first Show applies monitor DPI; size the circle after that change.
        bubbleWindow.Bounds = desired;
        var previous = bubbleWindow.Region;
        using (var circle = new GraphicsPath()) { circle.AddEllipse(bubbleWindow.ClientRectangle); bubbleWindow.Region = new Region(circle); }
        if (previous != null) previous.Dispose();
    }
    void PositionOnDesktop()
    {
        // Both surfaces are independent top-level windows. Never attach input
        // queues to Explorer or alter the desktop's window hierarchy.
        if (collapsed) bubbleWindow.Bounds = desired;
        else Bounds = desired;
    }
    void Reveal()
    {
        if (collapsed) Expand();
        Show(); WindowState = FormWindowState.Normal; Activate();
    }
    void ResetPosition()
    {
        Reveal();
        var area = Screen.PrimaryScreen.WorkingArea;
        desired = new Rectangle(area.Right - Width - 22, area.Top + 24, Width, Math.Min(Height, area.Height - 48));
        ClampPosition(); PositionOnDesktop();
        if (!verify) SavePosition();
    }

    void DisplayChanged(object sender, EventArgs e)
    {
        if (!closing && IsHandleCreated) BeginInvoke(new Action(delegate { ClampPosition(); PositionOnDesktop(); RestoreRendering(); }));
    }
    void PowerChanged(object sender, Microsoft.Win32.PowerModeChangedEventArgs e)
    {
        if (e.Mode == Microsoft.Win32.PowerModes.Resume && !closing && IsHandleCreated) BeginInvoke(new Action(RestoreRendering));
    }
    void RestoreRendering()
    {
        if (closing || browser.CoreWebView2 == null) return;
        try { browser.Visible = false; LayoutSurface(); browser.Visible = true; browser.Reload(); renderHealth = "reloading"; }
        catch { renderHealth = "renderer-unavailable"; }
    }
    async Task ProbeRenderer()
    {
        if (probing || browser.CoreWebView2 == null) return;
        probing = true;
        try {
            var probe = browser.ExecuteScriptAsync("JSON.stringify({toolbar:!!document.getElementById('tongpin-widget-controls'),sync:document.querySelector('.desk-sync')?.textContent||'',login:!!document.getElementById('invite-code')})");
            if (await Task.WhenAny(probe, Task.Delay(2500)) != probe) { renderHealth = "renderer-unresponsive"; return; }
            string result = await probe;
            renderHealth = result.Contains("已同步") ? "page-synced" : result.Contains("未连接") ? "page-offline" : "page-loaded";
        } catch { renderHealth = "renderer-unavailable"; }
        finally { probing = false; }
    }
    void ClampPosition()
    {
        Rectangle area = Screen.FromRectangle(desired).WorkingArea;
        desired.Width = Math.Min(desired.Width, area.Width - 32);
        desired.Height = Math.Min(desired.Height, area.Height - 32);
        desired.X = Math.Max(area.Left + 16, Math.Min(desired.X, area.Right - desired.Width - 16));
        desired.Y = Math.Max(area.Top + 16, Math.Min(desired.Y, area.Bottom - desired.Height - 16));
    }
    void LoadPosition()
    {
        try { var p = File.ReadAllText(Path.Combine(dataPath, "position.txt")).Split(','); desired.X = int.Parse(p[0]); desired.Y = int.Parse(p[1]); if (p.Length >= 4) { desired.Width = Math.Max((int)(320 * scale), int.Parse(p[2])); desired.Height = Math.Max((int)(280 * scale), int.Parse(p[3])); } ClampPosition(); } catch { }
    }
    void SavePosition()
    {
        try { if (!collapsed && WindowState == FormWindowState.Normal) desired = Bounds; Rectangle saved = collapsed ? expandedBounds : desired; File.WriteAllText(Path.Combine(dataPath, "position.txt"), saved.X + "," + saved.Y + "," + saved.Width + "," + saved.Height); } catch { }
    }
    void HandleGesture(string command)
    {
        if (collapsed || closing) return;
        if (command.StartsWith("gesture-start:")) {
            string kind = command.Substring(14);
            if (Array.IndexOf(new[] { "move", "n", "s", "e", "w", "ne", "nw", "se", "sw" }, kind) < 0) return;
            desired = Bounds;
            gestureBounds = desired; gesture = kind;
        }
        else if (command == "gesture-end") { gesture = ""; if (!verify) SavePosition(); }
        else if (command == "gesture-cancel") { if (gesture == "") return; desired = gestureBounds; gesture = ""; PositionOnDesktop(); }
        else if (command.StartsWith("gesture-delta:") && gesture != "") {
            string[] parts = command.Substring(14).Split(','); int dx, dy;
            if (parts.Length != 2 || !int.TryParse(parts[0], out dx) || !int.TryParse(parts[1], out dy) || Math.Abs((long)dx) > 32768 || Math.Abs((long)dy) > 32768) return;
            if (gesture == "move") desired = new Rectangle(gestureBounds.X + dx, gestureBounds.Y + dy, gestureBounds.Width, gestureBounds.Height);
            else {
                int left = gestureBounds.Left, top = gestureBounds.Top, right = gestureBounds.Right, bottom = gestureBounds.Bottom;
                int minimumWidth = (int)(320 * scale), minimumHeight = (int)(280 * scale);
                if (gesture.Contains("e")) right = Math.Max(left + minimumWidth, right + dx);
                if (gesture.Contains("w")) left = Math.Min(right - minimumWidth, left + dx);
                if (gesture.Contains("s")) bottom = Math.Max(top + minimumHeight, bottom + dy);
                if (gesture.Contains("n")) top = Math.Min(bottom - minimumHeight, top + dy);
                desired = Rectangle.FromLTRB(left, top, right, bottom);
            }
            ClampPosition(); PositionOnDesktop();
        }
    }
    void RoundCorners()
    {
        if (Width < 40 || Height < 40) return;
        Region old = Region;
        using (var path = new GraphicsPath()) {
            if (collapsed) { path.AddEllipse(0, 0, Width, Height); }
            else {
            int d = 28;
            path.AddArc(0, 0, d, d, 180, 90); path.AddArc(Width-d, 0, d, d, 270, 90);
            path.AddArc(Width-d, Height-d, d, d, 0, 90); path.AddArc(0, Height-d, d, d, 90, 90); path.CloseFigure();
            }
            Region = new Region(path);
        }
        if (old != null) old.Dispose();
    }
    async Task InitializeBrowser()
    {
        try
        {
            // Keep the software renderer that resolved black surfaces on this PC.
            var options = new CoreWebView2EnvironmentOptions { AdditionalBrowserArguments = "--disable-gpu" };
            var environment = await CoreWebView2Environment.CreateAsync(null, Path.Combine(dataPath, "WebView2"), options);
            await browser.EnsureCoreWebView2Async(environment);
            var core = browser.CoreWebView2;
            core.Settings.AreDefaultContextMenusEnabled = false;
            core.Settings.AreDevToolsEnabled = false;
            core.Settings.IsStatusBarEnabled = false;
            core.Settings.IsPasswordAutosaveEnabled = false;
            core.Settings.IsGeneralAutofillEnabled = false;
            core.PermissionRequested += delegate(object sender, CoreWebView2PermissionRequestedEventArgs e) { e.State = CoreWebView2PermissionState.Deny; };
            core.NewWindowRequested += delegate(object sender, CoreWebView2NewWindowRequestedEventArgs e) { e.Handled = true; /* Workspace editing is available in the user's normal browser. */ };
            core.NavigationStarting += delegate(object sender, CoreWebView2NavigationStartingEventArgs e) { Uri uri; if (!Uri.TryCreate(e.Uri, UriKind.Absolute, out uri) || uri.Scheme != "https" || uri.Host != "yanxue-sync.top") e.Cancel = true; };
            core.ProcessFailed += delegate(object sender, CoreWebView2ProcessFailedEventArgs e) { renderHealth = "renderer-failed:" + e.ProcessFailedKind; status.Text = "页面已停止 · 菜单可刷新"; WriteStatus(renderHealth); if (e.ProcessFailedKind == CoreWebView2ProcessFailedKind.RenderProcessExited) BeginInvoke(new Action(RestoreRendering)); };
            core.WebMessageReceived += delegate(object sender, CoreWebView2WebMessageReceivedEventArgs e) {
                Uri source;
                if (!Uri.TryCreate(e.Source, UriKind.Absolute, out source) || source.GetLeftPart(UriPartial.Authority) != Origin || source.AbsolutePath != "/desktop") return;
                string command;
                try { command = e.TryGetWebMessageAsString(); } catch { return; }
                if (command == "ui-ready") { webToolbar = true; LayoutSurface(); }
                else if (command.StartsWith("gesture-")) HandleGesture(command);
                else if (command == "collapse") Collapse();
                else if (command == "close") BeginInvoke(new Action(Close));
                else if (command == "refresh") RestoreRendering();
                else if (command == "reset") ResetPosition();
            };
            using (var stream = System.Reflection.Assembly.GetExecutingAssembly().GetManifestResourceStream("WidgetUI"))
            using (var reader = new StreamReader(stream, Encoding.UTF8)) await core.AddScriptToExecuteOnDocumentCreatedAsync(reader.ReadToEnd());
            if (!string.IsNullOrEmpty(signInCode)) {
                try { await SignIn(signInCode); }
                catch { status.Text = "登录未完成 · 请在下方输入邀请码"; }
                finally { signInCode = null; }
            }
            core.NavigationCompleted += async delegate(object sender, CoreWebView2NavigationCompletedEventArgs e) {
                if (!e.IsSuccess) { status.Text = "连接失败 · 菜单可刷新"; WriteStatus("navigation-failed"); }
                if (verify && !testing && e.IsSuccess) { testing = true; await Verify(); }
                else if (!verify && e.IsSuccess) {
                    for (int i = 0; i < 40 && !closing; i++) {
                        await Task.Delay(500);
                        if (closing) break;
                        try {
                            if (await browser.ExecuteScriptAsync("!!document.querySelector('.desk-sync') && document.querySelector('.desk-sync').textContent.includes('已同步')") == "true") { WriteStatus("synced"); break; }
                        } catch { break; }
                    }
                }
            };
            core.Navigate(Origin + "/desktop");
        }
        catch (Exception e)
        {
            signInCode = null; status.Text = "组件初始化失败 · 请重新打开";
            WriteStatus("initialization-failed:" + e.GetType().Name);
            if (verify) { Environment.ExitCode = 1; Close(); }
        }
    }
    async Task SignIn(string code)
    {
        var jar = new CookieContainer();
        using (var handler = new HttpClientHandler { CookieContainer = jar, AllowAutoRedirect = false })
        using (var client = new HttpClient(handler))
        {
            client.Timeout = TimeSpan.FromSeconds(25);
            client.DefaultRequestHeaders.Add("Origin", Origin);
            var body = new StringContent(json.Serialize(new { action = "login", code = code }), Encoding.UTF8, "application/json");
            using (var result = await client.PostAsync(Origin + "/api/team", body)) result.EnsureSuccessStatusCode();
            foreach (Cookie cookie in jar.GetCookies(new Uri(Origin)))
            {
                if (cookie.Name != "tongpin_session" || !cookie.Secure || !cookie.HttpOnly) continue;
                var saved = browser.CoreWebView2.CookieManager.CreateCookie(cookie.Name, cookie.Value, "yanxue-sync.top", "/");
                saved.IsSecure = true; saved.IsHttpOnly = true; saved.SameSite = CoreWebView2CookieSameSiteKind.Strict;
                saved.Expires = cookie.Expires == DateTime.MinValue ? DateTime.Now.AddDays(30) : cookie.Expires;
                browser.CoreWebView2.CookieManager.AddOrUpdateCookie(saved);
            }
        }
    }
    async Task Verify()
    {
        try
        {
            bool synced = false;
            for (int i = 0; i < 50; i++) {
                await Task.Delay(500);
                if (await browser.ExecuteScriptAsync("!!document.querySelector('.desk-sync') && document.querySelector('.desk-sync').textContent.includes('已同步')") == "true") { synced = true; break; }
            }
            if (!synced) throw new InvalidOperationException("Sync not ready");
            bool independent = IsIndependentSurface(this) && !TopMost && !ShowInTaskbar && (Native.GetWindowLong(Handle, -20) & 0x40000) == 0;
            if (!independent) throw new InvalidOperationException("Window is not independent");
            Rectangle initialBounds = desired;
            await VerifyPointerGesture("header", -40, 10, false);
            if (desired.X != initialBounds.X - 40 || desired.Y != initialBounds.Y + 10) throw new InvalidOperationException("Direct header drag failed");
            await VerifyPointerGesture("[data-edge=se]", -80, -120, false);
            if (desired.Width != initialBounds.Width - 80 || desired.Height != initialBounds.Height - 120 || Width != desired.Width || Height != desired.Height) throw new InvalidOperationException("Direct resize failed");
            Rectangle resizedBounds = desired;
            await VerifyPointerGesture("[data-edge=w]", -30, 0, true);
            if (desired != resizedBounds) throw new InvalidOperationException("Resize cancellation failed");
            desired = initialBounds; PositionOnDesktop();
            string before = await browser.ExecuteScriptAsync("document.querySelector('.desk-sync').title");
            await browser.ExecuteScriptAsync("document.querySelector('[aria-label=上一周]').click()");
            await Task.Delay(500);
            if (await browser.ExecuteScriptAsync("!!document.querySelector('.desk-today') && !document.querySelector('.desk-week strong').textContent.includes('本周')") != "true") throw new InvalidOperationException("Week navigation failed");
            await browser.ExecuteScriptAsync("document.querySelector('.desk-today').click()");
            await Task.Delay(16000);
            if (before == await browser.ExecuteScriptAsync("document.querySelector('.desk-sync').title")) throw new InvalidOperationException("Refresh failed");
            await CaptureHealthyPreview("preview.png");
            WindowState = FormWindowState.Minimized;
            Reveal();
            if (WindowState != FormWindowState.Normal || !IsIndependentSurface(this)) throw new InvalidOperationException("Restore independent window failed");
            var fullSize = Size;
            if (!webToolbar || header.Visible || browser.Top != 0) throw new InvalidOperationException("Native header still visible");
            if (await browser.ExecuteScriptAsync("(()=>{let h=document.getElementById('tongpin-widget-controls'),s=h.shadowRoot;return ['collapse','close'].every(id=>{let b=s.getElementById(id),r=b.getBoundingClientRect();return r.width>=36 && r.height>=30 && s.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===b})})()") != "true") throw new InvalidOperationException("Web controls obstructed");
            await browser.ExecuteScriptAsync("document.getElementById('tongpin-widget-controls').shadowRoot.getElementById('collapse').click()");
            await Task.Delay(1000);
            if (!collapsed || Visible || bubbleWindow.Width != (int)(54 * scale) || !bubbleWindow.Visible || !IsIndependentSurface(bubbleWindow) || bubbleWindow.ShowInTaskbar || (Native.GetWindowLong(bubbleWindow.Handle, -20) & 0x40000) != 0) throw new InvalidOperationException("Collapse failed: width=" + bubbleWindow.Width + ", expected=" + (int)(54 * scale) + ", parent=" + Native.ClassName(Native.GetParent(bubbleWindow.Handle)));
            using (var bitmap = new Bitmap(bubble.Width, bubble.Height)) { bubble.DrawToBitmap(bitmap, bubble.ClientRectangle); bitmap.Save(Path.Combine(dataPath, "bubble.png")); }
            bubble.PerformClick();
            if (collapsed || !browser.Visible || Size != fullSize) throw new InvalidOperationException("Expand failed");
            await browser.ExecuteScriptAsync("document.getElementById('tongpin-widget-controls').shadowRoot.getElementById('collapse').click()");
            await Task.Delay(300); bubble.PerformClick();
            RestoreRendering();
            bool restored = false;
            for (int i = 0; i < 40; i++) { await Task.Delay(500); if (await browser.ExecuteScriptAsync("!!document.querySelector('.desk-sync') && document.querySelector('.desk-sync').textContent.includes('已同步')") == "true") { restored = true; break; } }
            if (!restored) throw new InvalidOperationException("Repaint recovery failed");
            await CaptureHealthyPreview("recovered.png");
            WriteStatus("verified:software-rendering,nonblack-preview,repaint-recovery,direct-drag,edge-resize,independent-window,no-taskbar-icons,https-sync,collapse-expand,close");
            try { await browser.ExecuteScriptAsync("document.getElementById('tongpin-widget-controls').shadowRoot.getElementById('close').click()"); } catch { if (!closing) throw; }
            await Task.Delay(300);
            if (!closing) throw new InvalidOperationException("Close button failed");
        }
        catch (Exception e) { WriteStatus("verification-failed:" + e.GetType().Name + ":" + e.Message); Environment.ExitCode = 1; }
        finally { if (!closing) Close(); }
    }
    async Task CaptureHealthyPreview(string name)
    {
        using (var data = new MemoryStream()) {
            await browser.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, data);
            data.Position = 0;
            using (var bitmap = new Bitmap(data)) {
                int dark = 0, count = 0;
                for (int y = 5; y < bitmap.Height; y += 25) for (int x = 5; x < bitmap.Width; x += 25) { var color = bitmap.GetPixel(x, y); if (color.R < 15 && color.G < 15 && color.B < 15) dark++; count++; }
                if (count == 0 || dark > count * .8) throw new InvalidOperationException("Captured page is black");
                bitmap.Save(Path.Combine(dataPath, name));
            }
        }
    }
    async Task VerifyPointerGesture(string selector, int dx, int dy, bool cancel)
    {
        string script = "(()=>{let s=document.getElementById('tongpin-widget-controls').shadowRoot,t=s.querySelector(" + json.Serialize(selector) + ");" +
            "t.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,composed:true,button:0,pointerId:88,screenX:100,screenY:100}));" +
            "window.dispatchEvent(new PointerEvent('pointermove',{pointerId:88,screenX:100+(" + dx + ")/devicePixelRatio,screenY:100+(" + dy + ")/devicePixelRatio}));" +
            (cancel ? "document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));" : "window.dispatchEvent(new PointerEvent('pointerup',{pointerId:88}));") + "})()";
        await browser.ExecuteScriptAsync(script); await Task.Delay(350);
    }
    void WriteStatus(string state)
    {
        try {
            File.WriteAllText(Path.Combine(dataPath, verify ? "verification.json" : "status.json"), json.Serialize(new { state = state, renderMode = "software", pid = System.Diagnostics.Process.GetCurrentProcess().Id, windowMode = "independent", taskbarIcon = ShowInTaskbar, bubbleTaskbarIcon = bubbleWindow.ShowInTaskbar, independent = IsIndependentSurface(this), collapsed = collapsed, visible = Visible, bubbleVisible = bubbleWindow.Visible, parentClass = Native.ClassName(Native.GetParent(Handle)), topmost = (Native.GetWindowLong(Handle, -20) & 8) != 0, width = Width, height = Height, timestamp = DateTimeOffset.Now.ToString("o") }));
        } catch { }
    }
    static bool IsIndependentSurface(Form surface)
    {
        if ((Native.GetWindowLong(surface.Handle, -16) & 0x40000000) != 0) return false;
        IntPtr owner = Native.GetParent(surface.Handle);
        if (owner == IntPtr.Zero) return true;
        // WinForms hides taskbar entries through an invisible owner in our own
        // process. This is not a child window or an attachment to Explorer.
        uint ownerProcess;
        Native.GetWindowThreadProcessId(owner, out ownerProcess);
        return ownerProcess == (uint)System.Diagnostics.Process.GetCurrentProcess().Id;
    }
}

sealed class PetButton : Button
{
    public PetButton() { FlatStyle = FlatStyle.Flat; FlatAppearance.BorderSize = 0; Cursor = Cursors.Hand; SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer, true); }
    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics; g.SmoothingMode = SmoothingMode.AntiAlias;
        float size = Math.Min(Width, Height);
        using (var fill = new LinearGradientBrush(ClientRectangle, Color.FromArgb(114, 153, 224), Color.FromArgb(62, 98, 167), 65f)) g.FillEllipse(fill, 0, 0, size - 1, size - 1);
        using (var eye = new SolidBrush(Color.White)) {
            g.FillEllipse(eye, size * .31f, size * .35f, size * .075f, size * .13f);
            g.FillEllipse(eye, size * .61f, size * .35f, size * .075f, size * .13f);
        }
        using (var smile = new Pen(Color.FromArgb(234, 242, 255), size * .035f)) { smile.StartCap = smile.EndCap = LineCap.Round; g.DrawArc(smile, size * .39f, size * .48f, size * .23f, size * .15f, 5, 170); }
        if (Focused) using (var ring = new Pen(Color.FromArgb(200, 221, 255), 2)) g.DrawEllipse(ring, 3, 3, size - 7, size - 7);
    }
}

static class Native
{
    [DllImport("user32.dll")] public static extern IntPtr GetParent(IntPtr window);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);
    [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr window, int index);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr window, StringBuilder name, int count);
    public static string ClassName(IntPtr window) { var name = new StringBuilder(256); GetClassName(window, name, name.Capacity); return name.ToString(); }
}
