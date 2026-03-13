import { useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, ShoppingCart, Power } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import {
  createVariableObligation,
  updateVariableObligation,
  deleteVariableObligation,
} from '../variableObligationsSlice';
import { Card, CardHeader, Button, Input, Modal } from '../../../components/shared';
import { VariableObligation } from '../../../types';
import { formatCurrency } from '../../../utils/currency';

export const VariableObligationsManager = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { byId, allIds } = useAppSelector((state) => state.variableObligations);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingObligation, setEditingObligation] = useState<VariableObligation | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [obligationToDelete, setObligationToDelete] = useState<VariableObligation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  const [formName, setFormName] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const activeObligations = useMemo(
    () => allIds.map((id) => byId[id]).filter((o) => o && o.isActive !== false),
    [allIds, byId]
  );

  const inactiveObligations = useMemo(
    () => allIds.map((id) => byId[id]).filter((o) => o && o.isActive === false),
    [allIds, byId]
  );

  const handleAdd = () => {
    setEditingObligation(null);
    setFormName('');
    setFormAmount('');
    setFormIsActive(true);
    setModalOpen(true);
  };

  const handleEdit = (obligation: VariableObligation) => {
    setEditingObligation(obligation);
    setFormName(obligation.name);
    setFormAmount(String(obligation.estimatedAmount));
    setFormIsActive(obligation.isActive);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!user || !formName.trim() || !formAmount) return;

    setIsSaving(true);
    try {
      const amount = parseFloat(formAmount);
      if (isNaN(amount) || amount <= 0) return;

      if (editingObligation) {
        await dispatch(
          updateVariableObligation({
            userId: user.uid,
            obligationId: editingObligation.id,
            updates: {
              name: formName.trim(),
              estimatedAmount: amount,
              isActive: formIsActive,
            },
          })
        ).unwrap();
      } else {
        await dispatch(
          createVariableObligation({
            userId: user.uid,
            obligation: {
              name: formName.trim(),
              estimatedAmount: amount,
              isActive: formIsActive,
            },
          })
        ).unwrap();
      }
      setModalOpen(false);
    } catch (error) {
      console.error('Failed to save obligation:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (obligation: VariableObligation) => {
    if (!user) return;
    await dispatch(
      updateVariableObligation({
        userId: user.uid,
        obligationId: obligation.id,
        updates: { isActive: !obligation.isActive },
      })
    );
  };

  const handleDeleteConfirm = (obligation: VariableObligation) => {
    setObligationToDelete(obligation);
    setDeleteConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (!user || !obligationToDelete) return;

    setIsDeleting(true);
    try {
      await dispatch(
        deleteVariableObligation({ userId: user.uid, obligationId: obligationToDelete.id })
      ).unwrap();
      setDeleteConfirmOpen(false);
      setObligationToDelete(null);
    } catch (error) {
      console.error('Failed to delete obligation:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const obligations = useMemo(
    () => [...activeObligations, ...inactiveObligations],
    [activeObligations, inactiveObligations]
  );

  return (
    <>
      <Card>
        <CardHeader
          title="Variable Obligations"
          subtitle="Recurring necessities without a specific due date — gas, groceries, etc."
          action={
            <Button size="sm" onClick={handleAdd} className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add
            </Button>
          }
        />

        {obligations.length === 0 && (
          <div className="text-center py-8">
            <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            <p className="text-gray-500 dark:text-gray-400 mb-2">No variable obligations yet</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">
              Add things like gas, groceries, or any recurring expense without a fixed due date
            </p>
            <Button size="sm" onClick={handleAdd} className="inline-flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add First Obligation
            </Button>
          </div>
        )}

        {activeObligations.length > 0 && (
          <div className="space-y-2 mt-4">
            {activeObligations.map((obligation) => (
              <div
                key={obligation.id}
                className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                    <ShoppingCart className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{obligation.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      ~{formatCurrency(obligation.estimatedAmount)} / cycle
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEdit(obligation)}
                    className="p-1.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleToggleActive(obligation)}
                    className="p-1.5 text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition-colors"
                    title="Deactivate"
                  >
                    <Power className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteConfirm(obligation)}
                    className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {inactiveObligations.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setShowInactive(!showInactive)}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1"
            >
              {showInactive ? 'Hide' : 'Show'} {inactiveObligations.length} inactive
            </button>

            {showInactive && (
              <div className="space-y-2 mt-2">
                {inactiveObligations.map((obligation) => (
                  <div
                    key={obligation.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 opacity-60"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                        <ShoppingCart className="w-4 h-4 text-gray-400" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-600 dark:text-gray-400">{obligation.name}</p>
                        <p className="text-sm text-gray-400 dark:text-gray-500">
                          ~{formatCurrency(obligation.estimatedAmount)} / cycle · Inactive
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleActive(obligation)}
                        className="p-1.5 text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors"
                        title="Reactivate"
                      >
                        <Power className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteConfirm(obligation)}
                        className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingObligation ? 'Edit Obligation' : 'Add Variable Obligation'}
        size="sm"
      >
        <div className="space-y-4">
          <Input
            label="Name"
            placeholder="e.g., Gas, Groceries, Pet Food"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            autoFocus
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Estimated Amount per Cycle
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">$</span>
              <input
                type="number"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="w-full pl-8 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              This will be pre-deducted from your paycheck each cycle. You can adjust it per cycle.
            </p>
          </div>
          {editingObligation && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formIsActive}
                onChange={(e) => setFormIsActive(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Active (shown in cycle wizard)</span>
            </label>
          )}
          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              isLoading={isSaving}
              disabled={!formName.trim() || !formAmount || parseFloat(formAmount) <= 0}
            >
              {editingObligation ? 'Save Changes' : 'Add Obligation'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        title="Delete Obligation"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-300">
            Are you sure you want to delete <strong>{obligationToDelete?.name}</strong>? This won't
            affect cycles already created.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} isLoading={isDeleting}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
