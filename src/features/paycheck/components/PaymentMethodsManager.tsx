import { useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, CreditCard, Wallet, Banknote, Star } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import {
  createPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  createDefaultPaymentMethods,
} from '../paymentMethodsSlice';
import { Card, CardHeader, Button, Input, Select, Modal, ConfirmDialog } from '../../../components/shared';
import { PaymentMethod, PaymentMethodType } from '../../../types';

const PAYMENT_METHOD_ICONS: Record<PaymentMethodType, typeof CreditCard> = {
  credit: CreditCard,
  debit: Wallet,
  cash: Banknote,
};

const PAYMENT_METHOD_COLORS: Record<PaymentMethodType, string> = {
  credit: 'text-teal-600 bg-teal-100',
  debit: 'text-blue-600 bg-blue-100',
  cash: 'text-green-600 bg-green-100',
};

export const PaymentMethodsManager = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { byId, allIds } = useAppSelector((state) => state.paymentMethods);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [methodToDelete, setMethodToDelete] = useState<PaymentMethod | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<PaymentMethodType>('debit');
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const paymentMethods = useMemo(() => {
    return allIds.map((id) => byId[id]).filter(Boolean);
  }, [allIds, byId]);

  const handleAdd = () => {
    setEditingMethod(null);
    setFormName('');
    setFormType('debit');
    setFormIsDefault(paymentMethods.length === 0);
    setModalOpen(true);
  };

  const handleEdit = (method: PaymentMethod) => {
    setEditingMethod(method);
    setFormName(method.name);
    setFormType(method.type);
    setFormIsDefault(method.isDefault);
    setModalOpen(true);
  };

  const handleDeleteClick = (method: PaymentMethod) => {
    setMethodToDelete(method);
    setDeleteConfirmOpen(true);
  };

  const handleSave = async () => {
    if (!user || !formName.trim()) return;

    setIsSaving(true);
    try {
      if (editingMethod) {
        await dispatch(
          updatePaymentMethod({
            userId: user.uid,
            paymentMethodId: editingMethod.id,
            updates: {
              name: formName.trim(),
              type: formType,
              isDefault: formIsDefault,
            },
          })
        ).unwrap();
      } else {
        await dispatch(
          createPaymentMethod({
            userId: user.uid,
            paymentMethod: {
              name: formName.trim(),
              type: formType,
              isDefault: formIsDefault || paymentMethods.length === 0,
              isActive: true,
              sortOrder: paymentMethods.length,
            },
          })
        ).unwrap();
      }
      setModalOpen(false);
    } catch (error) {
      console.error('Failed to save payment method:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!user || !methodToDelete) return;

    setIsDeleting(true);
    try {
      await dispatch(
        deletePaymentMethod({
          userId: user.uid,
          paymentMethodId: methodToDelete.id,
        })
      ).unwrap();
      setDeleteConfirmOpen(false);
      setMethodToDelete(null);
    } catch (error) {
      console.error('Failed to delete payment method:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateDefaults = async () => {
    if (!user) return;
    await dispatch(createDefaultPaymentMethods(user.uid));
  };

  return (
    <>
      <Card>
        <div className="flex items-center justify-between mb-4">
          <CardHeader
            title="Payment Methods"
            subtitle="Track which cards or cash you use for spending"
          />
          <Button onClick={handleAdd} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add
          </Button>
        </div>

        {paymentMethods.length === 0 ? (
          <div className="text-center py-8">
            <Wallet className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400 mb-4">No payment methods yet.</p>
            <div className="flex justify-center gap-3">
              <Button variant="secondary" onClick={handleCreateDefaults}>
                Add Defaults
              </Button>
              <Button onClick={handleAdd}>Add Custom</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {paymentMethods.map((method) => {
              const Icon = PAYMENT_METHOD_ICONS[method.type];
              const colorClass = PAYMENT_METHOD_COLORS[method.type];

              return (
                <div
                  key={method.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${colorClass}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-gray-100">{method.name}</span>
                        {method.isDefault && (
                          <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                        )}
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">{method.type}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEdit(method)}
                      className="p-2 text-gray-500 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(method)}
                      className="p-2 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingMethod ? 'Edit Payment Method' : 'Add Payment Method'}
        size="sm"
      >
        <div className="space-y-4">
          <Input
            label="Name"
            placeholder="e.g., Chase Sapphire, Checking Debit"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
          />

          <Select
            label="Type"
            value={formType}
            onChange={(e) => setFormType(e.target.value as PaymentMethodType)}
            options={[
              { value: 'credit', label: 'Credit Card' },
              { value: 'debit', label: 'Debit Card' },
              { value: 'cash', label: 'Cash' },
            ]}
          />

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formIsDefault}
              onChange={(e) => setFormIsDefault(e.target.checked)}
              className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500 dark:bg-gray-700 dark:border-gray-600"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Set as default payment method</span>
          </label>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} isLoading={isSaving} disabled={!formName.trim()}>
              {editingMethod ? 'Save' : 'Add'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Payment Method"
        message={
          methodToDelete ? `Delete "${methodToDelete.name}"?` : 'Delete this payment method?'
        }
        description="This action cannot be undone."
        confirmLabel="Delete"
        isLoading={isDeleting}
      />
    </>
  );
};
