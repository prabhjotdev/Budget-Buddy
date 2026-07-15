import { useState, useEffect, ChangeEvent } from 'react';
import { Shield, PiggyBank, Wallet } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { Modal, Button, Input, Spinner } from '../../../components/shared';
import { withdrawFromBuffer } from '../bufferSlice';
import { addWithdrawal } from '../../emergencyFund/emergencyFundSlice';
import { updatePaycheckCycle } from '../paycheckCyclesSlice';
import { formatCurrency } from '../../../utils/currency';

type FundSource = 'buffer' | 'emergencyFund';

interface AddToCycleSpendingModalProps {
  isOpen: boolean;
  onClose: () => void;
  cycleId: string;
  bufferBalance: number;
  emergencyFundBalance: number;
}

const DEFAULT_NOTE = 'Added to cycle spending balance';

export const AddToCycleSpendingModal = ({
  isOpen,
  onClose,
  cycleId,
  bufferBalance,
  emergencyFundBalance,
}: AddToCycleSpendingModalProps) => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const cycle = useAppSelector((state) => state.paycheckCycles.byId[cycleId]);

  // Prefer the buffer if it has funds, otherwise fall back to the emergency fund.
  const defaultSource: FundSource = bufferBalance > 0 ? 'buffer' : 'emergencyFund';

  const [source, setSource] = useState<FundSource>(defaultSource);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the form whenever the modal opens.
  useEffect(() => {
    if (isOpen) {
      setSource(bufferBalance > 0 ? 'buffer' : 'emergencyFund');
      setAmount('');
      setNote('');
      setError(null);
    }
  }, [isOpen, bufferBalance]);

  const sourceBalance = source === 'buffer' ? bufferBalance : emergencyFundBalance;
  const numericAmount = parseFloat(amount) || 0;
  const isValidAmount = numericAmount > 0 && numericAmount <= sourceBalance;

  const newRemaining = (cycle?.remainingToSpend || 0) + numericAmount;

  const handleSelectSource = (next: FundSource) => {
    setSource(next);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!user || !cycle || !isValidAmount) return;

    setIsSubmitting(true);
    setError(null);

    const description = note.trim() || DEFAULT_NOTE;

    try {
      // 1. Reduce the chosen source pool.
      if (source === 'buffer') {
        await dispatch(
          withdrawFromBuffer({
            userId: user.uid,
            amount: numericAmount,
            reason: description,
            cycleId,
          })
        ).unwrap();
      } else {
        await dispatch(
          addWithdrawal({
            userId: user.uid,
            amount: numericAmount,
            description,
            date: Timestamp.now(),
          })
        ).unwrap();
      }

      // 2. Add the funds to the cycle's spendable balance.
      const drawUpdate =
        source === 'buffer'
          ? { bufferDraw: (cycle.bufferDraw || 0) + numericAmount }
          : { emergencyFundDraw: (cycle.emergencyFundDraw || 0) + numericAmount };

      await dispatch(
        updatePaycheckCycle({
          userId: user.uid,
          cycleId,
          updates: {
            spendingLimit: cycle.spendingLimit + numericAmount,
            remainingToSpend: cycle.remainingToSpend + numericAmount,
            ...drawUpdate,
          },
        })
      ).unwrap();

      onClose();
    } catch (err) {
      console.error('Failed to add funds to cycle spending:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const sources: {
    id: FundSource;
    name: string;
    balance: number;
    icon: typeof Shield;
  }[] = [
    { id: 'buffer', name: 'Emergency Buffer', balance: bufferBalance, icon: Shield },
    { id: 'emergencyFund', name: 'Emergency Fund', balance: emergencyFundBalance, icon: PiggyBank },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add to Cycle Spending">
      <div className="space-y-6">
        <div className="p-4 bg-teal-50 dark:bg-teal-900/30 border border-teal-200 dark:border-teal-800 rounded-lg flex items-start gap-3">
          <Wallet className="w-5 h-5 text-teal-600 dark:text-teal-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-teal-800 dark:text-teal-200">
            Move money from a savings pool into this cycle so you have a little more to spend.
            This increases your remaining spending balance—it isn&apos;t logged as an expense.
          </p>
        </div>

        {/* Source selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Take from
          </label>
          <div className="grid grid-cols-2 gap-3">
            {sources.map(({ id, name, balance, icon: Icon }) => {
              const disabled = balance <= 0;
              const selected = source === id;
              return (
                <button
                  key={id}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleSelectSource(id)}
                  className={`text-left p-3 rounded-lg border-2 transition-colors ${
                    selected
                      ? 'border-teal-500 dark:border-teal-400 bg-teal-50 dark:bg-teal-900/30'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Icon
                    className={`w-5 h-5 mb-1 ${
                      selected ? 'text-teal-600 dark:text-teal-400' : 'text-gray-400'
                    }`}
                  />
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatCurrency(balance)} available
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Amount
          </label>
          <Input
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
            min="0"
            max={sourceBalance}
            step="0.01"
          />
          {numericAmount > sourceBalance && (
            <p className="text-red-500 text-sm mt-1">Amount exceeds available balance</p>
          )}
        </div>

        {/* Optional note */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Note (optional)
          </label>
          <Input
            placeholder={DEFAULT_NOTE}
            value={note}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setNote(e.target.value)}
          />
        </div>

        {/* Preview */}
        {isValidAmount && cycle && (
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 flex justify-between">
            <span className="text-gray-600 dark:text-gray-300">New spendable balance</span>
            <span className="font-bold text-green-600 dark:text-green-400">
              {formatCurrency(newRemaining)}
            </span>
          </div>
        )}

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isValidAmount || isSubmitting}>
            {isSubmitting ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Processing...
              </>
            ) : (
              'Add to Spending'
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
