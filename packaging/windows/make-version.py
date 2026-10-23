"""Write packaging/windows/version.txt (exe file properties) from VERSION."""
from pathlib import Path
root = Path(__file__).resolve().parents[2]
v = (root / "VERSION").read_text().strip()
t = tuple(int(x) for x in (v.split(".") + ["0"] * 4)[:4])
(root / "packaging/windows/version.txt").write_text(f"""VSVersionInfo(
  ffi=FixedFileInfo(filevers={t}, prodvers={t}),
  kids=[StringFileInfo([StringTable('040904B0', [
    StringStruct('CompanyName', 'Nspire Studio'),
    StringStruct('FileDescription', 'Nspire Studio'),
    StringStruct('FileVersion', '{v}'),
    StringStruct('InternalName', 'NspireStudio'),
    StringStruct('LegalCopyright', 'GPL-3.0-or-later'),
    StringStruct('OriginalFilename', 'NspireStudio.exe'),
    StringStruct('ProductName', 'Nspire Studio'),
    StringStruct('ProductVersion', '{v}')])]),
    VarFileInfo([VarStruct('Translation', [1033, 1200])])])
""")
