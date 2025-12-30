import { useState, ChangeEvent } from 'react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { Modal, Button, Input, Spinner } from '../../../components/shared';
import { addToBuffer } from '../bufferSlice';
import { formatCurrency } from '../../../utils';
import { PiggyBank } from 'lucide-react';

interface BufferDepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  cycleId?: string;
  suggestedAmount?: number;
  suggestedReason?: string;
}

export const BufferDepositModal = ({
  isOpen,
  onClose,
  cycleId,
  suggestedAmount,
  suggestedReason,
}: BufferDepositModalProps) => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { buffer } = useAppSelector((state) => state.buffer);

  const [amount, setAmount] = useState(suggestedAmount?.toString() || '');
  const [reason, setReason] = useState(suggestedReason || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const numericAmount = parseFloat(amount) || 0;
  const isValidAmount = numericAmount > 0;
  const isValidReason = reason.trim().length >= 3;

  const handleSubmit = async () => {
    if (!user || !isValidAmount || !isValidReason) return;

    setIsSubmitting(true);
    try {
      await dispatch(
        addToBuffer({
          userId: user.uid,
          amount: numericAmount,
          reason: reason.trim(),
          cycleId,
        })
      ).unwrap();
      handleClose();
    } catch (error) {
      console.error('Failed to add to buffer:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setAmount('');
    setReason('');
    onClose();
  };

  const currentBuffer = buffer?.totalAmount || 0;
  const newTotal = currentBuffer + numericAmount;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add to Buffer">
      <div className="space-y-6">
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
          <PiggyBank className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-green-800">
            <p className="font-medium mb-1">Building your safety net</p>
            <p>
              Adding funds to your buffer helps protect you from unexpected expenses
              and reduces financial stress.
            </p>
          </div>
        </div>

        <div>
          <p className="text-sm text-gray-600 mb-2">Current buffer balance</p>
          <p className="text-2xl font-bold text-green-600">
            {formatCurrency(currentBuffer)}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Amount to Add
          </label>
          <Input
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
            min="0"
            step="0.01"
          />
          {numericAmount > 0 && (
            <p className="text-green-600 text-sm mt-1">
              New buffer total: {formatCurrency(newTotal)}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Reason / Source
          </label>
          <Input
            placeholder="e.g., Leftover from cycle, Bonus, Tax refund..."
            value={reason}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setReason(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="secondary" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValidAmount || !isValidReason || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Adding...
              </>
            ) : (
              'Add to Buffer'
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
