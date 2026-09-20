#!/usr/bin/env bash
# Compile and run the demo against ./data. Copies sample CSVs into the inbox first.
# Run it twice: the second run reports every row as a duplicate (idempotency).
set -euo pipefail
cd "$(dirname "$0")"

mkdir -p out data/inbox data/processing data/archive data/error
cp -n data/samples/*.csv data/inbox/ 2>/dev/null || true

echo "Compiling..."
find src/main -name '*.java' > .sources
javac -d out @.sources
rm -f .sources

echo "Running demo against ./data ..."
java -cp out com.budgetbuddy.etl.Main data
