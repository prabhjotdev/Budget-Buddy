package com.budgetbuddy.etl.store;

import com.budgetbuddy.etl.model.Txn;
import com.budgetbuddy.etl.pipeline.Keys;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.HashSet;
import java.util.Set;

/**
 * Tiny append-only, file-backed store standing in for the real Postgres transaction table.
 * One pipe-delimited line per transaction. Keeps in-memory sets of content and reconciliation
 * keys so dedup lookups are O(1). Dependency-free on purpose — this is an MVP, not the DB.
 *
 * Line format:
 *   contentKey|reconKey|account|date|amount|source|externalId|rawDescription|label
 */
public final class TransactionStore {
    private final Path file;
    private final Set<String> contentKeys = new HashSet<>();
    private final Set<String> reconKeys = new HashSet<>();
    private int count = 0;

    public TransactionStore(Path file) throws IOException {
        this.file = file;
        if (file.getParent() != null) Files.createDirectories(file.getParent());
        if (Files.exists(file)) load();
    }

    private void load() throws IOException {
        for (String line : Files.readAllLines(file, StandardCharsets.UTF_8)) {
            if (line.isBlank()) continue;
            String[] p = line.split("\\|", -1);
            contentKeys.add(p[0]);
            reconKeys.add(p[1]);
            count++;
        }
    }

    public boolean hasContent(String key) { return contentKeys.contains(key); }
    public boolean hasRecon(String key) { return reconKeys.contains(key); }
    public int count() { return count; }

    public void append(Txn t) throws IOException {
        String contentKey = Keys.content(t.account(), t.date(), t.amount(), t.rawDescription());
        String reconKey = Keys.recon(t.account(), t.date(), t.amount());
        String line = String.join("|",
                contentKey,
                reconKey,
                clean(t.account()),
                t.date().toString(),
                Keys.money(t.amount()),
                t.source().name(),
                t.externalId() == null ? "" : clean(t.externalId()),
                clean(t.rawDescription()),
                clean(t.label()));
        Files.writeString(file, line + System.lineSeparator(),
                StandardCharsets.UTF_8, StandardOpenOption.CREATE, StandardOpenOption.APPEND);
        contentKeys.add(contentKey);
        reconKeys.add(reconKey);
        count++;
    }

    private static String clean(String s) {
        return s == null ? "" : s.replace('|', ' ').replace('\n', ' ').replace('\r', ' ');
    }
}
