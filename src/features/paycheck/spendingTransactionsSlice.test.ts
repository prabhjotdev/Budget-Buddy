import { describe, it, expect, vi } from 'vitest';
import { Timestamp } from 'firebase/firestore';

// See paycheckCyclesSlice.test.ts — mock config so importing the slice does not
// initialize a real Firebase app. Thunks are never dispatched here.
vi.mock('../../services/firebase/config', () => ({
  db: {},
  auth: {},
  googleProvider: {},
  default: {},
}));

import reducer, {
  createSpendingTransaction,
  updateSpendingTransaction,
  deleteSpendingTransaction,
  clearCycleTransactions,
  fetchTransactionsByCycle,
} from './spendingTransactionsSlice';
import type { SpendingTransaction } from '../../types';

const ts = (ms: number) => Timestamp.fromMillis(ms);

const makeTx = (over: Partial<SpendingTransaction> & { id: string }): SpendingTransaction => ({
  cycleId: 'c1',
  amount: 10,
  description: '',
  paymentMethodId: 'pm1',
  paymentMethodName: 'Debit',
  tagIds: [],
  tagNames: [],
  variableObligationId: null,
  variableObligationName: null,
  date: ts(1_000),
  createdAt: ts(0),
  updatedAt: ts(0),
  ...over,
});

const emptyState = () => ({
  byId: {} as Record<string, SpendingTransaction>,
  allIds: [] as string[],
  idsByCycle: {} as Record<string, string[]>,
  hasFullHistory: false,
  isLoading: false,
  error: null as string | null,
});

const addTx = (state: ReturnType<typeof emptyState>, tx: SpendingTransaction) =>
  reducer(state, createSpendingTransaction.fulfilled(tx, 'req', { userId: 'u', transaction: tx }));

describe('spendingTransactionsSlice reducer — value updates', () => {
  it('createSpendingTransaction inserts most-recent-first and indexes by cycle', () => {
    let state = emptyState();
    state = addTx(state, makeTx({ id: 'older', date: ts(1_000) }));
    state = addTx(state, makeTx({ id: 'newer', date: ts(5_000) }));
    state = addTx(state, makeTx({ id: 'middle', date: ts(3_000) }));

    expect(state.allIds).toEqual(['newer', 'middle', 'older']);
    expect(state.idsByCycle.c1).toContain('newer');
    expect(state.byId.newer.amount).toBe(10);
  });

  it('updateSpendingTransaction merges only the provided fields', () => {
    let state = emptyState();
    state = addTx(state, makeTx({ id: 't1', amount: 10, description: 'old' }));

    state = reducer(
      state,
      updateSpendingTransaction.fulfilled(
        { transactionId: 't1', updates: { amount: 42.5, description: 'new' } },
        'req',
        { userId: 'u', transactionId: 't1', updates: { amount: 42.5 } }
      )
    );

    expect(state.byId.t1.amount).toBe(42.5);
    expect(state.byId.t1.description).toBe('new');
    expect(state.byId.t1.paymentMethodId).toBe('pm1'); // untouched
  });

  it('deleteSpendingTransaction removes it from byId, allIds and the cycle index', () => {
    let state = emptyState();
    state = addTx(state, makeTx({ id: 't1', date: ts(2_000) }));
    state = addTx(state, makeTx({ id: 't2', date: ts(1_000) }));

    state = reducer(
      state,
      deleteSpendingTransaction.fulfilled('t1', 'req', { userId: 'u', transactionId: 't1' })
    );

    expect(state.byId.t1).toBeUndefined();
    expect(state.allIds).toEqual(['t2']);
    expect(state.idsByCycle.c1).toEqual(['t2']);
  });

  it('clearCycleTransactions drops every transaction for one cycle only', () => {
    let state = emptyState();
    state = addTx(state, makeTx({ id: 'a', cycleId: 'c1', date: ts(3_000) }));
    state = addTx(state, makeTx({ id: 'b', cycleId: 'c2', date: ts(2_000) }));
    state = addTx(state, makeTx({ id: 'c', cycleId: 'c1', date: ts(1_000) }));

    state = reducer(state, clearCycleTransactions('c1'));

    expect(state.idsByCycle.c1).toBeUndefined();
    expect(state.allIds).toEqual(['b']);
    expect(state.byId.a).toBeUndefined();
    expect(state.byId.b).toBeDefined();
  });

  it('fetchTransactionsByCycle replaces a cycle bucket and keeps allIds date-sorted', () => {
    let state = emptyState();
    state = addTx(state, makeTx({ id: 'stale', cycleId: 'c1', date: ts(500) }));
    state = addTx(state, makeTx({ id: 'other', cycleId: 'c2', date: ts(9_000) }));

    const refreshed = [
      makeTx({ id: 'fresh1', cycleId: 'c1', date: ts(4_000) }),
      makeTx({ id: 'fresh2', cycleId: 'c1', date: ts(1_000) }),
    ];

    state = reducer(
      state,
      fetchTransactionsByCycle.fulfilled({ cycleId: 'c1', transactions: refreshed }, 'req', {
        userId: 'u',
        cycleId: 'c1',
      })
    );

    expect(state.byId.stale).toBeUndefined();
    expect(state.idsByCycle.c1).toEqual(['fresh1', 'fresh2']);
    // 'other' (t=9000) is newest, then fresh1 (4000), fresh2 (1000).
    expect(state.allIds).toEqual(['other', 'fresh1', 'fresh2']);
  });
});
