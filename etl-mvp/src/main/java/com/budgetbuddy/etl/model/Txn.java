package com.budgetbuddy.etl.model;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * A single transaction.
 *
 * Note the two description fields — this is the crux of "don't duplicate when I rename it":
 *  - rawDescription: exactly what the bank exported. Never edited. Dedup keys use THIS.
 *  - label:          the user-facing name. Free to rename; never part of any key.
 *
 * Money is BigDecimal, never double, so repeated math never drifts off the cent.
 */
public record Txn(
        String account,
        LocalDate date,
        BigDecimal amount,
        String rawDescription,
        String label,
        Source source,
        String externalId // bank reference/txn id if the CSV has one, else null
) {}
