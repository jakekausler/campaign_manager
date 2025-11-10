#!/bin/bash

# Script to run pnpm dev commands with logging to /tmp
# Usage: ./scripts/dev-with-logging.sh <package-name>
#
# Example: ./scripts/dev-with-logging.sh api

set -euo pipefail

if [ $# -eq 0 ]; then
  echo "Error: Package name required"
  echo "Usage: $0 <package-name>"
  echo "Example: $0 api"
  exit 1
fi

PACKAGE_NAME="$1"
LOG_FILE="/tmp/campaign-${PACKAGE_NAME}-dev.log"

# Create or truncate the log file
: > "$LOG_FILE"

echo "==========================================="
echo "Starting dev server for: @campaign/${PACKAGE_NAME}"
echo "Logging to: ${LOG_FILE}"
echo "==========================================="
echo ""

# Run pnpm dev for the specific package, piping output to both console and log file
# Using unbuffered output (-u for stdbuf) to ensure real-time logging
pnpm --filter "@campaign/${PACKAGE_NAME}" dev 2>&1 | tee "$LOG_FILE"
