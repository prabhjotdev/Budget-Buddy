package com.budgetbuddy.etl;

import com.budgetbuddy.etl.pipeline.ImportPipeline;
import com.budgetbuddy.etl.pipeline.ImportResult;
import com.budgetbuddy.etl.store.TransactionStore;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;

/**
 * Runs the pipeline once against a data directory (default ./data — see run.sh).
 * Drop CSVs in data/inbox/, run it, they land in the store and move to data/archive/.
 * Run it again with the same files and every row reports as a duplicate: proof of idempotency.
 */
public final class Main {
    public static void main(String[] args) throws Exception {
        Path base = Paths.get(args.length > 0 ? args[0] : "data");
        TransactionStore store = new TransactionStore(base.resolve("store.tsv"));
        ImportPipeline pipeline = new ImportPipeline(base, store);

        System.out.println("Store before: " + store.count() + " transactions");
        List<ImportResult> results = pipeline.processInbox();
        if (results.isEmpty()) {
            System.out.println("(no .csv files found in " + base.resolve("inbox") + ")");
        }
        for (ImportResult r : results) {
            if (r.failed()) {
                System.out.printf("  %-16s FAILED: %s%n", r.file(), r.error());
            } else {
                System.out.printf("  %-16s inserted=%d  duplicates=%d  matched=%d%n",
                        r.file(), r.inserted(), r.duplicates(), r.matched());
            }
        }
        System.out.println("Store after:  " + store.count() + " transactions");
    }
}
