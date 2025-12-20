import { useState } from 'react';
import { Plus, Trash2, Edit, DollarSign } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { createIncomeSource, deleteIncomeSource, updateIncomeSource } from '../incomeSourcesSlice';
import { AppLayout } from '../../../components/layout';
import { Card, CardHeader, Button, Input, CurrencyInput, Select, EmptyState, IconButton, Modal, Badge } from '../../../components/shared';
import { formatCurrency } from '../../../utils/currency';

export const IncomePage = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { byId, allIds } = useAppSelector((state) => state.incomeSources);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [defaultAmount, setDefaultAmount] = useState(0);
  const [frequency, setFrequency] = useState<'per-period' | 'monthly' | 'variable'>('per-period');
  const [assignToPeriod, setAssignToPeriod] = useState<1 | 15 | 'both'>('both');
  const [isLoading, setIsLoading] = useState(false);

  const handleOpenModal = (sourceId?: string) => {
    if (sourceId) {
      const source = byId[sourceId];
      setEditingId(sourceId);
      setName(source.name);
      setDefaultAmount(source.defaultAmount);
      setFrequency(source.frequency);
      setAssignToPeriod(source.assignToPeriod);
    } else {
      setEditingId(null);
      setName('');
      setDefaultAmount(0);
      setFrequency('per-period');
      setAssignToPeriod('both');
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!user || !name) return;

    setIsLoading(true);
    try {
      if (editingId) {
        await dispatch(
          updateIncomeSource({
            userId: user.uid,
            sourceId: editingId,
            updates: { name, defaultAmount, frequency, assignToPeriod },
          })
        );
      } else {
        await dispatch(
          createIncomeSource({
            userId: user.uid,
            source: { name, defaultAmount, frequency, assignToPeriod, isActive: true },
          })
        );
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error('Failed to save income source:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (sourceId: string) => {
    if (!user) return;
    if (confirm('Are you sure you want to delete this income source?')) {
      dispatch(deleteIncomeSource({ userId: user.uid, sourceId }));
    }
  };

  const getFrequencyLabel = (freq: string) => {
    switch (freq) {
      case 'per-period': return 'Per Period';
      case 'monthly': return 'Monthly';
      case 'variable': return 'Variable';
      default: return freq;
    }
  };

  const getPeriodLabel = (period: 1 | 15 | 'both') => {
    switch (period) {
      case 1: return '1st Period';
      case 15: return '15th Period';
      case 'both': return 'Both Periods';
      default: return period;
    }
  };

  return (
    <AppLayout title="Income Sources">
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button onClick={() => handleOpenModal()}>
            <Plus className="w-4 h-4 mr-2" />
            Add Income Source
          </Button>
        </div>

        {allIds.length === 0 ? (
          <Card>
            <EmptyState
              icon={DollarSign}
              title="No Income Sources"
              description="Add your income sources to track earnings per pay period."
              action={<Button onClick={() => handleOpenModal()}>Add Income Source</Button>}
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allIds.map((sourceId) => {
              const source = byId[sourceId];
              return (
                <Card key={sourceId}>
                  <CardHeader
                    title={source.name}
                    action={
                      <div className="flex gap-2">
                        <IconButton icon={Edit} size="sm" onClick={() => handleOpenModal(sourceId)} />
                        <IconButton
                          icon={Trash2}
                          variant="danger"
                          size="sm"
                          onClick={() => handleDelete(sourceId)}
                        />
                      </div>
                    }
                  />
                  <div className="space-y-3">
                    <div>
                      <p className="text-2xl font-bold text-gray-900">
                        {formatCurrency(source.defaultAmount)}
                      </p>
                      <p className="text-sm text-gray-500">Default amount</p>
                    </div>
                    <div className="flex gap-2">
                      <Badge>{getFrequencyLabel(source.frequency)}</Badge>
                      <Badge variant="info">{getPeriodLabel(source.assignToPeriod)}</Badge>
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
        title={editingId ? 'Edit Income Source' : 'Add Income Source'}
      >
        <div className="space-y-4">
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Primary Job, Freelance"
          />
          <CurrencyInput
            label="Default Amount (Net)"
            value={defaultAmount}
            onChange={setDefaultAmount}
          />
          <Select
            label="Frequency"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as typeof frequency)}
            options={[
              { value: 'per-period', label: 'Per Period' },
              { value: 'monthly', label: 'Monthly' },
              { value: 'variable', label: 'Variable' },
            ]}
          />
          <Select
            label="Assign to Period"
            value={String(assignToPeriod)}
            onChange={(e) => {
              const val = e.target.value;
              setAssignToPeriod(val === 'both' ? 'both' : Number(val) as 1 | 15);
            }}
            options={[
              { value: 'both', label: 'Both Periods' },
              { value: '1', label: '1st Period Only' },
              { value: '15', label: '15th Period Only' },
            ]}
          />

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} isLoading={isLoading} disabled={!name}>
              {editingId ? 'Update' : 'Add'} Source
            </Button>
          </div>
        </div>
      </Modal>
    </AppLayout>
  );
};
