#!/bin/bash
# Custom RPM %postun scriptlet for the fork.
#
# Upstream issue #1395: dnf remove failed because the default electron-builder
# template called `update-alternatives --remove` even when the binary had never
# been configured as an alternative. This script must never make package removal
# fail; it deliberately avoids `set -e` and always exits zero.

alternative_name='frappe-books'
launcher='/usr/bin/frappe-books'
apparmor_profile='/etc/apparmor.d/frappe-books'
registered_paths=(
  '/opt/Frappe Books/frappe-books'
  '/opt/Frappe-Books/frappe-books'
)

if command -v update-alternatives >/dev/null 2>&1; then
  alternatives_output="$(update-alternatives --query "$alternative_name" 2>/dev/null || true)"
  for candidate in "${registered_paths[@]}"; do
    case "$alternatives_output" in
      *"$candidate"*)
        update-alternatives --remove "$alternative_name" "$candidate" || true
        ;;
    esac
  done

  if [ -L "$launcher" ]; then
    link_target="$(readlink "$launcher" 2>/dev/null || true)"
    if [ "$link_target" != "/etc/alternatives/$alternative_name" ]; then
      rm -f "$launcher" || true
    fi
  fi
else
  rm -f "$launcher" || true
fi

if [ -f "$apparmor_profile" ]; then
  if command -v apparmor_status >/dev/null 2>&1 && apparmor_status --enabled >/dev/null 2>&1; then
    if ! { [ -x /usr/bin/ischroot ] && /usr/bin/ischroot; } && command -v apparmor_parser >/dev/null 2>&1; then
      apparmor_parser --remove "$apparmor_profile" || true
    fi
  fi
  rm -f "$apparmor_profile" || true
fi

exit 0
