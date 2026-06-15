# PyInstaller spec for the DotaVIP backend.
# Build:  pyinstaller dotavip-backend.spec --noconfirm
from PyInstaller.utils.hooks import collect_submodules, collect_data_files

hidden = (
    collect_submodules("uvicorn")
    + collect_submodules("fastapi")
    + collect_submodules("pydantic")
    + collect_submodules("pydantic_settings")
    + ["cv2", "numpy", "mss", "keyboard", "mouse", "pytesseract", "vdf"]
)

datas = [
    ("assets", "assets"),          # hero_abilities.json, calibration, portraits
]

a = Analysis(
    ["run_server.py"],
    pathex=["."],
    binaries=[],
    datas=datas,
    hiddenimports=hidden,
    hookspath=[],
    runtime_hooks=[],
    excludes=["matplotlib", "tkinter", "PIL.ImageQt"],
    noarchive=False,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz, a.scripts, a.binaries, a.datas, [],
    name="dotavip-backend",
    console=False,           # no console window in production
    disable_windowed_traceback=False,
    upx=False,
)
