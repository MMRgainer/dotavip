// DotaVIP dev launcher — compiled to DotaVIP.exe in the project root.
// A windowless (winexe) starter: launches backend + vite + electron silently,
// then exits. Children are detached, so the app lives on its own like a
// normal Windows application. No consoles, no terminals.
//
// Rebuild (from project root):
//   C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe /nologo /target:winexe
//     /out:DotaVIP.exe /win32icon:frontend\build\icon.ico scripts\launcher.cs

using System;
using System.Diagnostics;
using System.IO;
using System.Net.Sockets;
using System.Threading;
using System.Windows.Forms;

class DotaVipLauncher
{
    // Project root = folder this exe lives in
    static readonly string Root = AppDomain.CurrentDomain.BaseDirectory.TrimEnd('\\');

    [STAThread]
    static void Main()
    {
        try
        {
            string backendDir  = Path.Combine(Root, "backend");
            string frontendDir = Path.Combine(Root, "frontend");
            string python   = Path.Combine(backendDir, @".venv\Scripts\python.exe");
            string electron = Path.Combine(frontendDir, @"node_modules\electron\dist\electron.exe");

            if (!File.Exists(python) || !File.Exists(electron))
            {
                MessageBox.Show("DotaVIP: не знайдено backend\\.venv або frontend\\node_modules.\n" +
                                "Перевір, що DotaVIP.exe лежить у корені проєкту.",
                                "DotaVIP", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            // Stop previous instances of OUR processes (matched by path, so other
            // Electron-based apps are untouched).
            KillOurs("electron");
            KillOurs("python");
            KillByName("dotavip-backend");

            // 1) backend (uvicorn), hidden
            StartHidden(python,
                "-m uvicorn api.server:app --host 127.0.0.1 --port 8765 --log-level warning",
                backendDir);

            // 2) vite dev server, hidden
            StartHidden("cmd.exe", "/c node_modules\\.bin\\vite.cmd --port 5173", frontendDir);

            // wait until vite answers (max 40s)
            if (!WaitPort(5173, 40))
            {
                MessageBox.Show("DotaVIP: vite не запустився за 40с.", "DotaVIP",
                                MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            // 3) electron (the app itself), detached
            var psi = new ProcessStartInfo(electron, ".");
            psi.WorkingDirectory = frontendDir;
            psi.UseShellExecute  = false;
            psi.EnvironmentVariables["NODE_ENV"] = "development";
            Process.Start(psi);
            // launcher exits here; children keep running on their own
        }
        catch (Exception ex)
        {
            MessageBox.Show("DotaVIP launcher error:\n" + ex.Message, "DotaVIP",
                            MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    static void StartHidden(string exe, string args, string cwd)
    {
        var psi = new ProcessStartInfo(exe, args);
        psi.WorkingDirectory = cwd;
        psi.UseShellExecute  = false;
        psi.CreateNoWindow   = true;
        Process.Start(psi);
    }

    static bool WaitPort(int port, int seconds)
    {
        for (int i = 0; i < seconds * 2; i++)
        {
            try
            {
                // "localhost" resolves to ::1 and/or 127.0.0.1 — vite binds
                // IPv6-only on this machine, so don't hardcode 127.0.0.1
                using (var c = new TcpClient("localhost", port)) { return true; }
            }
            catch { }
            Thread.Sleep(500);
        }
        return false;
    }

    // Kill processes with this name whose exe lives inside our project folder
    static void KillOurs(string name)
    {
        foreach (var p in Process.GetProcessesByName(name))
        {
            try
            {
                string path = p.MainModule.FileName;
                if (path != null && path.StartsWith(Root, StringComparison.OrdinalIgnoreCase))
                { p.Kill(); p.WaitForExit(3000); }
            }
            catch { }
            finally { p.Dispose(); }
        }
    }

    static void KillByName(string name)
    {
        foreach (var p in Process.GetProcessesByName(name))
        {
            try { p.Kill(); p.WaitForExit(3000); } catch { }
            finally { p.Dispose(); }
        }
    }
}
