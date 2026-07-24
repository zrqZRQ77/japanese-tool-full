#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

node scripts/build-offline-chinese-human-review-packet.mjs
node scripts/offline-chinese-human-review-server.mjs
