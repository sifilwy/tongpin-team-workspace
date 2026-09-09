using System;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Win32;

static class Installer
{
    static readonly string[] Files = { "TongpinWidget.exe", "Microsoft.Web.WebView2.Core.dll", "Microsoft.Web.WebView2.WinForms.dll", "WebView2Loader.dll", "WebView2-LICENSE.txt", "WebView2-NOTICE.txt", "tongpin-calendar.ico", "使用说明.md" };
    [STAThread]
    static void Main(string[] args)
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        if (args.Length == 1 && args[0] == "--verify-payload") {
            try { string directory = Path.Combine(Path.GetTempPath(), "TongpinInstallerVerification", Version()); Extract(directory); Console.WriteLine("Payload verified: " + Files.Length + " program files; no profiles or credentials"); }
            catch (Exception e) { Console.Error.WriteLine(e.Message); Environment.ExitCode = 1; }
            return;
        }
        if (args.Length == 1 && args[0] == "--install-only") {
            try { Console.WriteLine(Install()); } catch (Exception e) { Console.Error.WriteLine(e.Message); Environment.ExitCode = 1; }
            return;
        }
        if (args.Length != 0) return;
        var form = new Form { Text = "安装同屏日程", ClientSize = new Size(430, 260), FormBorderStyle = FormBorderStyle.FixedDialog, MaximizeBox = false, StartPosition = FormStartPosition.CenterScreen, BackColor = Color.FromArgb(247, 249, 253), Font = new Font("Microsoft YaHei UI", 10) };
        form.Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        var title = new Label { Text = "把日程放到桌面", AutoSize = true, Location = new Point(28, 28), Font = new Font(form.Font.FontFamily, 18, FontStyle.Bold) };
        var note = new Label { Text = "安装到当前用户，创建桌面图标。\n保留已有登录和日程，不占任务栏位置。", Location = new Point(28, 85), Size = new Size(370, 80) };
        var button = new Button { Text = "安装并打开", Location = new Point(28, 180), Size = new Size(374, 46), BackColor = Color.FromArgb(66, 105, 185), ForeColor = Color.White, FlatStyle = FlatStyle.Flat };
        bool installing = false;
        form.FormClosing += delegate(object sender, FormClosingEventArgs e) { if (installing) e.Cancel = true; };
        button.Click += async delegate {
            installing = true; button.Enabled = false; button.Text = "正在安装…";
            try { string executable = await Task.Run(new Func<string>(Install)); System.Diagnostics.Process.Start(executable); installing = false; form.Close(); }
            catch (Exception e) { note.Text = e.Message; button.Text = "重试安装"; button.Enabled = true; installing = false; }
        };
        form.Controls.AddRange(new Control[] { title, note, button });
        Application.Run(form);
    }
    static string Version()
    {
        using (var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("Payload"))
        using (var sha = SHA256.Create()) return BitConverter.ToString(sha.ComputeHash(stream)).Replace("-", "").Substring(0, 16).ToLowerInvariant();
    }
    static void Extract(string directory)
    {
        Directory.CreateDirectory(directory);
        using (var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("Payload"))
        using (var zip = new ZipArchive(stream, ZipArchiveMode.Read)) {
            if (zip.Entries.Count != Files.Length || zip.Entries.Select(e => e.FullName).Distinct().Count() != Files.Length || zip.Entries.Any(e => !Files.Contains(e.FullName))) throw new InvalidDataException("安装包内容不完整，请重新下载。");
            foreach (var entry in zip.Entries) {
                string target = Path.Combine(directory, entry.FullName);
                using (var input = entry.Open())
                using (var memory = new MemoryStream()) {
                    input.CopyTo(memory); byte[] data = memory.ToArray();
                    if (File.Exists(target)) { if (!File.ReadAllBytes(target).SequenceEqual(data)) throw new IOException("安装目录中的文件已变化，请联系维护人员。"); }
                    else File.WriteAllBytes(target, data);
                }
            }
        }
    }
    static string Install()
    {
        bool fresh;
        using (var installerMutex = new Mutex(true, "Local\\TongpinWidgetInstaller", out fresh)) {
            if (!fresh) throw new InvalidOperationException("另一个安装程序正在运行，请稍后重试。");
            string directory = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "TongpinWidget", "Versions", Version());
            Extract(directory);
            // Request a graceful exit through the widget's own event. Do not kill
            // unrelated processes or overwrite binaries while they are running.
            EventWaitHandle quit;
            if (EventWaitHandle.TryOpenExisting("Local\\TongpinWidgetExitForUpdate", out quit)) using (quit) quit.Set();
            Mutex widget;
            if (Mutex.TryOpenExisting("Local\\TongpinWidget", out widget)) using (widget) {
                bool acquired = false;
                try { try { acquired = widget.WaitOne(5000); } catch (AbandonedMutexException) { acquired = true; } if (!acquired) throw new InvalidOperationException("请先从右下角托盘退出旧版同屏日程，再点重试。"); }
                finally { if (acquired) widget.ReleaseMutex(); }
            }
            string executable = Path.Combine(directory, "TongpinWidget.exe");
            using (var protocol = Registry.CurrentUser.CreateSubKey(@"Software\Classes\tongpin-widget")) {
                protocol.SetValue("", "URL:同屏日程"); protocol.SetValue("URL Protocol", "");
                using (var icon = protocol.CreateSubKey("DefaultIcon")) icon.SetValue("", "\"" + Path.Combine(directory, "tongpin-calendar.ico") + "\",0");
                using (var command = protocol.CreateSubKey(@"shell\open\command")) command.SetValue("", "\"" + executable + "\" --open-from-web \"%1\"");
            }
            string shortcutPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "同屏日程.lnk");
            object shell = Activator.CreateInstance(Type.GetTypeFromProgID("WScript.Shell"));
            object shortcut = null;
            try {
                shortcut = shell.GetType().InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, shell, new object[] { shortcutPath });
                Set(shortcut, "TargetPath", executable); Set(shortcut, "WorkingDirectory", directory); Set(shortcut, "Description", "同屏桌面日程"); Set(shortcut, "IconLocation", Path.Combine(directory, "tongpin-calendar.ico") + ",0");
                shortcut.GetType().InvokeMember("Save", BindingFlags.InvokeMethod, null, shortcut, null);
            } finally { if (shortcut != null) Marshal.FinalReleaseComObject(shortcut); Marshal.FinalReleaseComObject(shell); }
            return executable;
        }
    }
    static void Set(object target, string key, object value) { target.GetType().InvokeMember(key, BindingFlags.SetProperty, null, target, new[] { value }); }
}
