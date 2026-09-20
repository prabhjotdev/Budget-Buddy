#!/usr/bin/env bash
# Compile everything (main + test) and run the self-test. Uses a temp dir; touches no repo data.
set -euo pipefail
cd "$(dirname "$0")"

mkdir -p out
find src -name '*.java' > .sources
javac -d out @.sources
rm -f .sources

java -cp out com.budgetbuddy.etl.SelfTest
