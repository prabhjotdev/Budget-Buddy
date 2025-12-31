import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { Modal, Button, Spinner } from '../../../components/shared';
import { markCycleBillPaid } from '../paycheckCyclesSlice';
import { formatCurrency } from '../../../utils';
import { CycleBillEntry } from '../../../types';
import { CheckCircle, Circle, Calendar } from 'lucide-react';

interface MarkBillPaidModalProps {
  isOpen: boolean;
  onClose: () => void;
  cycleId: string;
  bills: CycleBillEntry[];
}

export const MarkBillPaidModal = ({
  isOpen,
  onClose,
  cycleId,
  bills,
}: MarkBillPaidModalProps) => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const [loadingBillId, setLoadingBillId] = useState<string | null>(null);

  const handleTogglePaid = async (billId: string, currentlyPaid: boolean) => {
    if (!user) return;

    setLoadingBillId(billId);
    try {
      await dispatch(
        markCycleBillPaid({
          userId: user.uid,
          cycleId,
          billId,
          isPaid: !currentlyPaid,
        })
      ).unwrap();
    } catch (error) {
      console.error('Failed to update bill status:', error);
    } finally {
      setLoadingBillId(null);
    }
  };

  const unpaidBills = bills.filter((b) => !b.isPaid);
  const paidBills = bills.filter((b) => b.isPaid);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Mark Bills Paid">
      <div className="space-y-6">
        {bills.length === 0 ? (
          <p className="text-gray-500 text-center py-6">
            No bills scheduled for this cycle.
          </p>
        ) : (
          <>
            {/* Unpaid Bills */}
            {unpaidBills.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">
                  Unpaid ({unpaidBills.length})
                </h4>
                <div className="space-y-2">
                  {unpaidBills.map((bill) => (
                    <button
                      key={bill.billId}
                      onClick={() => handleTogglePaid(bill.billId, bill.isPaid)}
                      disabled={loadingBillId === bill.billId}
                      className="w-full flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-50"
                    >
                      <div className="flex items-center gap-3">
                        {loadingBillId === bill.billId ? (
                          <Spinner size="sm" />
                        ) : (
                          <Circle className="w-5 h-5 text-amber-500" />
                        )}
                        <div className="text-left">
                          <p className="font-medium text-gray-900">{bill.billName}</p>
                          <p className="text-sm text-gray-500 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Due {bill.dueDate.toDate().toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </p>
                        </div>
                      </div>
                      <span className="font-semibold text-gray-900">
                        {formatCurrency(bill.amount)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Paid Bills */}
            {paidBills.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">
                  Paid ({paidBills.length})
                </h4>
                <div className="space-y-2">
                  {paidBills.map((bill) => (
                    <button
                      key={bill.billId}
                      onClick={() => handleTogglePaid(bill.billId, bill.isPaid)}
                      disabled={loadingBillId === bill.billId}
                      className="w-full flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50"
                    >
                      <div className="flex items-center gap-3">
                        {loadingBillId === bill.billId ? (
                          <Spinner size="sm" />
                        ) : (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        )}
                        <div className="text-left">
                          <p className="font-medium text-gray-900">{bill.billName}</p>
                          <p className="text-sm text-green-600">Paid</p>
                        </div>
                      </div>
                      <span className="font-semibold text-gray-900">
                        {formatCurrency(bill.amount)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <div className="flex justify-end pt-4">
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </Modal>
  );
};
