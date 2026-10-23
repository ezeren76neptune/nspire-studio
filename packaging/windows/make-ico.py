"""Build packaging/windows/nspire-studio.ico from the rendered PNG icons."""
from pathlib import Path
from PIL import Image
root = Path(__file__).resolve().parents[2]
img = Image.open(root / "static/icons/icon256.png")
img.save(root / "packaging/windows/nspire-studio.ico",
         sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
