import { describe, it, expect, vi } from 'vitest';
import { Timestamp } from 'firebase/firestore';

// The slice transitively imports the Firebase service layer, which imports
// ./config and calls initializeApp() at module load. Mock config so no real
// Firebase app is created during these pure-reducer tests. The thunks are never
// dispatched here (we dispatch their `.fulfilled` actions directly), so the
// service functions are never called.
vi.mock('../../services/firebase/config', () => ({
  db: {},
  auth: {},
  googleProvider: {},
  default: {},
}));

import reducer, {
  createPaycheckCycle,
  updateCycleSpending,
  updateCycleObligationSpending,
  markCycleBillPaid,
  completeCycle,
  setActiveCycleId,
} from './paycheckCyclesSlice';
import { createBill, updateBill, deleteBill } from './billsSlice';
import type { PaycheckCycle } from '../../types';

const ts = (ms = 0) => Timestamp.fromMillis(ms);

const makeCycle = (over: Partial<PaycheckCycle> & { id: string }): PaycheckCycle => ({
  startDate: ts(1_000),
  endDate: ts(2_000),
  paycheckAmount: 2000,
  bills: [],
  billsTotal: 0,
  minimumSave: 0,
  actualSaved: 0,
  variableObligations: [],
  variableObligationsTotal: 0,
  variableObligationsSpent: 0,
  spendingLimit: 1000,
  totalSpent: 0,
  remainingToSpend: 1000,
  bufferContribution: 0,
  status: 'active',
  createdAt: ts(0),
  updatedAt: ts(0),
  ...over,
});

const stateWith = (cycles: PaycheckCycle[], activeCycleId: string | null = null) => ({
  byId: Object.fromEntries(cycles.map((c) => [c.id, c])),
  allIds: cycles.map((c) => c.id),
  activeCycleId,
  isLoading: false,
  error: null as string | null,
});

describe('paycheckCyclesSlice reducer — value updates', () => {
  it('updateCycleSpending overwrites totalSpent and remainingToSpend', () => {
    const state = stateWith([makeCycle({ id: 'c1', totalSpent: 100, remainingToSpend: 900 })], 'c1');

    const next = reducer(
      state,
      updateCycleSpending.fulfilled(
        { cycleId: 'c1', totalSpent: 250, remainingToSpend: 750 },
        'req',
        { userId: 'u', cycleId: 'c1', totalSpent: 250, remainingToSpend: 750 }
      )
    );

    expect(next.byId.c1.totalSpent).toBe(250);
    expect(next.byId.c1.remainingToSpend).toBe(750);
  });

  it('updateCycleObligationSpending updates the obligation pool and leaves remainingToSpend UNCHANGED', () => {
    const state = stateWith(
      [
        makeCycle({
          id: 'c1',
          totalSpent: 100,
          remainingToSpend: 900,
          variableObligationsSpent: 0,
          variableObligations: [
            { obligationId: 'gas', obligationName: 'Gas', estimatedAmount: 200, amountSpent: 0 },
          ],
        }),
      ],
      'c1'
    );

    const next = reducer(
      state,
      updateCycleObligationSpending.fulfilled(
        {
          cycleId: 'c1',
          obligationId: 'gas',
          newObligationAmountSpent: 40,
          newVariableObligationsSpent: 40,
          newTotalSpent: 140,
        },
        'req',
        {
          userId: 'u',
          cycleId: 'c1',
          obligationId: 'gas',
          newObligationAmountSpent: 40,
          newVariableObligationsSpent: 40,
          newTotalSpent: 140,
        }
      )
    );

    expect(next.byId.c1.variableObligations![0].amountSpent).toBe(40);
    expect(next.byId.c1.variableObligationsSpent).toBe(40);
    expect(next.byId.c1.totalSpent).toBe(140);
    // Invariant: obligation spending is a separate pool from discretionary spending.
    expect(next.byId.c1.remainingToSpend).toBe(900);
  });

  it('createPaycheckCycle marks the previously active cycle completed and switches active', () => {
    const state = stateWith([makeCycle({ id: 'old', status: 'active' })], 'old');
    const fresh = makeCycle({ id: 'new', status: 'active' });

    const next = reducer(
      state,
      createPaycheckCycle.fulfilled(fresh, 'req', { userId: 'u', cycle: fresh })
    );

    expect(next.activeCycleId).toBe('new');
    expect(next.byId.old.status).toBe('completed');
    expect(next.allIds[0]).toBe('new');
  });

  it('markCycleBillPaid toggles only the targeted bill', () => {
    const state = stateWith(
      [
        makeCycle({
          id: 'c1',
          bills: [
            { billId: 'rent', billName: 'Rent', amount: 1000, dueDate: ts(1500), isPaid: false, isDeferred: false },
            { billId: 'net', billName: 'Internet', amount: 60, dueDate: ts(1600), isPaid: false, isDeferred: false },
          ],
        }),
      ],
      'c1'
    );

    const next = reducer(
      state,
      markCycleBillPaid.fulfilled(
        { cycleId: 'c1', billId: 'rent', isPaid: true },
        'req',
        { userId: 'u', cycleId: 'c1', billId: 'rent', isPaid: true }
      )
    );

    expect(next.byId.c1.bills.find((b) => b.billId === 'rent')!.isPaid).toBe(true);
    expect(next.byId.c1.bills.find((b) => b.billId === 'net')!.isPaid).toBe(false);
  });

  it('completeCycle sets status/actualSaved/bufferContribution and clears the active cycle', () => {
    const state = stateWith([makeCycle({ id: 'c1', status: 'active' })], 'c1');

    const next = reducer(
      state,
      completeCycle.fulfilled(
        { cycleId: 'c1', actualSaved: 300, bufferContribution: 120, reflection: 'good cycle' },
        'req',
        { userId: 'u', cycleId: 'c1', actualSaved: 300, bufferContribution: 120 }
      )
    );

    expect(next.byId.c1.status).toBe('completed');
    expect(next.byId.c1.actualSaved).toBe(300);
    expect(next.byId.c1.bufferContribution).toBe(120);
    expect(next.byId.c1.reflection).toBe('good cycle');
    expect(next.activeCycleId).toBeNull();
  });

  it('setActiveCycleId sets the active cycle pointer', () => {
    const state = stateWith([makeCycle({ id: 'c1' }), makeCycle({ id: 'c2' })], 'c1');
    const next = reducer(state, setActiveCycleId('c2'));
    expect(next.activeCycleId).toBe('c2');
  });

  it('createBill/updateBill/deleteBill cycleUpdate payloads re-sync the active cycle totals', () => {
    let state = stateWith([makeCycle({ id: 'c1', bills: [], billsTotal: 0, spendingLimit: 1000, remainingToSpend: 1000 })], 'c1');

    const addedBills = [
      { billId: 'rent', billName: 'Rent', amount: 500, dueDate: ts(1500), isPaid: false, isDeferred: false },
    ];
    state = reducer(
      state,
      createBill.fulfilled(
        { id: 'rent', cycleUpdate: { cycleId: 'c1', updates: { bills: addedBills, billsTotal: 500, spendingLimit: 500, remainingToSpend: 500 } } } as never,
        'req',
        {} as never
      )
    );
    expect(state.byId.c1.billsTotal).toBe(500);
    expect(state.byId.c1.spendingLimit).toBe(500);
    expect(state.byId.c1.bills).toHaveLength(1);

    const bumpedBills = [{ ...addedBills[0], amount: 700 }];
    state = reducer(
      state,
      updateBill.fulfilled(
        { cycleUpdate: { cycleId: 'c1', updates: { bills: bumpedBills, billsTotal: 700, spendingLimit: 300, remainingToSpend: 300 } } } as never,
        'req',
        {} as never
      )
    );
    expect(state.byId.c1.billsTotal).toBe(700);
    expect(state.byId.c1.remainingToSpend).toBe(300);

    state = reducer(
      state,
      deleteBill.fulfilled(
        { cycleUpdate: { cycleId: 'c1', updates: { bills: [], billsTotal: 0, spendingLimit: 1000, remainingToSpend: 1000 } } } as never,
        'req',
        {} as never
      )
    );
    expect(state.byId.c1.bills).toHaveLength(0);
    expect(state.byId.c1.billsTotal).toBe(0);
    expect(state.byId.c1.spendingLimit).toBe(1000);
  });
});
