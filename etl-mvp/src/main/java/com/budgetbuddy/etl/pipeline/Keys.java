package com.budgetbuddy.etl.pipeline;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;

/**
 * Deterministic dedup keys.
 *
 *  - content(): identity of a specific bank row. Uses the IMMUTABLE bank description,
 *    so renaming the user-facing label can never turn one transaction into two.
 *  - recon():   account + date + amount, description deliberately excluded. Used to
 *    match an incoming bank row against an existing manual entry the user already typed.
 */
public final class Keys {
    private Keys() {}

    public static String content(String account, LocalDate date, BigDecimal amount, String rawDescription) {
        return sha256(norm(account) + "|" + date + "|" + money(amount) + "|" + norm(rawDescription));
    }

    public static String recon(String account, LocalDate date, BigDecimal amount) {
        return norm(account) + "|" + date + "|" + money(amount);
    }

    public static String money(BigDecimal amount) {
        return amount.setScale(2, RoundingMode.HALF_UP).toPlainString();
    }

    private static String norm(String s) {
        return s == null ? "" : s.trim().toLowerCase();
    }

    private static String sha256(String s) {
        try {
            byte[] d = MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(d.length * 2);
            for (byte b : d) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }
}
