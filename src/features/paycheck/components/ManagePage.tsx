import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { fetchPaymentMethods } from '../paymentMethodsSlice';
import { fetchBills } from '../billsSlice';
import { fetchSpendingTags } from '../spendingTagsSlice';
import { fetchVariableObligations } from '../variableObligationsSlice';
import { AppLayout } from '../../../components/layout';
import { PaymentMethodsManager } from './PaymentMethodsManager';
import { BillsManager } from './BillsManager';
import { SpendingTagsManager } from './SpendingTagsManager';
import { VariableObligationsManager } from './VariableObligationsManager';
import { CreditCard, Receipt, Tags, ShoppingCart } from 'lucide-react';

export const ManagePage = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);

  useEffect(() => {
    if (user) {
      dispatch(fetchPaymentMethods(user.uid));
      dispatch(fetchBills(user.uid));
      dispatch(fetchSpendingTags(user.uid));
      dispatch(fetchVariableObligations(user.uid));
    }
  }, [user, dispatch]);

  return (
    <AppLayout title="Manage">
      <div className="max-w-2xl space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border border-blue-100 dark:border-blue-800 rounded-xl p-4">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">Manage Your Budget Items</h3>
          <p className="text-sm text-blue-700 dark:text-blue-300">
            Set up your payment methods, recurring bills, and spending tags to streamline your budgeting.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-3">
          <QuickStat
            icon={CreditCard}
            label="Payment Methods"
            color="indigo"
          />
          <QuickStat
            icon={Receipt}
            label="Bills"
            color="amber"
          />
          <QuickStat
            icon={ShoppingCart}
            label="Obligations"
            color="orange"
          />
          <QuickStat
            icon={Tags}
            label="Tags"
            color="emerald"
          />
        </div>

        {/* Payment Methods */}
        <PaymentMethodsManager />

        {/* Bills */}
        <BillsManager />

        {/* Variable Obligations */}
        <VariableObligationsManager />

        {/* Spending Tags */}
        <SpendingTagsManager />
      </div>
    </AppLayout>
  );
};

interface QuickStatProps {
  icon: typeof CreditCard;
  label: string;
  color: 'indigo' | 'amber' | 'orange' | 'emerald';
}

const QuickStat = ({ icon: Icon, label, color }: QuickStatProps) => {
  const colorClasses = {
    indigo: 'bg-indigo-100 text-indigo-600',
    amber: 'bg-amber-100 text-amber-600',
    orange: 'bg-orange-100 text-orange-600',
    emerald: 'bg-emerald-100 text-emerald-600',
  };

  return (
    <div className="flex flex-col items-center p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${colorClasses[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <span className="text-sm text-gray-600 dark:text-gray-400 mt-2">{label}</span>
    </div>
  );
};
