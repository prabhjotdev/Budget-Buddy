import { useState } from 'react';
import { Check, Clock, Receipt, ChevronRight } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { markCycleBillPaid } from '../paycheckCyclesSlice';
import { Card, CardHeader, Button, Modal } from '../../../components/shared';
import { formatCurrency } from '../../../utils/currency';
import { CycleBillEntry } from '../../../types';

interface CycleBillsListProps {
  bills: CycleBillEntry[];
}

export const CycleBillsList = ({ bills }: CycleBillsListProps) => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { activeCycleId } = useAppSelector((state) => state.paycheckCycles);

  const [selectedBill, setSelectedBill] = useState<CycleBillEntry | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const paidBills = bills.filter((b) => b.isPaid);
  const unpaidBills = bills.filter((b) => !b.isPaid);

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
            <Button variant="ghost" size="sm">
              View All
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          }
        />

        {bills.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Receipt className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p>No bills for this cycle</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Unpaid Bills First */}
            {unpaidBills.map((bill) => (
              <div
                key={bill.billId}
                onClick={() => setSelectedBill(bill)}
                className="flex items-center justify-between p-3 bg-amber-50 rounded-lg cursor-pointer hover:bg-amber-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                    <Clock className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <span className="font-medium text-gray-900">{bill.billName}</span>
                    {bill.isDeferred && (
                      <span className="ml-2 text-xs text-gray-500">(Deferred)</span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(bill.amount)}
                  </span>
                </div>
              </div>
            ))}

            {/* Paid Bills */}
            {paidBills.map((bill) => (
              <div
                key={bill.billId}
                className="flex items-center justify-between p-3 bg-green-50 rounded-lg opacity-75"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-green-600" />
                  </div>
                  <span className="font-medium text-gray-700 line-through">
                    {bill.billName}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-semibold text-gray-500 line-through">
                    {formatCurrency(bill.amount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary */}
        {bills.length > 0 && (
          <div className="mt-4 pt-4 border-t flex justify-between items-center">
            <span className="text-sm text-gray-500">
              Paid: {formatCurrency(paidAmount)} / {formatCurrency(totalAmount)}
            </span>
            <div className="h-2 w-24 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all"
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
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="font-medium text-gray-900">{selectedBill.billName}</span>
                <span className="text-lg font-bold text-gray-900">
                  {formatCurrency(selectedBill.amount)}
                </span>
              </div>
            </div>

            <p className="text-sm text-gray-600">
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
