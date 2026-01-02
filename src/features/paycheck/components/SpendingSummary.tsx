import { useMemo } from 'react';
import { ShoppingBag, ChevronRight, Tag } from 'lucide-react';
import { useAppSelector } from '../../../app/hooks';
import { Card, CardHeader, Button } from '../../../components/shared';
import { formatCurrency } from '../../../utils/currency';

interface SpendingSummaryProps {
  cycleId: string;
}

export const SpendingSummary = ({ cycleId }: SpendingSummaryProps) => {
  const { byId: transactionsById, idsByCycle } = useAppSelector(
    (state) => state.spendingTransactions
  );
  const { byId: tagsById } = useAppSelector((state) => state.spendingTags);

  const cycleTransactionIds = useMemo(
    () => idsByCycle[cycleId] || [],
    [idsByCycle, cycleId]
  );

  const transactions = useMemo(() => {
    return cycleTransactionIds
      .map((id) => transactionsById[id])
      .filter(Boolean)
      .slice(0, 5); // Show only recent 5
  }, [cycleTransactionIds, transactionsById]);

  // Group spending by tags
  const spendingByTag = useMemo(() => {
    const tagTotals: Record<string, { name: string; amount: number; count: number }> = {};
    let untaggedTotal = 0;
    let untaggedCount = 0;

    cycleTransactionIds.forEach((id) => {
      const tx = transactionsById[id];
      if (!tx) return;

      if (tx.tagIds.length === 0) {
        untaggedTotal += tx.amount;
        untaggedCount++;
      } else {
        tx.tagIds.forEach((tagId) => {
          if (!tagTotals[tagId]) {
            const tag = tagsById[tagId];
            tagTotals[tagId] = {
              name: tag?.name || tx.tagNames[0] || 'Unknown',
              amount: 0,
              count: 0,
            };
          }
          tagTotals[tagId].amount += tx.amount;
          tagTotals[tagId].count++;
        });
      }
    });

    const sorted = Object.entries(tagTotals)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 4); // Top 4 tags

    if (untaggedCount > 0) {
      sorted.push({
        id: 'untagged',
        name: 'Untagged',
        amount: untaggedTotal,
        count: untaggedCount,
      });
    }

    return sorted;
  }, [cycleTransactionIds, transactionsById, tagsById]);

  const formatRelativeDate = (date: Date) => {
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <Card>
      <CardHeader
        title="Recent Spending"
        action={
          <Button variant="ghost" size="sm">
            View All
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        }
      />

      {transactions.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <ShoppingBag className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p>No spending logged yet</p>
          <p className="text-sm mt-1">Tap "Log Spending" to add your first transaction</p>
        </div>
      ) : (
        <>
          {/* Recent Transactions */}
          <div className="space-y-3 mb-4">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                    <ShoppingBag className="w-5 h-5 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {tx.description || 'Spending'}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{tx.paymentMethodName}</span>
                      {tx.tagNames.length > 0 && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Tag className="w-3 h-3" />
                            {tx.tagNames.join(', ')}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold text-red-600">
                    -{formatCurrency(tx.amount)}
                  </span>
                  <p className="text-xs text-gray-400">
                    {formatRelativeDate(tx.date.toDate())}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Spending by Tags */}
          {spendingByTag.length > 0 && (
            <div className="pt-4 border-t">
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
                Spending by Tag
              </h4>
              <div className="space-y-2">
                {spendingByTag.map((tag) => (
                  <div key={tag.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-700">{tag.name}</span>
                      <span className="text-xs text-gray-400">({tag.count})</span>
                    </div>
                    <span className="text-sm font-medium text-gray-900">
                      {formatCurrency(tag.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
};
