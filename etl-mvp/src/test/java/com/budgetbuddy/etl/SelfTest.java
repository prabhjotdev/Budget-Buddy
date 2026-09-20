package com.budgetbuddy.etl;

import com.budgetbuddy.etl.model.Source;
import com.budgetbuddy.etl.model.Txn;
import com.budgetbuddy.etl.pipeline.ImportPipeline;
import com.budgetbuddy.etl.pipeline.ImportResult;
import com.budgetbuddy.etl.store.TransactionStore;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.Stream;

/**
 * Dependency-free self-test. Runs the whole pipeline in a temp directory and asserts the
 * behaviors that matter for correctness. Exits non-zero if any check fails (so run.sh/CI can gate on it).
 */
public final class SelfTest {
    private static int checks = 0;
    private static int failures = 0;

    public static void main(String[] args) throws Exception {
        Path base = Files.createTempDirectory("etl-selftest");
        TransactionStore store = new TransactionStore(base.resolve("store.tsv"));
        ImportPipeline pipeline = new ImportPipeline(base, store);

        // 1) A manually-added transaction: Coffee $5.00 on 2026-09-10, user label "Coffee".
        pipeline.seedManual(new Txn("chequing", LocalDate.parse("2026-09-10"),
                new BigDecimal("5.00"), "manual entry", "Coffee", Source.MANUAL, null));
        check("manual entry is stored", store.count() == 1);

        // 2) Import a CSV whose first row is the SAME date+amount but a DIFFERENT description.
        writeCsv(base.resolve("inbox/chequing.csv"),
                "date,amount,description",
                "2026-09-10,5.00,STARBUCKS #123", // same date+amount as the manual coffee -> MATCH
                "2026-09-11,42.30,LOBLAWS",       // new -> inserted
                "2026-09-12,20.00,SHELL GAS");    // new -> inserted
        ImportResult r1 = pipeline.processInbox().get(0);
        check("matched the manual entry despite a different description", r1.matched() == 1);
        check("inserted the two genuinely new rows", r1.inserted() == 2);
        check("no duplicates on first import", r1.duplicates() == 0);
        check("store now holds 3 transactions", store.count() == 3);
        check("processed file left the inbox (archived)", isEmptyDir(base.resolve("inbox")));
        check("a file exists in archive/", !isEmptyDir(base.resolve("archive")));

        // 3) Re-import the SAME file (you re-upload everything) -> fully idempotent.
        writeCsv(base.resolve("inbox/chequing.csv"),
                "date,amount,description",
                "2026-09-10,5.00,STARBUCKS #123",
                "2026-09-11,42.30,LOBLAWS",
                "2026-09-12,20.00,SHELL GAS");
        ImportResult r2 = pipeline.processInbox().get(0);
        check("re-import inserts nothing", r2.inserted() == 0);
        check("re-import recognizes all 3 rows as matched/duplicate", r2.matched() + r2.duplicates() == 3);
        check("store still holds 3 transactions after re-import", store.count() == 3);

        // 4) A known row in a new file is recognized as a duplicate (label never affects dedup).
        writeCsv(base.resolve("inbox/chequing.csv"),
                "date,amount,description",
                "2026-09-11,42.30,LOBLAWS");
        ImportResult r3 = pipeline.processInbox().get(0);
        check("known row is a duplicate, not re-inserted", r3.duplicates() == 1 && r3.inserted() == 0);

        // 5) A malformed row sends the whole file to error/ and inserts nothing.
        writeCsv(base.resolve("inbox/savings.csv"),
                "date,amount,description",
                "2026-09-13,not-a-number,WEIRD");
        ImportResult r4 = pipeline.processInbox().get(0);
        check("malformed file fails cleanly", r4.failed());
        check("failed file changed the store by 0 rows", store.count() == 3);
        check("failed file was moved to error/", !isEmptyDir(base.resolve("error")));

        System.out.printf("%n%d checks, %d failure(s)%n", checks, failures);
        if (failures > 0) {
            System.out.println("SELF-TEST FAILED");
            System.exit(1);
        }
        System.out.println("ALL CHECKS PASSED");
    }

    private static void writeCsv(Path p, String... lines) throws Exception {
        Files.createDirectories(p.getParent());
        Files.write(p, List.of(lines), StandardCharsets.UTF_8);
    }

    private static boolean isEmptyDir(Path dir) throws Exception {
        try (Stream<Path> s = Files.list(dir)) {
            return s.findAny().isEmpty();
        }
    }

    private static void check(String name, boolean condition) {
        checks++;
        if (condition) {
            System.out.println("  [PASS] " + name);
        } else {
            failures++;
            System.out.println("  [FAIL] " + name);
        }
    }
}
