#!/bin/bash

# Frontend Test Memory Benchmarking Script
# This script runs the test suite with custom memory profiling to identify
# memory-intensive test files and patterns.

set -e

echo "🔬 Frontend Test Memory Benchmarking"
echo "====================================="
echo ""
echo "This will run the entire test suite with memory profiling enabled."
echo "Results will be saved to /tmp/ for analysis."
echo ""

# This script can be run from either project root or frontend package directory

# Optional: Expose GC for more accurate memory tracking
EXPOSE_GC=""
if [ "$1" == "--expose-gc" ]; then
  EXPOSE_GC="--pool=forks --poolOptions.forks.execArgv=--expose-gc"
  echo "✅ Garbage collection exposed for more accurate tracking"
  echo ""
fi

# Set memory limit (6GB based on current requirements)
export NODE_OPTIONS="--max-old-space-size=6144"

echo "📊 Configuration:"
echo "   Node heap limit: 6GB"
echo "   Test execution: Sequential (singleFork)"
echo "   Memory reporter: Custom Vitest reporter"
echo "   Output location: /tmp/"
echo ""
echo "⏱️  This may take 5-10 minutes depending on system..."
echo ""

# Run tests with memory profiling config
pnpm exec vitest run \
  --config=vitest.memory.config.ts \
  $EXPOSE_GC \
  --no-coverage

echo ""
echo "✅ Benchmarking complete!"
echo ""
echo "📁 Results saved to:"
echo "   CSV Report: /tmp/test-memory-benchmark-*.csv"
echo "   Snapshots:  /tmp/memory-snapshots-*.json"
echo ""
echo "Next steps:"
echo "  1. Review the console output above for top memory consumers"
echo "  2. Analyze the CSV report for detailed per-file breakdown"
echo "  3. Use memory-snapshots JSON for accumulation pattern analysis"
echo ""
