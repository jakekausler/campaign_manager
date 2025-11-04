#!/bin/bash
# Frontend Test Execution by Category
# Runs tests in groups to avoid OOM
#
# Part of Phase 1 Task 1.3 of test-memory-mitigation-plan.md
# This script provides a CI-safe way to run all frontend tests by splitting them into categories
# Each category runs independently, preventing memory accumulation from reaching the 6GB threshold

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║ Frontend Test Suite - Category-based Execution            ║"
echo "║ Phase 1 (Mitigation Plan): OOM Prevention Strategy        ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Track total stats
TOTAL_PASSED=0
TOTAL_FAILED=0
TOTAL_FILES=0
START_TIME=$(date +%s)

# Function to run a category and track results
run_category() {
    local category_name=$1
    local category_pattern=$2

    echo "┌────────────────────────────────────────────────────────────┐"
    echo "│ 📦 Category: $category_name"
    echo "└────────────────────────────────────────────────────────────┘"

    # Run the tests and capture output
    if pnpm exec vitest run $category_pattern; then
        echo "✅ $category_name completed successfully"
    else
        echo "❌ $category_name had failures"
        exit 1
    fi

    echo ""
}

# Category 1: Lightweight Tests (utils, stores, hooks, contexts, config)
# These tests are fast and memory-efficient
run_category "Lightweight Tests" "src/utils/ src/stores/ src/hooks/ src/contexts/ src/config/"

# Category 2: Components - Branches, Versions, Shared
# Medium complexity components with moderate memory usage
run_category "Standard Components" "src/components/features/branches/ src/components/features/versions/ src/components/shared/"

# Category 3: Heavy Components (entity-inspector, map, timeline, rule-builder)
# These components use complex UI libraries and heavy dependencies
run_category "Heavy Components" "src/components/features/entity-inspector/ src/components/features/map/ src/components/features/timeline/ src/components/features/rule-builder/"

# Category 4: Pages and Flow
# Full page components and React Flow-based visualizations
run_category "Pages and Flow" "src/pages/ src/components/features/flow/"

# Category 5: Integration Tests
# Service-level integration tests
run_category "Integration Tests" "src/services/"

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo "╔════════════════════════════════════════════════════════════╗"
echo "║ ✅ All Test Categories Complete!                          ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Total Duration: ${DURATION}s"
echo ""
echo "This category-based approach prevents OOM by running tests in isolated"
echo "groups, ensuring each category stays well under the 6GB memory limit."
