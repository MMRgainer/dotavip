"""Production entry point — bundled by PyInstaller into dotavip-backend.exe."""
import os
import sys

# When frozen, resources sit next to the exe
if getattr(sys, "frozen", False):
    os.chdir(os.path.dirname(sys.executable))

import uvicorn
from api.server import app

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8765, log_level="warning")
