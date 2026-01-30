import { useState, useMemo } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Receipt,
  AlertTriangle,
  CalendarCheck,
  RotateCcw,
  Zap,
} from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { createBill, updateBill, deleteBill } from '../billsSlice';
import { Card, CardHeader, Button, Input, Select, Modal } from '../../../components/shared';
import { Bill, BillFrequency } from '../../../types';

// Helper to get local date string (YYYY-MM-DD)
const getLocalDateString = (d: Date = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Frequencies that require a start date for proper calendar projection
const REQUIRES_START_DATE: BillFrequency[] = ['bi-weekly', 'quarterly', 'semi-annual', 'annual', 'one-time'];

const FREQUENCY_LABELS: Record<BillFrequency, string> = {
  monthly: 'Monthly',
  'bi-weekly': 'Bi-Weekly',
  quarterly: 'Quarterly',
  'semi-annual': 'Semi-Annual',
  annual: 'Annual',
  'one-time': 'One-Time',
};

export const BillsManager = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { byId, allIds } = useAppSelector((state) => state.bills);
  const { byId: paymentMethodsById, allIds: paymentMethodIds } = useAppSelector(
    (state) => state.paymentMethods
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [billToDelete, setBillToDelete] = useState<Bill | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formDueDay, setFormDueDay] = useState(1);
  const [formFrequency, setFormFrequency] = useState<BillFrequency>('monthly');
  const [formStartDate, setFormStartDate] = useState(''); // For quarterly/semi-annual/annual
  const [formIsVariable, setFormIsVariable] = useState(false);
  const [formIsAutoPay, setFormIsAutoPay] = useState(false);
  const [formPaymentMethodId, setFormPaymentMethodId] = useState<string>('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const bills = useMemo(() => {
    return allIds.map((id) => byId[id]).filter(Boolean);
  }, [allIds, byId]);

  const paymentMethodOptions = useMemo(() => {
    return [
      { value: '', label: 'None' },
      ...paymentMethodIds.map((id) => ({
        value: id,
        label: paymentMethodsById[id]?.name || 'Unknown',
      })),
    ];
  }, [paymentMethodIds, paymentMethodsById]);

  const dayOptions = Array.from({ length: 31 }, (_, i) => ({
    value: String(i + 1),
    label: `${i + 1}${getOrdinalSuffix(i + 1)}`,
  }));

  const handleAdd = () => {
    setEditingBill(null);
    setFormName('');
    setFormAmount('');
    setFormDueDay(1);
    setFormFrequency('monthly');
    setFormStartDate('');
    setFormIsVariable(false);
    setFormIsAutoPay(false);
    setFormPaymentMethodId('');
    setFormIsActive(true);
    setModalOpen(true);
  };

  const handleEdit = (bill: Bill) => {
    setEditingBill(bill);
    setFormName(bill.name);
    setFormAmount(String(bill.amount));
    setFormDueDay(bill.dueDay);
    setFormFrequency(bill.frequency);
    setFormStartDate(bill.startDate ? getLocalDateString(bill.startDate.toDate()) : '');
    setFormIsVariable(bill.isVariable);
    setFormIsAutoPay(bill.isAutoPay);
    setFormPaymentMethodId(bill.paymentMethodId || '');
    setFormIsActive(bill.isActive !== false); // Default to true for backwards compatibility
    setModalOpen(true);
  };

  const handleDeleteClick = (bill: Bill) => {
    setBillToDelete(bill);
    setDeleteConfirmOpen(true);
  };

  const handleSave = async () => {
    if (!user || !formName.trim()) return;

    setIsSaving(true);
    try {
      // Parse start date for quarterly/semi-annual/annual bills
      let startDate: Timestamp | undefined;
      if (REQUIRES_START_DATE.includes(formFrequency) && formStartDate) {
        const [year, month, day] = formStartDate.split('-').map(Number);
        startDate = Timestamp.fromDate(new Date(year, month - 1, day));
      }

      const billData = {
        name: formName.trim(),
        amount: parseFloat(formAmount) || 0,
        dueDay: formDueDay,
        frequency: formFrequency,
        ...(startDate && { startDate }),
        isVariable: formIsVariable,
        isAutoPay: formIsAutoPay,
        paymentMethodId: formPaymentMethodId || null,
        isActive: formIsActive,
      };

      if (editingBill) {
        await dispatch(
          updateBill({
            userId: user.uid,
            billId: editingBill.id,
            updates: billData,
          })
        ).unwrap();
      } else {
        await dispatch(
          createBill({
            userId: user.uid,
            bill: billData,
          })
        ).unwrap();
      }
      setModalOpen(false);
    } catch (error) {
      console.error('Failed to save bill:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!user || !billToDelete) return;

    setIsDeleting(true);
    try {
      await dispatch(
        deleteBill({
          userId: user.uid,
          billId: billToDelete.id,
        })
      ).unwrap();
      setDeleteConfirmOpen(false);
      setBillToDelete(null);
    } catch (error) {
      console.error('Failed to delete bill:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Card>
        <div className="flex items-center justify-between mb-4">
          <CardHeader title="Bills" subtitle="Track your recurring bills and due dates" />
          <Button onClick={handleAdd} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Bill
          </Button>
        </div>

        {bills.length === 0 ? (
          <div className="text-center py-8">
            <Receipt className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400 mb-4">No bills tracked yet.</p>
            <Button onClick={handleAdd}>Add Your First Bill</Button>
          </div>
        ) : (
          <div className="space-y-2">
            {bills.map((bill) => {
              const paymentMethod = bill.paymentMethodId
                ? paymentMethodsById[bill.paymentMethodId]
                : null;

              return (
                <div
                  key={bill.id}
                  className={`flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors ${
                    bill.isActive === false ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      bill.isActive === false
                        ? 'bg-gray-200 dark:bg-gray-600 text-gray-400 dark:text-gray-500'
                        : 'bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400'
                    }`}>
                      <Receipt className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-gray-100">{bill.name}</span>
                        {bill.isActive === false && (
                          <span
                            className="text-xs text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded"
                            title="Inactive - excluded from calendar and totals"
                          >
                            Inactive
                          </span>
                        )}
                        {bill.isAutoPay && (
                          <span
                            className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/50 px-1.5 py-0.5 rounded"
                            title="Auto-pay enabled"
                          >
                            <Zap className="w-3 h-3" />
                          </span>
                        )}
                        {bill.isVariable && (
                          <span
                            className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/50 px-1.5 py-0.5 rounded"
                            title="Variable amount"
                          >
                            <RotateCcw className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <CalendarCheck className="w-3 h-3" />
                          Due: {bill.dueDay}
                          {getOrdinalSuffix(bill.dueDay)}
                        </span>
                        <span>•</span>
                        <span>{FREQUENCY_LABELS[bill.frequency]}</span>
                        {paymentMethod && (
                          <>
                            <span>•</span>
                            <span>{paymentMethod.name}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      ${bill.amount.toFixed(2)}
                      {bill.isVariable && <span className="text-xs text-gray-400 dark:text-gray-500"> ~</span>}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEdit(bill)}
                        className="p-2 text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(bill)}
                        className="p-2 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {bills.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {bills.length} bill{bills.length !== 1 ? 's' : ''} tracked
              {bills.filter((b) => b.isActive === false).length > 0 && (
                <span className="ml-1 text-xs">
                  ({bills.filter((b) => b.isActive !== false).length} active)
                </span>
              )}
            </span>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Monthly Total: ${(
                bills.filter((b) => b.isActive !== false && b.frequency === 'monthly').reduce((sum, b) => sum + b.amount, 0) +
                bills.filter((b) => b.isActive !== false && b.frequency === 'bi-weekly').reduce((sum, b) => sum + b.amount * 2, 0)
              ).toFixed(2)}
            </span>
          </div>
        )}
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingBill ? 'Edit Bill' : 'Add Bill'}
        size="md"
      >
        <div className="space-y-4">
          <Input
            label="Bill Name"
            placeholder="e.g., Rent, Electric, Car Insurance"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={`Amount${formIsVariable ? ' (Estimated)' : ''}`}
              type="number"
              placeholder="0.00"
              value={formAmount}
              onChange={(e) => setFormAmount(e.target.value)}
            />
            <Select
              label="Due Day"
              value={String(formDueDay)}
              onChange={(e) => setFormDueDay(Number(e.target.value))}
              options={dayOptions}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Frequency"
              value={formFrequency}
              onChange={(e) => setFormFrequency(e.target.value as BillFrequency)}
              options={[
                { value: 'monthly', label: 'Monthly' },
                { value: 'bi-weekly', label: 'Bi-Weekly' },
                { value: 'quarterly', label: 'Quarterly' },
                { value: 'semi-annual', label: 'Semi-Annual' },
                { value: 'annual', label: 'Annual' },
                { value: 'one-time', label: 'One-Time' },
              ]}
            />
            <Select
              label="Paid With"
              value={formPaymentMethodId}
              onChange={(e) => setFormPaymentMethodId(e.target.value)}
              options={paymentMethodOptions}
            />
          </div>

          {/* Start date for non-monthly bills */}
          {REQUIRES_START_DATE.includes(formFrequency) && (
            <div>
              <Input
                label={formFrequency === 'one-time' ? 'Payment Date' : 'First Payment Date'}
                type="date"
                value={formStartDate}
                onChange={(e) => setFormStartDate(e.target.value)}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {formFrequency === 'one-time'
                  ? 'When is this payment due?'
                  : 'When is the first (or next) payment due? This helps show the bill on the correct dates in the calendar.'}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formIsVariable}
                onChange={(e) => setFormIsVariable(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Variable amount (confirm each cycle)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formIsAutoPay}
                onChange={(e) => setFormIsAutoPay(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Auto-pay enabled</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formIsActive}
                onChange={(e) => setFormIsActive(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600"
              />
              <div>
                <span className="text-sm text-gray-700 dark:text-gray-300">Active</span>
                <p className="text-xs text-gray-500 dark:text-gray-400">Uncheck to hide from calendar and cycle totals</p>
              </div>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} isLoading={isSaving} disabled={!formName.trim()}>
              {editingBill ? 'Save' : 'Add Bill'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        title="Delete Bill"
        size="sm"
      >
        <div className="space-y-4">
          {billToDelete && (
            <>
              <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/30 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0" />
                <p className="text-sm text-red-700 dark:text-red-300">
                  Are you sure you want to delete <strong>{billToDelete.name}</strong>?
                </p>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setDeleteConfirmOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmDelete}
                  isLoading={isDeleting}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Delete
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </>
  );
};

// Helper function for ordinal suffixes
function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
