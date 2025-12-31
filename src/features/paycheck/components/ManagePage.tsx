import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { fetchPaymentMethods } from '../paymentMethodsSlice';
import { fetchBills } from '../billsSlice';
import { fetchSpendingTags } from '../spendingTagsSlice';
import { AppLayout } from '../../../components/layout';
import { PaymentMethodsManager } from './PaymentMethodsManager';
import { BillsManager } from './BillsManager';
import { SpendingTagsManager } from './SpendingTagsManager';
import { CreditCard, Receipt, Tags } from 'lucide-react';

export const ManagePage = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);

  useEffect(() => {
    if (user) {
      dispatch(fetchPaymentMethods(user.uid));
      dispatch(fetchBills(user.uid));
      dispatch(fetchSpendingTags(user.uid));
    }
  }, [user, dispatch]);

  return (
    <AppLayout title="Manage">
      <div className="max-w-2xl space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4">
          <h3 className="font-semibold text-blue-900 mb-1">Manage Your Budget Items</h3>
          <p className="text-sm text-blue-700">
            Set up your payment methods, recurring bills, and spending tags to streamline your budgeting.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4">
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
            icon={Tags}
            label="Tags"
            color="emerald"
          />
        </div>

        {/* Payment Methods */}
        <PaymentMethodsManager />

        {/* Bills */}
        <BillsManager />

        {/* Spending Tags */}
        <SpendingTagsManager />
      </div>
    </AppLayout>
  );
};

interface QuickStatProps {
  icon: typeof CreditCard;
  label: string;
  color: 'indigo' | 'amber' | 'emerald';
}

const QuickStat = ({ icon: Icon, label, color }: QuickStatProps) => {
  const colorClasses = {
    indigo: 'bg-indigo-100 text-indigo-600',
    amber: 'bg-amber-100 text-amber-600',
    emerald: 'bg-emerald-100 text-emerald-600',
  };

  return (
    <div className="flex flex-col items-center p-4 bg-white rounded-lg border border-gray-200">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${colorClasses[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <span className="text-sm text-gray-600 mt-2">{label}</span>
    </div>
  );
};
