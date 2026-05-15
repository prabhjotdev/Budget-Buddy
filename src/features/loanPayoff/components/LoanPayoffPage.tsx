import { useEffect, useState, useMemo } from 'react';
import { Timestamp } from 'firebase/firestore';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { AppLayout } from '../../../components/layout';
import { Card, Button, Spinner, CurrencyInput } from '../../../components/shared';
import {
  fetchLoans,
  createLoan,
  updateLoan,
  deleteLoan,
  applyDuePayments,
} from '../loanPayoffSlice';
import { calculateSnowball, LoanInput } from '../snowballCalculator';
import { LoanFormModal } from './LoanFormModal';
import { formatCurrency } from '../../../utils';
import { Loan } from '../../../types/loanPayoff';
import {
  Landmark,
  Plus,
  Pencil,
  Trash2,
  TrendingDown,
  Zap,
  Clock,
  DollarSign,
  ChevronDown,
  ChevronUp,
  ArrowRight,
} from 'lucide-react';

const formatMonths = (months: number): string => {
  if (months >= 600) return 'Never (payment too low)';
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (years === 0) return `${remainingMonths} mo`;
  if (remainingMonths === 0) return `${years} yr`;
  return `${years} yr ${remainingMonths} mo`;
};

export const LoanPayoffPage = () => {
  return (
    <AppLayout title="Loan Payoff">
      <LoanPayoffContent />
    </AppLayout>
  );
};

const LoanPayoffContent = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { loans, status } = useAppSelector((state) => state.loanPayoff);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editLoan, setEditLoan] = useState<Loan | null>(null);
  const [extraPayment, setExtraPayment] = useState(0);
  const [showSimulation, setShowSimulation] = useState(false);

  useEffect(() => {
    if (user) {
      dispatch(fetchLoans(user.uid)).then((action) => {
        if (fetchLoans.fulfilled.match(action)) {
          dispatch(applyDuePayments({ userId: user.uid, loans: action.payload }));
        }
      });
    }
  }, [dispatch, user]);

  const loanList = useMemo(() => {
    return loans.allIds.map((id) => loans.byId[id]).filter(Boolean);
  }, [loans]);

  const totalDebt = useMemo(() => {
    return loanList.reduce((sum, loan) => sum + loan.remainingBalance, 0);
  }, [loanList]);

  const totalMonthlyPayments = useMemo(() => {
    return loanList.reduce((sum, loan) => sum + loan.monthlyPayment, 0);
  }, [loanList]);

  const snowballInputs: LoanInput[] = useMemo(() => {
    return loanList.map((loan) => ({
      id: loan.id,
      name: loan.name,
      remainingBalance: loan.remainingBalance,
      monthlyPayment: loan.monthlyPayment,
      interestRate: loan.interestRate,
    }));
  }, [loanList]);

  const snowballResult = useMemo(() => {
    if (snowballInputs.length === 0) return null;
    return calculateSnowball(snowballInputs, extraPayment);
  }, [snowballInputs, extraPayment]);

  const handleCreateLoan = async (loan: {
    name: string;
    description?: string;
    initialAmount: number;
    remainingBalance: number;
    monthlyPayment: number;
    interestRate: number;
    payoffDate?: Timestamp;
  }) => {
    if (!user) return;
    await dispatch(createLoan({ userId: user.uid, loan })).unwrap();
  };

  const handleUpdateLoan = async (loan: {
    name: string;
    description?: string;
    initialAmount: number;
    remainingBalance: number;
    monthlyPayment: number;
    interestRate: number;
    payoffDate?: Timestamp;
  }) => {
    if (!user || !editLoan) return;
    await dispatch(
      updateLoan({ userId: user.uid, loanId: editLoan.id, updates: loan })
    ).unwrap();
  };

  const handleDeleteLoan = async (loanId: string) => {
    if (!user) return;
    if (confirm('Are you sure you want to delete this loan?')) {
      await dispatch(deleteLoan({ userId: user.uid, loanId })).unwrap();
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex justify-center items-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Landmark className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            <div>
              <h3 className="font-semibold text-amber-900 dark:text-amber-100">
                Loan Payoff Calculator
              </h3>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                {loanList.length === 0
                  ? 'Add your loans to simulate the snowball method'
                  : `${loanList.length} loan${loanList.length !== 1 ? 's' : ''} \u00b7 ${formatCurrency(totalDebt)} total debt`}
              </p>
            </div>
          </div>
          <Button onClick={() => setCreateModalOpen(true)} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Loan
          </Button>
        </div>
      </div>

      {/* Loan Cards */}
      {loanList.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <Landmark className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No loans added yet
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4 max-w-sm mx-auto">
              Add your loans to see how the debt snowball method can help you pay them off faster.
            </p>
            <Button
              onClick={() => setCreateModalOpen(true)}
              className="inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Your First Loan
            </Button>
          </div>
        </Card>
      ) : (
        <>
          {/* Loan List */}
          <div className="space-y-3">
            {loanList.map((loan) => (
              <Card key={loan.id}>
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-lg">
                        <Landmark className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                          {loan.name}
                        </h4>
                        {loan.description && (
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {loan.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditLoan(loan)}
                        className="p-1.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                        title="Edit loan"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteLoan(loan.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        title="Delete loan"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Remaining</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {formatCurrency(loan.remainingBalance)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Monthly Payment</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {formatCurrency(loan.monthlyPayment)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Interest Rate</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {loan.interestRate}% APR
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Initial Amount</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {formatCurrency(loan.initialAmount)}
                      </p>
                    </div>
                  </div>

                  {/* Progress toward payoff */}
                  {loan.initialAmount > 0 && (
                    <div className="mt-3">
                      <div className="relative h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500 rounded-full"
                          style={{
                            width: `${Math.min(
                              ((loan.initialAmount - loan.remainingBalance) /
                                loan.initialAmount) *
                                100,
                              100
                            )}%`,
                          }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {(
                          ((loan.initialAmount - loan.remainingBalance) /
                            loan.initialAmount) *
                          100
                        ).toFixed(0)}
                        % paid off
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>

          {/* Snowball Simulator */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <button
              onClick={() => setShowSimulation(!showSimulation)}
              className="flex items-center gap-2 w-full"
            >
              <Zap className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Snowball Simulator
              </h3>
              {showSimulation ? (
                <ChevronUp className="w-5 h-5 text-gray-400 ml-auto" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400 ml-auto" />
              )}
            </button>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4">
              See how extra payments accelerate your debt payoff using the snowball method (smallest balance first).
            </p>

            {showSimulation && (
              <div className="space-y-4">
                {/* Extra Payment Input */}
                <Card>
                  <div className="p-4">
                    <div className="max-w-xs">
                      <CurrencyInput
                        label="Extra Monthly Payment"
                        value={extraPayment}
                        onChange={setExtraPayment}
                        placeholder="0.00"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Amount on top of your {formatCurrency(totalMonthlyPayments)}/mo minimum payments
                      </p>
                    </div>
                  </div>
                </Card>

                {/* Results */}
                {snowballResult && (
                  <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <Card>
                        <div className="p-4 text-center">
                          <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mx-auto mb-1" />
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Debt-Free Timeline
                          </p>
                          <div className="flex items-center justify-center gap-2 mt-1">
                            <span className="text-sm text-gray-500 line-through">
                              {formatMonths(snowballResult.originalTotalMonths)}
                            </span>
                            <ArrowRight className="w-3 h-3 text-gray-400" />
                            <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                              {formatMonths(snowballResult.snowballTotalMonths)}
                            </span>
                          </div>
                          {snowballResult.totalMonthsSaved > 0 && (
                            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                              {snowballResult.totalMonthsSaved} months faster
                            </p>
                          )}
                        </div>
                      </Card>

                      <Card>
                        <div className="p-4 text-center">
                          <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400 mx-auto mb-1" />
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Interest Saved
                          </p>
                          <p className="text-lg font-bold text-green-600 dark:text-green-400 mt-1">
                            {formatCurrency(snowballResult.totalInterestSaved)}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            of {formatCurrency(snowballResult.originalTotalInterest)} total interest
                          </p>
                        </div>
                      </Card>

                      <Card>
                        <div className="p-4 text-center">
                          <TrendingDown className="w-5 h-5 text-amber-600 dark:text-amber-400 mx-auto mb-1" />
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Total Monthly
                          </p>
                          <p className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-1">
                            {formatCurrency(totalMonthlyPayments + extraPayment)}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {formatCurrency(totalMonthlyPayments)} min + {formatCurrency(extraPayment)} extra
                          </p>
                        </div>
                      </Card>
                    </div>

                    {/* Per-Loan Breakdown */}
                    <Card>
                      <div className="p-4">
                        <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">
                          Snowball Payoff Order
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                          Sorted by balance (smallest first). When a loan is paid off, its payment rolls into the next one.
                        </p>
                        <div className="space-y-3">
                          {snowballResult.loanResults
                            .slice()
                            .sort((a, b) => a.remainingBalance - b.remainingBalance)
                            .map((result, index) => (
                              <div
                                key={result.id}
                                className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                              >
                                <div className="flex items-center gap-2 min-w-0 md:w-1/4">
                                  <span className="flex-shrink-0 w-6 h-6 bg-amber-100 dark:bg-amber-900/50 rounded-full flex items-center justify-center text-xs font-bold text-amber-700 dark:text-amber-300">
                                    {index + 1}
                                  </span>
                                  <div className="min-w-0">
                                    <p className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                                      {result.name}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                      {formatCurrency(result.remainingBalance)} @ {formatCurrency(result.monthlyPayment)}/mo
                                    </p>
                                  </div>
                                </div>

                                <div className="flex-1 grid grid-cols-3 gap-2 text-center">
                                  <div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Original</p>
                                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                      {formatMonths(result.originalPayoffMonths)}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Snowball</p>
                                    <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                                      {formatMonths(result.snowballPayoffMonths)}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Saved</p>
                                    <p className="text-sm font-medium text-green-600 dark:text-green-400">
                                      {result.monthsSaved > 0
                                        ? `${result.monthsSaved} mo`
                                        : '-'}
                                    </p>
                                  </div>
                                </div>

                                {result.interestSaved > 0 && (
                                  <div className="text-right md:w-1/6">
                                    <p className="text-xs text-green-600 dark:text-green-400">
                                      Save {formatCurrency(result.interestSaved)}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                      in interest
                                    </p>
                                  </div>
                                )}
                              </div>
                            ))}
                        </div>
                      </div>
                    </Card>
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Modals */}
      <LoanFormModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSubmit={handleCreateLoan}
      />

      {editLoan && (
        <LoanFormModal
          isOpen={!!editLoan}
          onClose={() => setEditLoan(null)}
          onSubmit={handleUpdateLoan}
          title="Edit Loan"
          initialValues={{
            name: editLoan.name,
            description: editLoan.description,
            initialAmount: editLoan.initialAmount,
            remainingBalance: editLoan.remainingBalance,
            monthlyPayment: editLoan.monthlyPayment,
            interestRate: editLoan.interestRate,
            payoffDate: editLoan.payoffDate,
          }}
        />
      )}
    </div>
  );
};
