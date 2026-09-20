package com.budgetbuddy.etl.pipeline;

import com.budgetbuddy.etl.model.Txn;
import com.budgetbuddy.etl.parse.CsvStatementParser;
import com.budgetbuddy.etl.store.TransactionStore;

import java.io.IOException;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

/**
 * Orchestrates the folder ETL, mirroring the real Java backend design:
 *
 *   inbox/ --(claim)--> processing/ --(on success)--> archive/
 *                                   --(on failure)--> error/
 *
 * Dedup happens against the store: exact content key first (idempotent re-import),
 * then a reconciliation key (account+date+amount) that links a bank row to an
 * existing manual entry even if the description differs. The file move is only for
 * organization — the store keys are the real correctness guarantee, so re-dropping
 * already-processed files is always safe.
 */
public final class ImportPipeline {
    private static final DateTimeFormatter STAMP = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss-SSS");

    private final Path inbox;
    private final Path processing;
    private final Path archive;
    private final Path error;
    private final TransactionStore store;
    private final CsvStatementParser parser = new CsvStatementParser();

    public ImportPipeline(Path base, TransactionStore store) throws IOException {
        this.inbox = base.resolve("inbox");
        this.processing = base.resolve("processing");
        this.archive = base.resolve("archive");
        this.error = base.resolve("error");
        for (Path p : List.of(inbox, processing, archive, error)) {
            Files.createDirectories(p);
        }
        this.store = store;
    }

    /** Seed a manually-entered transaction, as the app's "add spending" screen would. */
    public void seedManual(Txn t) throws IOException {
        store.append(t);
    }

    public List<ImportResult> processInbox() throws IOException {
        List<Path> files;
        try (Stream<Path> s = Files.list(inbox)) {
            files = s.filter(p -> p.toString().toLowerCase().endsWith(".csv")).sorted().toList();
        }
        List<ImportResult> results = new ArrayList<>();
        for (Path f : files) {
            results.add(processFile(f));
        }
        return results;
    }

    public ImportResult processFile(Path file) throws IOException {
        String name = file.getFileName().toString();
        Path claimed = processing.resolve(name);
        move(file, claimed); // claim the file so a concurrent run can't grab it too
        try {
            int inserted = 0, duplicates = 0, matched = 0;
            for (Txn t : parser.parse(claimed)) {
                String contentKey = Keys.content(t.account(), t.date(), t.amount(), t.rawDescription());
                if (store.hasContent(contentKey)) {
                    duplicates++; // exact row already stored -> idempotent re-import
                    continue;
                }
                String reconKey = Keys.recon(t.account(), t.date(), t.amount());
                if (store.hasRecon(reconKey)) {
                    matched++; // same account+date+amount already exists (e.g. a manual entry)
                    continue;
                }
                store.append(t);
                inserted++;
            }
            move(claimed, archive.resolve(stamp(name))); // only after all rows committed
            return ImportResult.ok(name, inserted, duplicates, matched);
        } catch (Exception e) {
            try {
                move(claimed, error.resolve(stamp(name)));
            } catch (IOException ignore) {
                // best effort; leave the file in processing/ if even the error move fails
            }
            return ImportResult.fail(name, e.getMessage());
        }
    }

    private static String stamp(String name) {
        return LocalDateTime.now().format(STAMP) + "__" + name;
    }

    private static void move(Path from, Path to) throws IOException {
        try {
            Files.move(from, to, StandardCopyOption.ATOMIC_MOVE);
        } catch (AtomicMoveNotSupportedException e) {
            Files.move(from, to, StandardCopyOption.REPLACE_EXISTING);
        }
    }
}
