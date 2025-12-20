import { useAppSelector, useAppDispatch } from '../../../app/hooks';
import { openModal } from '../../auth/uiSlice';
import { AppLayout } from '../../../components/layout';
import { Card, Badge, Button, EmptyState } from '../../../components/shared';
import { formatPeriodRange } from '../../../utils/date';
import { formatCurrency } from '../../../utils/currency';
import { History, Plus } from 'lucide-react';

export const BudgetHistoryPage = () => {
  const dispatch = useAppDispatch();
  const { byId, allIds } = useAppSelector((state) => state.budgetPeriods);

  return (
    <AppLayout title="Budget History">
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button onClick={() => dispatch(openModal('createBudgetPeriod'))}>
            <Plus className="w-4 h-4 mr-2" />
            New Period
          </Button>
        </div>

        {allIds.length === 0 ? (
          <Card>
            <EmptyState
              icon={History}
              title="No Budget Periods"
              description="You haven't created any budget periods yet."
              action={
                <Button onClick={() => dispatch(openModal('createBudgetPeriod'))}>
                  Create First Period
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="space-y-4">
            {allIds.map((periodId) => {
              const period = byId[periodId];
              const totalAvailable = period.totalIncome + period.rolloverIn;
              const utilizationPercent = totalAvailable > 0
                ? (period.totalSpent / totalAvailable) * 100
                : 0;

              return (
                <Card key={periodId}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {formatPeriodRange(
                            period.startDate.toDate(),
                            period.endDate.toDate()
                          )}
                        </h3>
                        <Badge variant={period.status === 'active' ? 'success' : 'default'}>
                          {period.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                        <div>
                          <p className="text-sm text-gray-500">Income</p>
                          <p className="text-lg font-medium">{formatCurrency(period.totalIncome)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Rollover In</p>
                          <p className="text-lg font-medium text-green-600">
                            +{formatCurrency(period.rolloverIn)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Spent</p>
                          <p className="text-lg font-medium text-red-600">
                            {formatCurrency(period.totalSpent)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Remaining</p>
                          <p className="text-lg font-medium">
                            {formatCurrency(period.remainingBudget)}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-gray-900">
                        {utilizationPercent.toFixed(0)}%
                      </p>
                      <p className="text-sm text-gray-500">used</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
};
