%global debug_package %{nil}
%global __provides_exclude_from ^/usr/lib/nspire-studio/.*$
%global __requires_exclude ^libnspire\\.so.*$

Name:           nspire-studio
Version:        %{version}
Release:        1%{?dist}
Summary:        Make notes for TI-Nspire calculators and send them over USB
License:        GPL-3.0-or-later
URL:            https://github.com/ezeren76neptune/nspire-studio
BuildArch:      x86_64
Requires:       python3 >= 3.10
Requires:       python3-pyside6
Requires:       python3-pillow
Requires:       libusb1

%description
Nspire Studio is a desktop editor for TI-Nspire CX / CX II notes: tabs, text,
typeset equations, images, graphs and live input/output calculators, previewed
on a replica of the calculator screen and sent to the calculator over USB.

%install
cp -a %{stage}/. %{buildroot}/

%files
/usr/bin/nspire-studio
/usr/lib/nspire-studio
/usr/share/applications/nspire-studio.desktop
/usr/share/icons/hicolor/*/apps/nspire-studio.*
/usr/lib/udev/rules.d/69-ti-nspire.rules
/usr/share/mime/packages/nspire-studio.xml
%doc /usr/share/doc/nspire-studio

%post
udevadm control --reload-rules >/dev/null 2>&1 || :
udevadm trigger --subsystem-match=usb --attr-match=idVendor=0451 >/dev/null 2>&1 || :

%changelog
* Fri Oct 23 2026 ezeren76neptune <150636453+ezeren76neptune@users.noreply.github.com> - 1.0.0-1
- First release
