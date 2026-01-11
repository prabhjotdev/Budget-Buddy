import { useState } from 'react';
import { Check, Clock, Receipt, ChevronRight, ChevronDown } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { markCycleBillPaid } from '../paycheckCyclesSlice';
import { Card, CardHeader, Button, Modal } from '../../../components/shared';
import { formatCurrency } from '../../../utils/currency';
import { CycleBillEntry } from '../../../types';

interface CycleBillsListProps {
  bills: CycleBillEntry[];
}

const MAX_VISIBLE_BILLS = 4;

export const CycleBillsList = ({ bills }: CycleBillsListProps) => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { activeCycleId } = useAppSelector((state) => state.paycheckCycles);

  const [selectedBill, setSelectedBill] = useState<CycleBillEntry | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const paidBills = bills.filter((b) => b.isPaid);
  const unpaidBills = bills.filter((b) => !b.isPaid);

  // Show unpaid first, then paid
  const sortedBills = [...unpaidBills, ...paidBills];
  const visibleBills = isExpanded ? sortedBills : sortedBills.slice(0, MAX_VISIBLE_BILLS);
  const hasMoreBills = bills.length > MAX_VISIBLE_BILLS;

  const handleMarkPaid = async (bill: CycleBillEntry) => {
    if (!user || !activeCycleId) return;

    setIsUpdating(true);
    try {
      await dispatch(
        markCycleBillPaid({
          userId: user.uid,
          cycleId: activeCycleId,
          billId: bill.billId,
          isPaid: true,
        })
      ).unwrap();
      setSelectedBill(null);
    } catch (error) {
      console.error('Failed to mark bill as paid:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const totalAmount = bills.reduce((sum, b) => sum + b.amount, 0);
  const paidAmount = paidBills.reduce((sum, b) => sum + b.amount, 0);

  return (
    <>
      <Card>
        <CardHeader
          title="Bills This Cycle"
          subtitle={`${paidBills.length}/${bills.length} paid`}
          action={
            hasMoreBills ? (
              <Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)}>
                {isExpanded ? 'Show Less' : `View All (${bills.length})`}
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 ml-1 rotate-180" />
                ) : (
                  <ChevronRight className="w-4 h-4 ml-1" />
                )}
              </Button>
            ) : null
          }
        />

        {bills.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <Receipt className="w-10 h-10 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
            <p>No bills for this cycle</p>
          </div>
        ) : (
          <div className="space-y-2">
            {visibleBills.map((bill) => (
              <div
                key={bill.billId}
                onClick={() => !bill.isPaid && setSelectedBill(bill)}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  bill.isPaid
                    ? 'bg-green-50 dark:bg-green-900/30 opacity-75'
                    : 'bg-amber-50 dark:bg-amber-900/30 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/50'
                } transition-colors`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    bill.isPaid ? 'bg-green-100 dark:bg-green-800/50' : 'bg-amber-100 dark:bg-amber-800/50'
                  }`}>
                    {bill.isPaid ? (
                      <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                    ) : (
                      <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    )}
                  </div>
                  <div>
                    <span className={`font-medium ${bill.isPaid ? 'text-gray-700 dark:text-gray-400 line-through' : 'text-gray-900 dark:text-gray-100'}`}>
                      {bill.billName}
                    </span>
                    {bill.isDeferred && (
                      <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">(Deferred)</span>
                    )}
                    <p className={`text-xs ${bill.isPaid ? 'text-gray-400 dark:text-gray-500' : 'text-gray-500 dark:text-gray-400'}`}>
                      Due: {bill.dueDate.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`font-semibold ${bill.isPaid ? 'text-gray-500 dark:text-gray-400 line-through' : 'text-gray-900 dark:text-gray-100'}`}>
                    {formatCurrency(bill.amount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary */}
        {bills.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Paid: {formatCurrency(paidAmount)} / {formatCurrency(totalAmount)}
            </span>
            <div className="h-2 w-24 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 dark:bg-green-400 transition-all"
                style={{ width: `${(paidAmount / totalAmount) * 100}%` }}
              />
            </div>
          </div>
        )}
      </Card>

      {/* Mark as Paid Modal */}
      <Modal
        isOpen={!!selectedBill}
        onClose={() => setSelectedBill(null)}
        title="Mark Bill as Paid"
        size="sm"
      >
        {selectedBill && (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{selectedBill.billName}</span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Due: {selectedBill.dueDate.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
                <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  {formatCurrency(selectedBill.amount)}
                </span>
              </div>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400">
              Mark this bill as paid? This helps track your progress through the cycle.
            </p>

            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setSelectedBill(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => handleMarkPaid(selectedBill)}
                isLoading={isUpdating}
                className="flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                Mark as Paid
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};
