package com.budgetbuddy.etl.model;

/** Where a transaction came from. Determines nothing about dedup — that is key-based. */
public enum Source {
    MANUAL, // user typed it into the app
    IMPORT  // came from a bank CSV
}
