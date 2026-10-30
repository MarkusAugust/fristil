#!/usr/bin/env bash
# Runs a command with an accessibility bus and a display, as a Linux desktop
# with a screen reader running has: a D-Bus session, the AT-SPI bus, the
# status "a screen reader is listening" set, and an X server.
#
#   bash interfaces/scripts/accessibility/session.sh <command> [arguments…]
#
# Needs what install.sh installs, and xvfb, which the Playwright image has.
set -eo pipefail

if [ -z "${LOTEK_A11Y_SESSION:-}" ]; then
  export LOTEK_A11Y_SESSION=1
  exec dbus-run-session -- bash "$0" "$@"
fi

launcher=""
for candidate in /usr/libexec/at-spi-bus-launcher /usr/lib/at-spi2-core/at-spi-bus-launcher; do
  if [ -x "$candidate" ]; then launcher=$candidate; break; fi
done
if [ -z "$launcher" ]; then
  echo "✗ at-spi-bus-launcher not found: install at-spi2-core" >&2
  exit 1
fi
"$launcher" --launch-immediately &

# Wait until the bus answers, with a deadline that says so.
for _ in $(seq 1 100); do
  if dbus-send --session --print-reply --dest=org.a11y.Bus /org/a11y/bus org.a11y.Bus.GetAddress >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 0.1
done
if [ -z "${ready:-}" ]; then
  echo "✗ waited-in-vain-for-the-accessibility-bus" >&2
  exit 1
fi

# What Orca sets when it starts: browsers only build their AT-SPI tree when
# an assistive technology says it is listening.
dbus-send --session --print-reply --dest=org.a11y.Bus /org/a11y/bus \
  org.freedesktop.DBus.Properties.Set string:org.a11y.Status string:IsEnabled variant:boolean:true >/dev/null

exec xvfb-run -a "$@"
