import { useState } from 'react';
import { Plus, Trash2, Edit, Tag } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { createCategory, deleteCategory, updateCategory } from '../categoriesSlice';
import { AppLayout } from '../../../components/layout';
import { Card, Button, Input, EmptyState, IconButton, Modal, Select } from '../../../components/shared';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '../../../constants';

export const CategoriesPage = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { byId, rootIds } = useAppSelector((state) => state.categories);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string>(CATEGORY_ICONS[0]);
  const [color, setColor] = useState<string>(CATEGORY_COLORS[0]);
  const [isLoading, setIsLoading] = useState(false);

  const handleOpenModal = (categoryId?: string) => {
    if (categoryId) {
      const cat = byId[categoryId];
      setEditingId(categoryId);
      setName(cat.name);
      setIcon(cat.icon);
      setColor(cat.color);
    } else {
      setEditingId(null);
      setName('');
      setIcon(CATEGORY_ICONS[0]);
      setColor(CATEGORY_COLORS[0]);
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!user || !name) return;

    setIsLoading(true);
    try {
      if (editingId) {
        await dispatch(
          updateCategory({
            userId: user.uid,
            categoryId: editingId,
            updates: { name, icon, color },
          })
        );
      } else {
        await dispatch(
          createCategory({
            userId: user.uid,
            category: {
              name,
              icon,
              color,
              parentId: null,
              sortOrder: rootIds.length,
              isActive: true,
            },
          })
        );
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error('Failed to save category:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (categoryId: string) => {
    if (!user) return;
    if (confirm('Are you sure you want to delete this category?')) {
      dispatch(deleteCategory({ userId: user.uid, categoryId }));
    }
  };

  return (
    <AppLayout title="Categories">
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button onClick={() => handleOpenModal()}>
            <Plus className="w-4 h-4 mr-2" />
            Add Category
          </Button>
        </div>

        {rootIds.length === 0 ? (
          <Card>
            <EmptyState
              icon={Tag}
              title="No Categories"
              description="Create categories to organize your transactions."
              action={<Button onClick={() => handleOpenModal()}>Add Category</Button>}
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rootIds.map((categoryId) => {
              const category = byId[categoryId];
              return (
                <Card key={categoryId}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: category.color + '20' }}
                      >
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: category.color }}
                        />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{category.name}</p>
                        <p className="text-sm text-gray-500">{category.icon}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <IconButton icon={Edit} size="sm" onClick={() => handleOpenModal(categoryId)} />
                      <IconButton
                        icon={Trash2}
                        variant="danger"
                        size="sm"
                        onClick={() => handleDelete(categoryId)}
                      />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? 'Edit Category' : 'Add Category'}
      >
        <div className="space-y-4">
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Groceries, Entertainment"
          />

          <Select
            label="Icon"
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            options={CATEGORY_ICONS.map((i) => ({ value: i, label: i }))}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    color === c ? 'border-gray-900 scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} isLoading={isLoading} disabled={!name}>
              {editingId ? 'Update' : 'Add'} Category
            </Button>
          </div>
        </div>
      </Modal>
    </AppLayout>
  );
};
