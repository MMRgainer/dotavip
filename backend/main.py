"""
Entry point — starts the FastAPI/uvicorn server.

Run:
    .venv\\Scripts\\python main.py
    or
    .venv\\Scripts\\uvicorn api.server:app --host 127.0.0.1 --port 8765 --reload
"""

import logging
import uvicorn
from config.settings import settings

logging.basicConfig(
    level=logging.getLevelName(settings.log_level.upper()),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

if __name__ == "__main__":
    uvicorn.run(
        "api.server:app",
        host=settings.host,
        port=settings.port,
        log_level=settings.log_level,
        reload=False,
    )
