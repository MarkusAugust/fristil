#!/usr/bin/env bash
# What check-accessibility-tree.ts needs on top of the Playwright image: the
# AT-SPI bus, a D-Bus session for it, and Python's AT-SPI bindings, the ones
# Orca uses. CI runs this in its container, and the check runs it in its own
# container on a machine that is not Linux, so the list is written once.
set -eo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq >/dev/null
apt-get install --yes -qq --no-install-recommends \
  at-spi2-core dbus-x11 python3-gi gir1.2-atspi-2.0 >/dev/null
