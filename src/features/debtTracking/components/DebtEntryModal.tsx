import { useState, useEffect } from 'react';
import { Timestamp } from 'firebase/firestore';
import { Modal, Input, CurrencyInput, Button } from '../../../components/shared';
import { DebtEntry } from '../../../types/debtTracking';

interface DebtEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (entry: {
    direction: 'i-owe' | 'they-owe';
    personName: string;
    item: string;
    description?: string;
    amount: number;
    date: Timestamp;
    isPaid: boolean;
  }) => Promise<void>;
  initialValues?: Pick<
    DebtEntry,
    'direction' | 'personName' | 'item' | 'description' | 'amount' | 'date'
  >;
  title?: string;
}

export const DebtEntryModal = ({
  isOpen,
  onClose,
  onSubmit,
  initialValues,
  title = 'Add Debt',
}: DebtEntryModalProps) => {
  const [direction, setDirection] = useState<'i-owe' | 'they-owe'>('i-owe');
  const [personName, setPersonName] = useState('');
  const [item, setItem] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && initialValues) {
      setDirection(initialValues.direction);
      setPersonName(initialValues.personName);
      setItem(initialValues.item);
      setDescription(initialValues.description || '');
      setAmount(initialValues.amount);
      setDate(initialValues.date.toDate().toISOString().split('T')[0]);
    } else if (isOpen) {
      setDirection('i-owe');
      setPersonName('');
      setItem('');
      setDescription('');
      setAmount(0);
      setDate(new Date().toISOString().split('T')[0]);
    }
  }, [isOpen, initialValues]);

  const handleSubmit = async () => {
    if (!personName.trim() || !item.trim() || amount <= 0 || !date) return;

    setSubmitting(true);
    try {
      await onSubmit({
        direction,
        personName: personName.trim(),
        item: item.trim(),
        description: description.trim() || undefined,
        amount,
        date: Timestamp.fromDate(new Date(date + 'T00:00:00')),
        isPaid: false,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const isValid = personName.trim() && item.trim() && amount > 0 && date;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="lg">
      <div className="space-y-4">
        {/* Direction toggle */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Type
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDirection('i-owe')}
              className={`py-2.5 px-4 rounded-lg text-sm font-medium border transition-colors ${
                direction === 'i-owe'
                  ? 'bg-orange-50 border-orange-300 text-orange-700 dark:bg-orange-900/30 dark:border-orange-600 dark:text-orange-300'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700'
              }`}
            >
              I Owe
            </button>
            <button
              type="button"
              onClick={() => setDirection('they-owe')}
              className={`py-2.5 px-4 rounded-lg text-sm font-medium border transition-colors ${
                direction === 'they-owe'
                  ? 'bg-green-50 border-green-300 text-green-700 dark:bg-green-900/30 dark:border-green-600 dark:text-green-300'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700'
              }`}
            >
              Owed to Me
            </button>
          </div>
        </div>

        <Input
          label="Person's Name"
          placeholder={direction === 'i-owe' ? 'Who do you owe?' : 'Who owes you?'}
          value={personName}
          onChange={(e) => setPersonName(e.target.value)}
        />

        <Input
          label="Item"
          placeholder="e.g. Dinner, Rent split, Concert tickets"
          value={item}
          onChange={(e) => setItem(e.target.value)}
        />

        <Input
          label="Description (optional)"
          placeholder="Any extra details"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CurrencyInput
            label="Amount"
            value={amount}
            onChange={setAmount}
            placeholder="0.00"
          />

          <Input
            label="Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid}
            isLoading={submitting}
            className="flex-1"
          >
            {initialValues ? 'Save Changes' : 'Add Debt'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
