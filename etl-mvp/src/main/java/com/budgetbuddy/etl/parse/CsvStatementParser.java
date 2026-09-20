package com.budgetbuddy.etl.parse;

import com.budgetbuddy.etl.model.Source;
import com.budgetbuddy.etl.model.Txn;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Minimal CSV parser for a statement with header row: date,amount,description.
 * Account name is derived from the file name (chequing.csv -> "chequing").
 * Dependency-free; handles simple double-quoted fields with escaped quotes.
 *
 * A malformed row throws — the pipeline routes the whole file to error/ and inserts nothing.
 */
public final class CsvStatementParser {

    public List<Txn> parse(Path file) throws IOException {
        String account = accountFromFileName(file);
        List<String> lines = Files.readAllLines(file, StandardCharsets.UTF_8);
        List<Txn> out = new ArrayList<>();
        boolean header = true;
        for (String line : lines) {
            if (line.isBlank()) continue;
            if (header) { header = false; continue; }
            List<String> cols = splitCsv(line);
            if (cols.size() < 3) {
                throw new IOException("Bad row (expected date,amount,description): " + line);
            }
            LocalDate date = LocalDate.parse(cols.get(0).trim());
            BigDecimal amount = money(cols.get(1));
            String desc = cols.get(2).trim();
            out.add(new Txn(account, date, amount, desc, desc, Source.IMPORT, null));
        }
        return out;
    }

    private static String accountFromFileName(Path file) {
        String n = file.getFileName().toString();
        int dot = n.lastIndexOf('.');
        return dot > 0 ? n.substring(0, dot) : n;
    }

    private static BigDecimal money(String raw) {
        String cleaned = raw.replaceAll("[^0-9.-]", "");
        if (cleaned.isEmpty() || cleaned.equals("-") || cleaned.equals(".")) {
            throw new NumberFormatException("Not a valid amount: '" + raw + "'");
        }
        return new BigDecimal(cleaned).setScale(2, RoundingMode.HALF_UP);
    }

    private static List<String> splitCsv(String line) {
        List<String> out = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        boolean inQuotes = false;
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (inQuotes) {
                if (c == '"') {
                    if (i + 1 < line.length() && line.charAt(i + 1) == '"') { cur.append('"'); i++; }
                    else inQuotes = false;
                } else {
                    cur.append(c);
                }
            } else if (c == '"') {
                inQuotes = true;
            } else if (c == ',') {
                out.add(cur.toString());
                cur.setLength(0);
            } else {
                cur.append(c);
            }
        }
        out.add(cur.toString());
        return out;
    }
}
