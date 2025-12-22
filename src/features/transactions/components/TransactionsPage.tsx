import { useEffect, useState } from 'react';
import { Trash2, Receipt } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { fetchTransactions, deleteTransaction } from '../transactionsSlice';
import { AppLayout } from '../../../components/layout';
import { Card, Button, Badge, Select, EmptyState, IconButton } from '../../../components/shared';
import { formatCurrency } from '../../../utils/currency';
import { formatFullDate, formatShortDate, toDate } from '../../../utils/date';

export const TransactionsPage = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { byId, allIds, isLoading } = useAppSelector((state) => state.transactions);
  const { byId: periodsById, allIds: periodIds } = useAppSelector((state) => state.budgetPeriods);
  const { byId: categoriesById, allIds: categoryIds } = useAppSelector((state) => state.categories);
  const { data: settings } = useAppSelector((state) => state.settings);
  const timezone = settings?.timezone;

  const [periodFilter, setPeriodFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<'' | 'expense' | 'income'>('');

  useEffect(() => {
    if (user) {
      dispatch(
        fetchTransactions({
          userId: user.uid,
          filters: {
            periodId: periodFilter || undefined,
            categoryId: categoryFilter || undefined,
            type: typeFilter || undefined,
          },
        })
      );
    }
  }, [dispatch, user, periodFilter, categoryFilter, typeFilter]);

  const handleDelete = async (transactionId: string) => {
    if (!user) return;
    const tx = byId[transactionId];
    if (tx && confirm('Are you sure you want to delete this transaction?')) {
      dispatch(deleteTransaction({ userId: user.uid, transaction: tx }));
    }
  };

  return (
    <AppLayout title="Transactions">
      <div className="space-y-4">
        {/* Filters */}
        <Card>
          <div className="flex flex-wrap gap-4">
            <Select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
              options={[
                { value: '', label: 'All Periods' },
                ...periodIds.map((id) => ({
                  value: id,
                  label: `${formatShortDate(toDate(periodsById[id].startDate), timezone)} - ${formatShortDate(toDate(periodsById[id].endDate), timezone)}`,
                })),
              ]}
            />
            <Select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              options={[
                { value: '', label: 'All Categories' },
                ...categoryIds.map((id) => ({
                  value: id,
                  label: categoriesById[id]?.name || 'Unknown',
                })),
              ]}
            />
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as '' | 'expense' | 'income')}
              options={[
                { value: '', label: 'All Types' },
                { value: 'expense', label: 'Expenses' },
                { value: 'income', label: 'Income' },
              ]}
            />
          </div>
        </Card>

        {/* Transactions List */}
        <Card padding="none">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500">Loading transactions...</div>
          ) : allIds.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No Transactions"
              description="You haven't recorded any transactions yet."
            />
          ) : (
            <div className="divide-y divide-gray-200">
              {allIds.map((txId) => {
                const tx = byId[txId];
                const category = categoriesById[tx.categoryId];

                return (
                  <div key={txId} className="p-4 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex items-center gap-4">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: (category?.color || '#6366f1') + '20' }}
                      >
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: category?.color || '#6366f1' }}
                        />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{tx.description}</p>
                        <p className="text-sm text-gray-500">
                          {tx.categoryName} • {formatFullDate(toDate(tx.date), timezone)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p
                          className={`font-semibold ${
                            tx.type === 'expense' ? 'text-red-600' : 'text-green-600'
                          }`}
                        >
                          {tx.type === 'expense' ? '-' : '+'}
                          {formatCurrency(tx.amount)}
                        </p>
                        <Badge variant={tx.type === 'expense' ? 'danger' : 'success'} size="sm">
                          {tx.type}
                        </Badge>
                      </div>
                      <IconButton
                        icon={Trash2}
                        variant="danger"
                        size="sm"
                        onClick={() => handleDelete(txId)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  );
};
