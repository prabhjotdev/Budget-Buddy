import { useState, ChangeEvent } from 'react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { Modal, Button, Input, Spinner } from '../../../components/shared';
import { withdrawFromBuffer } from '../bufferSlice';
import { formatCurrency } from '../../../utils';
import { AlertTriangle } from 'lucide-react';

interface BufferWithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  maxAmount: number;
  cycleId?: string;
}

export const BufferWithdrawModal = ({
  isOpen,
  onClose,
  maxAmount,
  cycleId,
}: BufferWithdrawModalProps) => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);

  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmStep, setConfirmStep] = useState(false);

  const numericAmount = parseFloat(amount) || 0;
  const isValidAmount = numericAmount > 0 && numericAmount <= maxAmount;
  const isValidReason = reason.trim().length >= 3;

  const handleSubmit = async () => {
    if (!user || !isValidAmount || !isValidReason) return;

    if (!confirmStep) {
      setConfirmStep(true);
      return;
    }

    setIsSubmitting(true);
    try {
      await dispatch(
        withdrawFromBuffer({
          userId: user.uid,
          amount: numericAmount,
          reason: reason.trim(),
          cycleId,
        })
      ).unwrap();
      handleClose();
    } catch (error) {
      console.error('Failed to withdraw from buffer:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setAmount('');
    setReason('');
    setConfirmStep(false);
    onClose();
  };

  const handleBack = () => {
    setConfirmStep(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Emergency Buffer Withdrawal">
      {!confirmStep ? (
        <div className="space-y-6">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-medium mb-1">Use only for true emergencies</p>
              <p>
                Your buffer is meant for unexpected essential expenses like car repairs,
                medical bills, or urgent home fixes—not regular spending.
              </p>
            </div>
          </div>

          <div>
            <p className="text-sm text-gray-600 mb-2">Available in buffer</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(maxAmount)}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Withdrawal Amount
            </label>
            <Input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
              min="0"
              max={maxAmount}
              step="0.01"
            />
            {numericAmount > maxAmount && (
              <p className="text-red-500 text-sm mt-1">
                Amount exceeds available buffer
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason for Withdrawal
            </label>
            <Input
              placeholder="e.g., Car repair, Medical expense..."
              value={reason}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setReason(e.target.value)}
            />
            <p className="text-gray-500 text-xs mt-1">
              Be specific—this helps you reflect on your spending patterns later.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleSubmit}
              disabled={!isValidAmount || !isValidReason}
            >
              Continue
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <h4 className="font-medium text-red-900 mb-2">Confirm Withdrawal</h4>
            <p className="text-red-800 text-sm">
              You are about to withdraw{' '}
              <span className="font-bold">{formatCurrency(numericAmount)}</span> from
              your emergency buffer.
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Amount</span>
              <span className="font-medium">{formatCurrency(numericAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Reason</span>
              <span className="font-medium">{reason}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-gray-200">
              <span className="text-gray-600">Buffer after withdrawal</span>
              <span className="font-bold text-amber-600">
                {formatCurrency(maxAmount - numericAmount)}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={handleBack} disabled={isSubmitting}>
              Back
            </Button>
            <Button variant="danger" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Processing...
                </>
              ) : (
                'Confirm Withdrawal'
              )}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
