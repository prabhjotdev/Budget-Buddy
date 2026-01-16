import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { AppLayout } from '../../../components/layout';
import { Card, CardHeader, Button, Spinner } from '../../../components/shared';
import { fetchBuffer, fetchBufferTransactions, initializeBuffer } from '../bufferSlice';
import { BufferWithdrawModal } from './BufferWithdrawModal';
import { BufferDepositModal } from './BufferDepositModal';
import { formatCurrency } from '../../../utils';
import {
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Plus,
  Minus,
  History,
  Wallet,
} from 'lucide-react';

export const BufferManager = () => {
  return (
    <AppLayout title="Emergency Buffer">
      <BufferManagerContent />
    </AppLayout>
  );
};

const BufferManagerContent = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { buffer, transactions, isLoading } = useAppSelector((state) => state.buffer);
  const { byId: cyclesById, activeCycleId } = useAppSelector((state) => state.paycheckCycles);

  const activeCycle = activeCycleId ? cyclesById[activeCycleId] : null;

  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [depositModalOpen, setDepositModalOpen] = useState(false);

  useEffect(() => {
    if (user) {
      dispatch(fetchBuffer(user.uid));
      dispatch(fetchBufferTransactions({ userId: user.uid, limit: 10 }));
    }
  }, [dispatch, user]);

  const handleInitializeBuffer = async () => {
    if (user) {
      await dispatch(initializeBuffer({ userId: user.uid, initialAmount: 0 }));
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  // Show initialization prompt if no buffer exists
  if (!buffer) {
    return (
      <Card>
        <CardHeader title="Emergency Buffer" />
        <div className="text-center py-8">
          <ShieldCheck className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            Set Up Your Emergency Buffer
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
            Your buffer is a safety net for unexpected expenses. It grows automatically
            from leftover spending each cycle and can be used for emergencies.
          </p>
          <Button onClick={handleInitializeBuffer}>
            <Wallet className="w-4 h-4 mr-2" />
            Initialize Buffer
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Buffer Overview */}
      <Card>
        <CardHeader title="Emergency Buffer" />
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-green-100 dark:bg-green-900/50 rounded-full">
              <ShieldCheck className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Available Balance</p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                {formatCurrency(buffer.totalAmount)}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setDepositModalOpen(true)}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Funds
            </Button>
            <Button
              variant="danger"
              onClick={() => setWithdrawModalOpen(true)}
              disabled={buffer.totalAmount <= 0}
              className="flex items-center gap-2"
            >
              <Minus className="w-4 h-4" />
              Emergency Withdrawal
            </Button>
          </div>
        </div>
      </Card>

      {/* Buffer Tips */}
      <Card>
        <CardHeader title="How Your Buffer Works" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-transparent dark:border-blue-800">
            <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-2">🎯 Auto-Growth</h4>
            <p className="text-blue-700 dark:text-blue-400">
              When you end a cycle under budget, any leftover can be added to your buffer.
            </p>
          </div>
          <div className="p-4 bg-amber-50 dark:bg-amber-900/30 rounded-lg border border-transparent dark:border-amber-800">
            <h4 className="font-medium text-amber-900 dark:text-amber-300 mb-2">🔒 Protected Savings</h4>
            <p className="text-amber-700 dark:text-amber-400">
              Buffer funds are separate from your spending limit to avoid temptation.
            </p>
          </div>
          <div className="p-4 bg-red-50 dark:bg-red-900/30 rounded-lg border border-transparent dark:border-red-800">
            <h4 className="font-medium text-red-900 dark:text-red-300 mb-2">🚨 Emergencies Only</h4>
            <p className="text-red-700 dark:text-red-400">
              Use withdrawals only for true emergencies—car repairs, medical bills, etc.
            </p>
          </div>
        </div>
      </Card>

      {/* Transaction History */}
      <Card>
        <CardHeader
          title="Buffer History"
          action={
            <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
              <History className="w-4 h-4" />
              <span className="text-sm">Recent Activity</span>
            </div>
          }
        />
        {transactions.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-6">
            No buffer transactions yet. Your buffer will grow as you save!
          </p>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-full ${
                      tx.type === 'deposit' ? 'bg-green-100 dark:bg-green-900/50' : 'bg-red-100 dark:bg-red-900/50'
                    }`}
                  >
                    {tx.type === 'deposit' ? (
                      <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{tx.reason}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {tx.createdAt?.toDate?.()
                        ? tx.createdAt.toDate().toLocaleDateString()
                        : 'Just now'}
                    </p>
                  </div>
                </div>
                <span
                  className={`font-semibold ${
                    tx.type === 'deposit' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {tx.type === 'deposit' ? '+' : '-'}
                  {formatCurrency(tx.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Modals */}
      <BufferWithdrawModal
        isOpen={withdrawModalOpen}
        onClose={() => setWithdrawModalOpen(false)}
        maxAmount={buffer.totalAmount}
        cycleId={activeCycle?.id}
      />
      <BufferDepositModal
        isOpen={depositModalOpen}
        onClose={() => setDepositModalOpen(false)}
        cycleId={activeCycle?.id}
      />
    </div>
  );
};
