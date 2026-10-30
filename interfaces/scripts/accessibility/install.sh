#!/usr/bin/env bash
# What check-accessibility-tree.ts needs on top of the Playwright image: the
# AT-SPI bus, a D-Bus session for it, and Python's AT-SPI bindings, the ones
# Orca uses. CI runs this in its container, and the check runs it in its own
# container on a machine that is not Linux, so the list is written once.
set -eo pipefail
export DEBIAN_FRONTEND=noninteractive
# A deadline on each: apt once hung on the runner's mirror (PR 235), and a
# step without one waits until the job's six hours are up.
timeout 300 apt-get update -qq >/dev/null
timeout 300 apt-get install --yes -qq --no-install-recommends \
  at-spi2-core dbus-x11 python3-gi gir1.2-atspi-2.0 >/dev/null
