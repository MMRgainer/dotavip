# Long-lived foreground-window monitor.
# Prints the foreground process name every 600ms. Compiled once, runs forever.
# main.cjs spawns this and reads stdout — no repeated process spawn = no lag.

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class FgWin {
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
}
"@

$last = ""
while ($true) {
    try {
        $hwnd = [FgWin]::GetForegroundWindow()
        $procId = [uint32]0
        [FgWin]::GetWindowThreadProcessId($hwnd, [ref]$procId) | Out-Null
        $name = ""
        if ($procId -gt 0) {
            $p = Get-Process -Id ([int]$procId) -ErrorAction SilentlyContinue
            if ($p) { $name = $p.ProcessName }
        }
        if ($name -ne $last) {
            $last = $name
            Write-Output $name
            [Console]::Out.Flush()
        }
    } catch {}
    Start-Sleep -Milliseconds 600
}
