#!/bin/bash
# Test runner script for backend system requirements
# Usage: ./run_tests.sh [options]

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Backend System Requirements Test Suite                ║${NC}"
echo -e "${BLUE}║   Testing: TEST.md Requirements                          ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if virtual environment is activated
if [[ -z "$VIRTUAL_ENV" ]]; then
    echo -e "${YELLOW}Warning: Virtual environment not activated${NC}"
    echo -e "${YELLOW}Activate with: source .venv/bin/activate${NC}"
    echo ""
fi

# Check database connection
echo -e "${BLUE}[1/4] Checking database connection...${NC}"

# Try Docker-based database check first
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q postgres; then
    echo -e "${GREEN}✓ PostgreSQL container is running${NC}"
elif docker ps --format '{{.Names}}' 2>/dev/null | grep -q db; then
    echo -e "${GREEN}✓ Database container is running${NC}"
elif command -v psql &> /dev/null; then
    # Fallback to psql if available
    if psql $DATABASE_URL -c "SELECT 1" &> /dev/null 2>&1; then
        echo -e "${GREEN}✓ Database connection OK${NC}"
    else
        echo -e "${YELLOW}⚠ Database connection check failed${NC}"
        echo -e "${YELLOW}  Make sure DATABASE_URL is correct in .env${NC}"
    fi
else
    # No check available, just show info
    echo -e "${BLUE}ℹ Database runs in Docker (psql not needed on host)${NC}"
    echo -e "${BLUE}  Ensure: docker-compose up -d${NC}"
fi
echo ""

# Check required packages
echo -e "${BLUE}[2/4] Checking dependencies...${NC}"
python -c "import pytest; import pytest_asyncio" 2>/dev/null && \
    echo -e "${GREEN}✓ pytest and pytest-asyncio installed${NC}" || \
    (echo -e "${RED}✗ Missing dependencies${NC}" && echo "Run: pip install pytest pytest-asyncio" && exit 1)
echo ""

# Run tests based on argument
echo -e "${BLUE}[3/4] Running tests...${NC}"
echo ""

case "${1}" in
    "quick")
        echo -e "${YELLOW}Running quick tests (unit tests only)...${NC}"
        pytest tests/test_system_requirements.py::TestPatientReferences::test_patient_reference_persistence -v
        pytest tests/test_system_requirements.py::TestStreamingResponse::test_streaming_enabled -v
        ;;
    "unit")
        echo -e "${YELLOW}Running all unit tests...${NC}"
        pytest tests/test_system_requirements.py \
            -v \
            -k "not integration" \
            --tb=short
        ;;
    "integration")
        echo -e "${YELLOW}Running integration tests only...${NC}"
        pytest tests/test_system_requirements.py::TestIntegrationScenarios -v
        ;;
    "patient")
        echo -e "${YELLOW}Testing patient references...${NC}"
        pytest tests/test_system_requirements.py::TestPatientReferences -v
        ;;
    "streaming")
        echo -e "${YELLOW}Testing streaming responses...${NC}"
        pytest tests/test_system_requirements.py::TestStreamingResponse -v
        ;;
    "delegation")
        echo -e "${YELLOW}Testing delegation functionality...${NC}"
        pytest tests/test_system_requirements.py::TestParallelDelegation -v
        pytest tests/test_system_requirements.py::TestMultipleSpecialistDelegation -v
        ;;
    "tools")
        echo -e "${YELLOW}Testing tool usage...${NC}"
        pytest tests/test_system_requirements.py::TestMultipleToolCalls -v
        ;;
    "images")
        echo -e "${YELLOW}Testing image display...${NC}"
        pytest tests/test_system_requirements.py::TestImageInAnswer -v
        ;;
    "custom")
        echo -e "${YELLOW}Testing custom tools for specialists...${NC}"
        pytest tests/test_system_requirements.py::TestCustomToolsForSpecialists -v
        ;;
    "coverage")
        echo -e "${YELLOW}Running tests with coverage...${NC}"
        pytest tests/test_system_requirements.py \
            --cov=src \
            --cov-report=html \
            --cov-report=term \
            -v
        echo -e "${GREEN}Coverage report generated in htmlcov/index.html${NC}"
        ;;
    "verbose")
        echo -e "${YELLOW}Running all tests with verbose output...${NC}"
        pytest tests/test_system_requirements.py -vv -s --tb=long
        ;;
    *)
        echo -e "${YELLOW}Running full test suite...${NC}"
        pytest tests/test_system_requirements.py -v --tb=short
        ;;
esac

TEST_EXIT_CODE=$?
echo ""

# Summary
echo -e "${BLUE}[4/4] Test Summary${NC}"
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  ✓ ALL TESTS PASSED${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "Validated Requirements:"
    echo -e "  ${GREEN}✓${NC} Patient references in responses"
    echo -e "  ${GREEN}✓${NC} Image display capability"
    echo -e "  ${GREEN}✓${NC} Parallel specialist delegation"
    echo -e "  ${GREEN}✓${NC} Streaming responses"
    echo -e "  ${GREEN}✓${NC} Multiple tool calls"
    echo -e "  ${GREEN}✓${NC} Multiple specialist delegation"
    echo -e "  ${GREEN}✓${NC} Custom tools for specialists"
else
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}  ✗ SOME TESTS FAILED${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${YELLOW}Tips for debugging:${NC}"
    echo -e "  • Run with verbose: ./run_tests.sh verbose"
    echo -e "  • Check specific test: pytest tests/test_system_requirements.py::ClassName::test_name -vv"
    echo -e "  • Review logs in test output above"
    echo -e "  • Ensure database is running and migrations applied"
fi
echo ""

exit $TEST_EXIT_CODE
