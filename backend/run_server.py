"""Production entry point — bundled by PyInstaller into dotavip-backend.exe."""
import os
import sys

# When frozen, resources sit next to the exe
if getattr(sys, "frozen", False):
    os.chdir(os.path.dirname(sys.executable))
    # Windowed build (console=False) → sys.stdout/sys.stderr are None.
    # uvicorn and the logging module write to them on startup and the process
    # crashes silently. Redirect the missing streams to a log file: this both
    # prevents the crash and gives us a backend log for diagnostics.
    try:
        # Write the log to a per-user, always-writable location (the install dir
        # may be Program Files, which is read-only for non-admins).
        _base = os.environ.get("APPDATA") or os.path.expanduser("~")
        _log_dir = os.path.join(_base, "DotaVIP", "assets")
        os.makedirs(_log_dir, exist_ok=True)
        _logf = open(os.path.join(_log_dir, "backend.log"), "a",
                     buffering=1, encoding="utf-8", errors="replace")
        if sys.stdout is None:
            sys.stdout = _logf
        if sys.stderr is None:
            sys.stderr = _logf
    except Exception:
        # Last resort: never let logging setup take down the backend.
        import io
        if sys.stdout is None:
            sys.stdout = io.StringIO()
        if sys.stderr is None:
            sys.stderr = io.StringIO()

import uvicorn
from api.server import app

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8765, log_level="warning")
