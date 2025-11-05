#!/bin/bash
# Frontend Test Execution by Category
# Runs tests in groups to avoid OOM
#
# Part of Phase 1 Task 1.3 of test-memory-mitigation-plan.md
# This script provides a CI-safe way to run all frontend tests by splitting them into categories
# Each category runs independently, preventing memory accumulation from reaching the 6GB threshold

# Exit on errors EXCEPT test failures - we want to run all categories
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
FAILED_CATEGORIES=()

# Function to run a category and track results
run_category() {
    local category_name=$1
    local category_pattern=$2

    echo "┌────────────────────────────────────────────────────────────┐"
    echo "│ 📦 Category: $category_name"
    echo "└────────────────────────────────────────────────────────────┘"

    # Run the tests and capture output (allow failures)
    set +e  # Temporarily disable exit-on-error
    pnpm exec vitest run $category_pattern
    local exit_code=$?
    set -e  # Re-enable exit-on-error for script errors

    if [ $exit_code -eq 0 ]; then
        echo "✅ $category_name completed successfully"
    else
        echo "❌ $category_name had failures (exit code: $exit_code)"
        FAILED_CATEGORIES+=("$category_name")
    fi

    echo ""
    return $exit_code
}

# Category 1: Lightweight Tests (utils, stores, hooks, contexts, config)
# These tests are fast and memory-efficient
run_category "Lightweight Tests" "src/utils/ src/stores/ src/hooks/ src/contexts/ src/config/" || true

# Category 2: Components - Branches, Versions, Shared
# Medium complexity components with moderate memory usage
run_category "Standard Components" "src/components/features/branches/ src/components/features/versions/ src/components/shared/" || true

# Category 3: Heavy Components (entity-inspector, map, timeline, rule-builder)
# These components use complex UI libraries and heavy dependencies
run_category "Heavy Components" "src/components/features/entity-inspector/ src/components/features/map/ src/components/features/timeline/ src/components/features/rule-builder/" || true

# Category 4: Pages and Flow
# Full page components and React Flow-based visualizations
run_category "Pages and Flow" "src/pages/ src/components/features/flow/" || true

# Category 5: Integration Tests
# Service-level integration tests
run_category "Integration Tests" "src/services/" || true

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo "╔════════════════════════════════════════════════════════════╗"
if [ ${#FAILED_CATEGORIES[@]} -eq 0 ]; then
    echo "║ ✅ All Test Categories Passed!                            ║"
else
    echo "║ ❌ Some Test Categories Failed                            ║"
fi
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Total Duration: ${DURATION}s"
echo ""

# Report failures
if [ ${#FAILED_CATEGORIES[@]} -gt 0 ]; then
    echo "Failed Categories (${#FAILED_CATEGORIES[@]}):"
    for category in "${FAILED_CATEGORIES[@]}"; do
        echo "  - $category"
    done
    echo ""
    echo "This category-based approach prevents OOM by running tests in isolated"
    echo "groups. All categories were executed despite failures."
    exit 1
else
    echo "This category-based approach prevents OOM by running tests in isolated"
    echo "groups, ensuring each category stays well under the 6GB memory limit."
    exit 0
fi
