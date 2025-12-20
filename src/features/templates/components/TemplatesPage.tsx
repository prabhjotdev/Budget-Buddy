import { useState } from 'react';
import { Plus, Trash2, FileText, Edit } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { createTemplate, deleteTemplate } from '../templatesSlice';
import { AppLayout } from '../../../components/layout';
import { Card, CardHeader, Button, Input, CurrencyInput, EmptyState, IconButton, Modal } from '../../../components/shared';
import { formatCurrency } from '../../../utils/currency';
import { TemplateAllocation } from '../../../types';

export const TemplatesPage = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { byId, allIds } = useAppSelector((state) => state.templates);
  const { byId: categoriesById, allIds: categoryIds } = useAppSelector((state) => state.categories);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [allocations, setAllocations] = useState<TemplateAllocation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleOpenModal = () => {
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

  const handleSave = async () => {
    if (!user || !name) return;

    setIsLoading(true);
    try {
      await dispatch(
        createTemplate({
          userId: user.uid,
          template: {
            name,
            description,
            allocations: allocations.filter((a) => a.amount > 0),
            isDefault: false,
          },
        })
      );
      setIsModalOpen(false);
    } catch (error) {
      console.error('Failed to create template:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (templateId: string) => {
    if (!user) return;
    if (confirm('Are you sure you want to delete this template?')) {
      dispatch(deleteTemplate({ userId: user.uid, templateId }));
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
          <Button onClick={handleOpenModal}>
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
              action={<Button onClick={handleOpenModal}>Create Template</Button>}
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
                        <IconButton icon={Edit} size="sm" />
                        <IconButton
                          icon={Trash2}
                          variant="danger"
                          size="sm"
                          onClick={() => handleDelete(templateId)}
                        />
                      </div>
                    }
                  />
                  <div className="space-y-2">
                    {template.allocations.slice(0, 5).map((alloc) => {
                      const category = categoriesById[alloc.categoryId];
                      return (
                        <div key={alloc.categoryId} className="flex justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: category?.color || '#6366f1' }}
                            />
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

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create Template" size="lg">
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
                return (
                  <div key={alloc.categoryId} className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: category?.color || '#6366f1' }}
                    />
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
              Save Template
            </Button>
          </div>
        </div>
      </Modal>
    </AppLayout>
  );
};
