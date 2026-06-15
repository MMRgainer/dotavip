$typeName = "WinFocusChecker"
if (-not ([System.Management.Automation.PSTypeName]$typeName).Type) {
    Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class $typeName {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
}
"@
}
$hwnd = [WinFocusChecker]::GetForegroundWindow()
$pid2 = [uint32]0
[WinFocusChecker]::GetWindowThreadProcessId($hwnd, [ref]$pid2) | Out-Null
$proc = Get-Process -Id ([int]$pid2) -ErrorAction SilentlyContinue
if ($proc) { Write-Output $proc.ProcessName } else { Write-Output "" }
