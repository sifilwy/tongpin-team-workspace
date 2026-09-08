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
        bool verify = Array.IndexOf(args, "--verify") >= 0;
        bool fresh;
        using (var mutex = new Mutex(true, "Local\\TongpinWidget" + (verify ? "Verification" : ""), out fresh))
        {
            if (!fresh) return;
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
            string code = Array.IndexOf(args, "--signin-stdin") >= 0 ? Console.In.ReadLine() : null;
            Application.Run(new Widget(verify, code));
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
    readonly ToolStripMenuItem positionItem = new ToolStripMenuItem("移动位置");
    readonly Label status = new Label();
    readonly Panel header = new Panel();
    readonly Button collapseButton = new Button();
    readonly Button closeButton = new Button();
    readonly PetButton bubble = new PetButton();
    readonly ToolTip tips = new ToolTip();
    readonly System.Windows.Forms.Timer recovery = new System.Windows.Forms.Timer();
    bool attached, closing, testing, collapsed, bubbleDragged;
    float scale;
    Point dragStart, bubbleStart;
    Rectangle expandedBounds;
    IntPtr desktop;
    Rectangle desired;
    readonly JavaScriptSerializer json = new JavaScriptSerializer();

    public Widget(bool verification, string code)
    {
        verify = verification; signInCode = code;
        dataPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), verify ? "TongpinWidgetVerification" : "TongpinWidget");
        Directory.CreateDirectory(dataPath);
        Text = "同屏";
        Icon = SystemIcons.Application;
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
        header.Dock = DockStyle.Top; header.Height = (int)(30 * scale); header.BackColor = Color.FromArgb(232, 238, 249);
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
        browser.Dock = DockStyle.Fill;
        browser.DefaultBackgroundColor = BackColor;
        Controls.Add(browser); Controls.Add(header);
        bubble.Dock = DockStyle.Fill; bubble.Visible = false;
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
        Controls.Add(bubble);
        menu.Items.Add("展开日程", null, delegate { Expand(); });
        menu.Items.Add("收起为小圆点", null, delegate { Collapse(); });
        menu.Items.Add("刷新日程", null, delegate { if (browser.CoreWebView2 != null) browser.Reload(); });
        positionItem.Click += delegate { if (collapsed) Expand(); if (attached) Detach(); else Attach(true); };
        menu.Items.Add(positionItem);
        menu.Items.Add("恢复右侧位置", null, delegate { if (collapsed) Expand(); if (!attached) Attach(false); var area = Screen.PrimaryScreen.WorkingArea; desired = new Rectangle(area.Right - Width - 22, area.Top + 24, Width, Math.Min(Height, area.Height - 48)); Attach(true); });
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("退出组件", null, delegate { Close(); });
        tray.Text = "同屏";
        tray.Icon = Icon;
        tray.ContextMenuStrip = menu;
        tray.Visible = true;
        tray.DoubleClick += delegate { if (collapsed) Expand(); else if (attached) Detach(); else Activate(); };
        recovery.Interval = 5000;
        recovery.Tick += delegate { if (attached && (!Native.IsWindow(desktop) || Native.GetParent(Handle) != desktop)) Attach(false); };
        Shown += async delegate { Attach(false); recovery.Start(); await InitializeBrowser(); };
        FormClosing += delegate { closing = true; recovery.Stop(); if (!verify) SavePosition(); tray.Visible = false; };
        FormClosed += delegate { browser.Dispose(); tray.Dispose(); menu.Dispose(); recovery.Dispose(); tips.Dispose(); };
        Resize += delegate { RoundCorners(); };
        Microsoft.Win32.SystemEvents.DisplaySettingsChanged += DisplayChanged;
        FormClosed += delegate { Microsoft.Win32.SystemEvents.DisplaySettingsChanged -= DisplayChanged; };
    }

    void SetupHeaderButton(Button button, string label, string name)
    {
        button.Text = label; button.AccessibleName = name;
        button.Dock = DockStyle.Right; button.Width = (int)(32 * scale);
        button.FlatStyle = FlatStyle.Flat; button.FlatAppearance.BorderSize = 0;
        button.Font = new Font("Segoe UI", 13); button.ForeColor = status.ForeColor; button.BackColor = header.BackColor;
        tips.SetToolTip(button, name);
    }
    void Collapse()
    {
        if (collapsed || closing) return;
        if (!attached) Attach(true);
        if (!attached) return;
        expandedBounds = desired;
        collapsed = true;
        MinimumSize = Size.Empty;
        int diameter = (int)(54 * scale);
        desired = new Rectangle(expandedBounds.Right - diameter, expandedBounds.Top, diameter, diameter);
        browser.Visible = false; header.Visible = false; bubble.Visible = true; bubble.BringToFront();
        ClampPosition(); PositionOnDesktop(); RoundCorners();
        WriteStatus("collapsed");
    }
    void Expand()
    {
        if (!collapsed || closing) return;
        collapsed = false;
        desired = expandedBounds;
        bubble.Visible = false; browser.Visible = true; header.Visible = true;
        ClampPosition(); PositionOnDesktop(); RoundCorners();
        WriteStatus("expanded");
    }
    void PositionOnDesktop()
    {
        var point = new Native.Point { X = desired.X, Y = desired.Y };
        Native.ScreenToClient(desktop, ref point);
        Native.SetWindowPos(Handle, IntPtr.Zero, point.X, point.Y, desired.Width, desired.Height, 0x0010 | 0x0020 | 0x0040);
    }

    void DisplayChanged(object sender, EventArgs e)
    {
        if (!closing && IsHandleCreated) BeginInvoke(new Action(delegate { ClampPosition(); if (attached) Attach(false); }));
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
        try { var p = File.ReadAllText(Path.Combine(dataPath, "position.txt")).Split(','); desired.X = int.Parse(p[0]); desired.Y = int.Parse(p[1]); ClampPosition(); } catch { }
    }
    void SavePosition()
    {
        try { if (!attached) desired = Bounds; Rectangle saved = collapsed ? expandedBounds : desired; File.WriteAllText(Path.Combine(dataPath, "position.txt"), saved.X + "," + saved.Y); } catch { }
    }
    void RoundCorners()
    {
        if (Width < 40 || Height < 40) return;
        Region old = Region;
        if (!attached) Region = null;
        else using (var path = new GraphicsPath()) {
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
    void Attach(bool save)
    {
        if (!attached && FormBorderStyle != FormBorderStyle.None) desired = Bounds;
        desktop = Native.GetShellWindow();
        if (desktop == IntPtr.Zero) { status.Text = "桌面未就绪 · 请稍后固定"; return; }
        ClampPosition();
        FormBorderStyle = FormBorderStyle.None;
        ShowInTaskbar = false;
        int style = Native.GetWindowLong(Handle, -16);
        Native.SetWindowLong(Handle, -16, (style & ~unchecked((int)0x80000000)) | 0x40000000);
        Native.SetParent(Handle, desktop);
        attached = Native.GetParent(Handle) == desktop;
        if (!attached) { Detach(); status.Text = "暂时无法嵌入 · 菜单可重试"; WriteStatus("attach-failed"); return; }
        var point = new Native.Point { X = desired.X, Y = desired.Y };
        Native.ScreenToClient(desktop, ref point);
        Native.SetWindowPos(Handle, IntPtr.Zero, point.X, point.Y, desired.Width, desired.Height, 0x0010 | 0x0020 | 0x0040);
        positionItem.Text = "移动位置";
        status.Text = "同屏";
        RoundCorners();
        if (save && !verify) SavePosition();
        WriteStatus("attached");
    }
    void Detach()
    {
        Native.Rect rectangle; Native.GetWindowRect(Handle, out rectangle);
        desired = new Rectangle(rectangle.Left, rectangle.Top, rectangle.Right-rectangle.Left, rectangle.Bottom-rectangle.Top);
        Native.SetParent(Handle, IntPtr.Zero);
        int style = Native.GetWindowLong(Handle, -16);
        Native.SetWindowLong(Handle, -16, (style & ~0x40000000) | unchecked((int)0x80000000));
        attached = false;
        FormBorderStyle = FormBorderStyle.SizableToolWindow;
        ShowInTaskbar = true;
        Bounds = desired;
        MinimumSize = new Size(340, 480);
        positionItem.Text = "固定到桌面";
        status.Text = "拖动标题栏 · 菜单固定到桌面";
        RoundCorners();
        Show(); Activate();
    }

    async Task InitializeBrowser()
    {
        try
        {
            var environment = await CoreWebView2Environment.CreateAsync(null, Path.Combine(dataPath, "WebView2"));
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
            core.ProcessFailed += delegate { status.Text = "页面已停止 · 菜单可刷新"; WriteStatus("renderer-failed"); };
            // Compact only this embedded copy; keep the normal website unchanged.
            await core.AddScriptToExecuteOnDocumentCreatedAsync("document.addEventListener('DOMContentLoaded',()=>{let s=document.createElement('style');s.textContent='body .desktop-agenda{padding:12px 16px 18px;min-height:100vh}body .desk-header{display:none}body .desk-top{margin-top:0}body .desk-footer a{display:none}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#bdcbe1;border-radius:5px}';document.head.append(s)})");
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
            bool embedded = attached && Native.GetParent(Handle) == Native.GetShellWindow() && (Native.GetWindowLong(Handle, -16) & 0x40000000) != 0 && (Native.GetWindowLong(Handle, -20) & 8) == 0;
            if (!embedded) throw new InvalidOperationException("Not embedded");
            string before = await browser.ExecuteScriptAsync("document.querySelector('.desk-sync').title");
            await browser.ExecuteScriptAsync("document.querySelector('[aria-label=上一周]').click()");
            await Task.Delay(500);
            if (await browser.ExecuteScriptAsync("!!document.querySelector('.desk-today') && !document.querySelector('.desk-week strong').textContent.includes('本周')") != "true") throw new InvalidOperationException("Week navigation failed");
            await browser.ExecuteScriptAsync("document.querySelector('.desk-today').click()");
            await Task.Delay(16000);
            if (before == await browser.ExecuteScriptAsync("document.querySelector('.desk-sync').title")) throw new InvalidOperationException("Refresh failed");
            using (var file = File.Create(Path.Combine(dataPath, "preview.png"))) await browser.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, file);
            Detach();
            if (Native.GetParent(Handle) != IntPtr.Zero) throw new InvalidOperationException("Detach failed");
            Attach(false);
            if (!attached) throw new InvalidOperationException("Reattach failed");
            var fullSize = Size;
            // Exercise the actual controls, including hit testing in the title bar.
            foreach (Button button in new[] { collapseButton, closeButton }) {
                var center = new Point(button.Left + button.Width / 2, button.Top + button.Height / 2);
                if (header.GetChildAtPoint(center) != button) throw new InvalidOperationException("Header control obstructed");
            }
            collapseButton.PerformClick();
            if (!collapsed || browser.Visible || Width != (int)(54 * scale) || !bubble.Visible) throw new InvalidOperationException("Collapse failed");
            using (var bitmap = new Bitmap(Width, Height)) { bubble.DrawToBitmap(bitmap, new Rectangle(Point.Empty, Size)); bitmap.Save(Path.Combine(dataPath, "bubble.png")); }
            bubble.PerformClick();
            if (collapsed || !browser.Visible || Size != fullSize) throw new InvalidOperationException("Expand failed");
            collapseButton.PerformClick(); bubble.PerformClick();
            WriteStatus("verified:desktop-child,https-sync,auto-refresh,detach-reattach,header-hit-test,collapse-bubble-expand,close-button");
            closeButton.PerformClick();
            if (!closing) throw new InvalidOperationException("Close button failed");
        }
        catch (Exception e) { WriteStatus("verification-failed:" + e.GetType().Name); Environment.ExitCode = 1; }
        finally { if (!closing) Close(); }
    }
    void WriteStatus(string state)
    {
        try {
            File.WriteAllText(Path.Combine(dataPath, verify ? "verification.json" : "status.json"), json.Serialize(new { state = state, attached = attached, collapsed = collapsed, parentClass = Native.ClassName(Native.GetParent(Handle)), topmost = (Native.GetWindowLong(Handle, -20) & 8) != 0, width = Width, height = Height, timestamp = DateTimeOffset.Now.ToString("o") }));
        } catch { }
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
    [StructLayout(LayoutKind.Sequential)] public struct Point { public int X, Y; }
    [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left, Top, Right, Bottom; }
    [DllImport("user32.dll")] public static extern IntPtr GetShellWindow();
    [DllImport("user32.dll")] public static extern IntPtr GetParent(IntPtr window);
    [DllImport("user32.dll", SetLastError = true)] public static extern IntPtr SetParent(IntPtr window, IntPtr parent);
    [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr window);
    [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr window, int index);
    [DllImport("user32.dll")] public static extern int SetWindowLong(IntPtr window, int index, int value);
    [DllImport("user32.dll")] public static extern bool ScreenToClient(IntPtr window, ref Point point);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr window, out Rect rectangle);
    [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr window, IntPtr after, int x, int y, int width, int height, uint flags);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr window, StringBuilder name, int count);
    public static string ClassName(IntPtr window) { var name = new StringBuilder(256); GetClassName(window, name, name.Capacity); return name.ToString(); }
}
