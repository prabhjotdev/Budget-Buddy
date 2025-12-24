import { useState } from 'react';
import { Plus, Trash2, FileText, Edit, AlertTriangle } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { createTemplate, updateTemplate, deleteTemplate } from '../templatesSlice';
import { AppLayout } from '../../../components/layout';
import {
  Card,
  CardHeader,
  Button,
  Input,
  CurrencyInput,
  EmptyState,
  IconButton,
  Modal,
  CategoryIcon,
} from '../../../components/shared';
import { formatCurrency } from '../../../utils/currency';
import { TemplateAllocation, BudgetTemplate } from '../../../types';

export const TemplatesPage = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { byId, allIds } = useAppSelector((state) => state.templates);
  const { byId: categoriesById, allIds: categoryIds } = useAppSelector((state) => state.categories);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [allocations, setAllocations] = useState<TemplateAllocation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Delete confirmation state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<BudgetTemplate | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleOpenCreateModal = () => {
    setModalMode('create');
    setEditingTemplateId(null);
    setName('');
    setDescription('');
    setAllocations(
      categoryIds.map((catId) => ({
        categoryId: catId,
        amount: 0,
        note: '',
      }))
    );
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (template: BudgetTemplate) => {
    setModalMode('edit');
    setEditingTemplateId(template.id);
    setName(template.name);
    setDescription(template.description || '');

    // Merge existing allocations with all categories
    const allocationMap = new Map(template.allocations.map((a) => [a.categoryId, a]));
    setAllocations(
      categoryIds.map((catId) => ({
        categoryId: catId,
        amount: allocationMap.get(catId)?.amount || 0,
        note: allocationMap.get(catId)?.note || '',
      }))
    );
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!user || !name) return;

    setIsLoading(true);
    try {
      const templateData = {
        name,
        description,
        allocations: allocations.filter((a) => a.amount > 0),
        isDefault: false,
      };

      if (modalMode === 'create') {
        await dispatch(
          createTemplate({
            userId: user.uid,
            template: templateData,
          })
        );
      } else if (editingTemplateId) {
        await dispatch(
          updateTemplate({
            userId: user.uid,
            templateId: editingTemplateId,
            updates: templateData,
          })
        );
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error('Failed to save template:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = (template: BudgetTemplate) => {
    setTemplateToDelete(template);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!user || !templateToDelete) return;

    setIsDeleting(true);
    try {
      await dispatch(deleteTemplate({ userId: user.uid, templateId: templateToDelete.id }));
      setDeleteConfirmOpen(false);
      setTemplateToDelete(null);
    } catch (error) {
      console.error('Failed to delete template:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAllocationChange = (categoryId: string, amount: number) => {
    setAllocations((prev) =>
      prev.map((a) => (a.categoryId === categoryId ? { ...a, amount } : a))
    );
  };

  const totalAllocated = allocations.reduce((sum, a) => sum + a.amount, 0);

  return (
    <AppLayout title="Budget Templates">
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button onClick={handleOpenCreateModal}>
            <Plus className="w-4 h-4 mr-2" />
            New Template
          </Button>
        </div>

        {allIds.length === 0 ? (
          <Card>
            <EmptyState
              icon={FileText}
              title="No Templates"
              description="Create reusable budget templates to quickly set up new periods."
              action={<Button onClick={handleOpenCreateModal}>Create Template</Button>}
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {allIds.map((templateId) => {
              const template = byId[templateId];
              const total = template.allocations.reduce((sum, a) => sum + a.amount, 0);

              return (
                <Card key={templateId}>
                  <CardHeader
                    title={template.name}
                    subtitle={template.description}
                    action={
                      <div className="flex gap-2">
                        <IconButton
                          icon={Edit}
                          size="sm"
                          onClick={() => handleOpenEditModal(template)}
                        />
                        <IconButton
                          icon={Trash2}
                          variant="danger"
                          size="sm"
                          onClick={() => handleDeleteClick(template)}
                        />
                      </div>
                    }
                  />
                  <div className="space-y-2">
                    {template.allocations.slice(0, 5).map((alloc) => {
                      const category = categoriesById[alloc.categoryId];
                      const categoryColor = category?.color || '#6366f1';
                      const categoryIcon = category?.icon || 'shopping-cart';
                      return (
                        <div key={alloc.categoryId} className="flex justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-5 h-5 rounded flex items-center justify-center"
                              style={{ backgroundColor: categoryColor }}
                            >
                              <CategoryIcon icon={categoryIcon} color="#ffffff" size="sm" />
                            </div>
                            <span className="text-gray-700">{category?.name || 'Unknown'}</span>
                          </div>
                          <span className="font-medium">{formatCurrency(alloc.amount)}</span>
                        </div>
                      );
                    })}
                    {template.allocations.length > 5 && (
                      <p className="text-xs text-gray-500">
                        +{template.allocations.length - 5} more categories
                      </p>
                    )}
                  </div>
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex justify-between font-medium">
                      <span>Total</span>
                      <span>{formatCurrency(total)}</span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Create/Edit Template Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalMode === 'create' ? 'Create Template' : 'Edit Template'}
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="Template Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Standard Month"
          />
          <Input
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
          />

          <div>
            <div className="flex justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-700">Allocations</h4>
              <span className="text-sm text-gray-500">Total: {formatCurrency(totalAllocated)}</span>
            </div>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {allocations.map((alloc) => {
                const category = categoriesById[alloc.categoryId];
                const categoryColor = category?.color || '#6366f1';
                const categoryIcon = category?.icon || 'shopping-cart';
                return (
                  <div key={alloc.categoryId} className="flex items-center gap-3">
                    <div
                      className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: categoryColor }}
                    >
                      <CategoryIcon icon={categoryIcon} color="#ffffff" size="sm" />
                    </div>
                    <span className="text-sm text-gray-700 w-32 truncate">{category?.name}</span>
                    <CurrencyInput
                      value={alloc.amount}
                      onChange={(val) => handleAllocationChange(alloc.categoryId, val)}
                      className="flex-1"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} isLoading={isLoading} disabled={!name}>
              {modalMode === 'create' ? 'Create Template' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        title="Delete Template"
        size="sm"
      >
        <div className="space-y-4">
          {templateToDelete && (
            <>
              <div className="flex items-center gap-3 p-4 bg-red-50 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-800">
                    Delete "{templateToDelete.name}"?
                  </p>
                  <p className="text-sm text-red-600 mt-1">
                    This action cannot be undone. The template will be permanently removed.
                  </p>
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
                  Delete Template
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </AppLayout>
  );
};
