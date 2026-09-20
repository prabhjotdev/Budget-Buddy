package com.budgetbuddy.etl.pipeline;

/** Per-file outcome summary. */
public record ImportResult(String file, int inserted, int duplicates, int matched,
                           boolean failed, String error) {

    public static ImportResult ok(String file, int inserted, int duplicates, int matched) {
        return new ImportResult(file, inserted, duplicates, matched, false, null);
    }

    public static ImportResult fail(String file, String error) {
        return new ImportResult(file, 0, 0, 0, true, error);
    }
}
