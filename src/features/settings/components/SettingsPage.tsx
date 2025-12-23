import { useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { updateSettings } from '../settingsSlice';
import { createCategory, updateCategory, deleteCategory } from '../../categories/categoriesSlice';
import { AppLayout } from '../../../components/layout';
import { Card, CardHeader, Button, Input, Select, CategoryBadge, Modal } from '../../../components/shared';
import { CategoryModal } from '../../../components/modals/CategoryModal';
import { Category } from '../../../types';

// Get all supported timezones
const getTimezones = (): string[] => {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    // Fallback for browsers that don't support supportedValuesOf
    return [
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'America/Anchorage',
      'Pacific/Honolulu',
      'America/Toronto',
      'America/Vancouver',
      'Europe/London',
      'Europe/Paris',
      'Europe/Berlin',
      'Asia/Tokyo',
      'Asia/Shanghai',
      'Asia/Kolkata',
      'Australia/Sydney',
      'Pacific/Auckland',
      'UTC',
    ];
  }
};

// Get the user's browser timezone
const getBrowserTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'America/New_York';
  }
};

export const SettingsPage = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { data: settings } = useAppSelector((state) => state.settings);
  const { byId: categoriesById, allIds: categoryIds } = useAppSelector((state) => state.categories);
  const { byId: transactionsById } = useAppSelector((state) => state.transactions);

  const [payDay1, setPayDay1] = useState(settings?.payDays[0] || 1);
  const [payDay2, setPayDay2] = useState(settings?.payDays[1] || 15);
  const [currency, setCurrency] = useState(settings?.currency || 'USD');
  const [timezone, setTimezone] = useState(settings?.timezone || getBrowserTimezone());
  const [isSaving, setIsSaving] = useState(false);

  // Category management state
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [categoryModalMode, setCategoryModalMode] = useState<'add' | 'edit'>('add');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Get transaction count for a category
  const getTransactionCount = (categoryId: string): number => {
    return Object.values(transactionsById).filter((tx) => tx.categoryId === categoryId).length;
  };

  // Sort categories by sortOrder then by name
  const sortedCategories = useMemo(() => {
    return categoryIds
      .map((id) => categoriesById[id])
      .filter(Boolean)
      .sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.name.localeCompare(b.name);
      });
  }, [categoryIds, categoriesById]);

  const timezoneOptions = useMemo(() => {
    const timezones = getTimezones();
    return timezones.map((tz) => ({
      value: tz,
      label: tz.replace(/_/g, ' '),
    }));
  }, []);

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      await dispatch(
        updateSettings({
          userId: user.uid,
          updates: {
            payDays: [payDay1, payDay2] as [number, number],
            currency,
            timezone,
          },
        })
      );
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const dayOptions = Array.from({ length: 28 }, (_, i) => ({
    value: String(i + 1),
    label: String(i + 1),
  }));

  // Category handlers
  const handleAddCategory = () => {
    setCategoryModalMode('add');
    setEditingCategory(null);
    setCategoryModalOpen(true);
  };

  const handleEditCategory = (category: Category) => {
    setCategoryModalMode('edit');
    setEditingCategory(category);
    setCategoryModalOpen(true);
  };

  const handleDeleteClick = (category: Category) => {
    setCategoryToDelete(category);
    setDeleteConfirmOpen(true);
  };

  const handleSaveCategory = async (data: { name: string; icon: string; color: string }) => {
    if (!user) return;

    if (categoryModalMode === 'add') {
      await dispatch(
        createCategory({
          userId: user.uid,
          category: {
            name: data.name,
            icon: data.icon,
            color: data.color,
            parentId: null,
            sortOrder: sortedCategories.length,
            isActive: true,
          },
        })
      ).unwrap();
    } else if (editingCategory) {
      await dispatch(
        updateCategory({
          userId: user.uid,
          categoryId: editingCategory.id,
          updates: {
            name: data.name,
            icon: data.icon,
            color: data.color,
          },
        })
      ).unwrap();
    }
  };

  const handleConfirmDelete = async () => {
    if (!user || !categoryToDelete) return;

    setIsDeleting(true);
    try {
      await dispatch(
        deleteCategory({
          userId: user.uid,
          categoryId: categoryToDelete.id,
        })
      ).unwrap();
      setDeleteConfirmOpen(false);
      setCategoryToDelete(null);
    } catch (error) {
      console.error('Failed to delete category:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AppLayout title="Settings">
      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader
            title="Pay Day Configuration"
            subtitle="Set the days of the month when you get paid"
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="First Pay Day"
              value={String(payDay1)}
              onChange={(e) => setPayDay1(Number(e.target.value))}
              options={dayOptions}
            />
            <Select
              label="Second Pay Day"
              value={String(payDay2)}
              onChange={(e) => setPayDay2(Number(e.target.value))}
              options={dayOptions}
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="Currency" subtitle="Select your preferred currency" />
          <Select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            options={[
              { value: 'USD', label: 'USD ($)' },
              { value: 'EUR', label: 'EUR (\u20AC)' },
              { value: 'GBP', label: 'GBP (\u00A3)' },
              { value: 'CAD', label: 'CAD ($)' },
              { value: 'AUD', label: 'AUD ($)' },
            ]}
          />
        </Card>

        <Card>
          <CardHeader
            title="Timezone"
            subtitle="Select your timezone for date display"
          />
          <Select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            options={timezoneOptions}
          />
          <p className="mt-2 text-xs text-gray-500">
            Detected timezone: {getBrowserTimezone()}
          </p>
        </Card>

        <Card>
          <CardHeader title="Account" subtitle="Your account information" />
          <div className="space-y-4">
            <Input label="Email" value={user?.email || ''} disabled />
            <Input label="Display Name" value={user?.displayName || ''} disabled />
          </div>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} isLoading={isSaving}>
            Save Settings
          </Button>
        </div>

        {/* Categories Management */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <CardHeader
              title="Categories"
              subtitle="Manage your expense categories"
            />
            <Button onClick={handleAddCategory} className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Category
            </Button>
          </div>

          {sortedCategories.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No categories yet. Add your first category to get started.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedCategories.map((category) => {
                const txCount = getTransactionCount(category.id);
                return (
                  <div
                    key={category.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <CategoryBadge
                        name={category.name}
                        icon={category.icon || 'shopping-cart'}
                        color={category.color || '#3B82F6'}
                      />
                      {txCount > 0 && (
                        <span className="text-xs text-gray-500">
                          {txCount} transaction{txCount !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEditCategory(category)}
                        className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Edit category"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(category)}
                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete category"
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
      </div>

      {/* Category Modal */}
      <CategoryModal
        isOpen={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        onSave={handleSaveCategory}
        category={editingCategory}
        mode={categoryModalMode}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        title="Delete Category"
        size="sm"
      >
        <div className="space-y-4">
          {categoryToDelete && (
            <>
              <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <div>
                  <p className="text-sm text-red-700">
                    Are you sure you want to delete <strong>{categoryToDelete.name}</strong>?
                  </p>
                  {getTransactionCount(categoryToDelete.id) > 0 && (
                    <p className="text-xs text-red-600 mt-1">
                      This category has {getTransactionCount(categoryToDelete.id)} transaction(s).
                      They will remain but show as "Unknown" category.
                    </p>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setDeleteConfirmOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmDelete}
                  isLoading={isDeleting}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Delete
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </AppLayout>
  );
};
