import { useState, useEffect } from 'react';
import { Timestamp } from 'firebase/firestore';
import { Modal, Input, CurrencyInput, Button } from '../../../components/shared';

interface LoanFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (loan: {
    name: string;
    description?: string;
    initialAmount: number;
    remainingBalance: number;
    monthlyPayment: number;
    interestRate: number;
    payoffDate?: Timestamp;
  }) => Promise<void>;
  initialValues?: {
    name: string;
    description?: string;
    initialAmount: number;
    remainingBalance: number;
    monthlyPayment: number;
    interestRate: number;
    payoffDate?: Timestamp;
  };
  title?: string;
}

export const LoanFormModal = ({
  isOpen,
  onClose,
  onSubmit,
  initialValues,
  title = 'Add Loan',
}: LoanFormModalProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [initialAmount, setInitialAmount] = useState(0);
  const [remainingBalance, setRemainingBalance] = useState(0);
  const [monthlyPayment, setMonthlyPayment] = useState(0);
  const [interestRate, setInterestRate] = useState('');
  const [payoffDate, setPayoffDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && initialValues) {
      setName(initialValues.name);
      setDescription(initialValues.description || '');
      setInitialAmount(initialValues.initialAmount);
      setRemainingBalance(initialValues.remainingBalance);
      setMonthlyPayment(initialValues.monthlyPayment);
      setInterestRate(initialValues.interestRate.toString());
      if (initialValues.payoffDate) {
        const d = initialValues.payoffDate.toDate();
        setPayoffDate(d.toISOString().split('T')[0]);
      } else {
        setPayoffDate('');
      }
    } else if (isOpen) {
      setName('');
      setDescription('');
      setInitialAmount(0);
      setRemainingBalance(0);
      setMonthlyPayment(0);
      setInterestRate('');
      setPayoffDate('');
    }
  }, [isOpen, initialValues]);

  const handleSubmit = async () => {
    if (!name.trim() || remainingBalance <= 0 || monthlyPayment <= 0) return;

    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
        initialAmount: initialAmount || remainingBalance,
        remainingBalance,
        monthlyPayment,
        interestRate: parseFloat(interestRate) || 0,
        payoffDate: payoffDate
          ? Timestamp.fromDate(new Date(payoffDate + 'T00:00:00'))
          : undefined,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const isValid = name.trim() && remainingBalance > 0 && monthlyPayment > 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="lg">
      <div className="space-y-4">
        <Input
          label="Loan Name"
          placeholder="e.g. Car Loan, Student Loan"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <Input
          label="Description (optional)"
          placeholder="Any notes about this loan"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CurrencyInput
            label="Initial Loan Amount"
            value={initialAmount}
            onChange={setInitialAmount}
            placeholder="0.00"
          />

          <CurrencyInput
            label="Remaining Balance"
            value={remainingBalance}
            onChange={setRemainingBalance}
            placeholder="0.00"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CurrencyInput
            label="Monthly Payment"
            value={monthlyPayment}
            onChange={setMonthlyPayment}
            placeholder="0.00"
          />

          <div className="w-full">
            <label
              htmlFor="interest-rate"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Interest Rate (APR %)
            </label>
            <div className="relative">
              <input
                id="interest-rate"
                type="text"
                inputMode="decimal"
                value={interestRate}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9.]/g, '');
                  setInterestRate(val);
                }}
                placeholder="0.00"
                className="w-full px-3 pr-8 py-2.5 md:py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-gray-100"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 text-sm">
                %
              </span>
            </div>
          </div>
        </div>

        <Input
          label="Expected Payoff Date (optional)"
          type="date"
          value={payoffDate}
          onChange={(e) => setPayoffDate(e.target.value)}
        />

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
            {initialValues ? 'Save Changes' : 'Add Loan'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
