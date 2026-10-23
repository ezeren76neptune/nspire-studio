; Inno Setup script: builds dist\NspireStudio-<version>-Setup.exe
#define AppVersion GetEnv("APP_VERSION")
[Setup]
AppId={{6E9B6C1E-3F57-4C0B-9C2E-8A4E2B7D5A11}
AppName=Nspire Studio
AppVersion={#AppVersion}
AppPublisher=Nspire Studio
AppPublisherURL=https://github.com/ezeren76neptune/nspire-studio
DefaultDirName={autopf}\Nspire Studio
DefaultGroupName=Nspire Studio
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
OutputDir=..\..\dist
OutputBaseFilename=NspireStudio-{#AppVersion}-Setup
SetupIconFile=nspire-studio.ico
UninstallDisplayIcon={app}\NspireStudio.exe
LicenseFile=..\..\LICENSE
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
ChangesAssociations=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "..\..\build\pyinstaller\dist\NspireStudio\*"; DestDir: "{app}"; Flags: recursesubdirs ignoreversion

[Icons]
Name: "{autoprograms}\Nspire Studio"; Filename: "{app}\NspireStudio.exe"
Name: "{autodesktop}\Nspire Studio"; Filename: "{app}\NspireStudio.exe"; Tasks: desktopicon

[Registry]
Root: HKA; Subkey: "Software\Classes\.nsnotes"; ValueType: string; ValueName: ""; ValueData: "NspireStudio.Document"; Flags: uninsdeletevalue
Root: HKA; Subkey: "Software\Classes\NspireStudio.Document"; ValueType: string; ValueName: ""; ValueData: "Nspire Studio document"; Flags: uninsdeletekey
Root: HKA; Subkey: "Software\Classes\NspireStudio.Document\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: "{app}\NspireStudio.exe,0"
Root: HKA; Subkey: "Software\Classes\NspireStudio.Document\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\NspireStudio.exe"" ""%1"""

[Run]
Filename: "{app}\NspireStudio.exe"; Description: "{cm:LaunchProgram,Nspire Studio}"; Flags: nowait postinstall skipifsilent
