import { useEffect, useState, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { AppLayout } from '../../../components/layout';
import { Card, Button, Spinner } from '../../../components/shared';
import {
  fetchDebtEntries,
  createDebtEntry,
  updateDebtEntry,
  deleteDebtEntry,
  markDebtPaid,
} from '../debtTrackingSlice';
import { DebtEntryModal } from './DebtEntryModal';
import { formatCurrency } from '../../../utils';
import { DebtEntry } from '../../../types/debtTracking';
import { Timestamp } from 'firebase/firestore';
import {
  Handshake,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  Check,
} from 'lucide-react';

const formatDate = (ts: Timestamp): string => {
  return ts.toDate().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const DebtTrackingPage = () => {
  return (
    <AppLayout title="Debt Tracker">
      <DebtTrackingContent />
    </AppLayout>
  );
};

const DebtTrackingContent = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { entries, status } = useAppSelector((state) => state.debtTracking);

  const [activeTab, setActiveTab] = useState<'i-owe' | 'they-owe'>('i-owe');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createDirection, setCreateDirection] = useState<'i-owe' | 'they-owe'>('i-owe');
  const [editEntry, setEditEntry] = useState<DebtEntry | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      dispatch(fetchDebtEntries(user.uid));
    }
  }, [dispatch, user]);

  const allEntries = useMemo(
    () => entries.allIds.map((id) => entries.byId[id]).filter(Boolean),
    [entries]
  );

  const iOweUnpaid = useMemo(
    () => allEntries.filter((e) => e.direction === 'i-owe' && !e.isPaid),
    [allEntries]
  );

  const theyOweUnpaid = useMemo(
    () => allEntries.filter((e) => e.direction === 'they-owe' && !e.isPaid),
    [allEntries]
  );

  const iOwePaid = useMemo(
    () => allEntries.filter((e) => e.direction === 'i-owe' && e.isPaid),
    [allEntries]
  );

  const theyOwePaid = useMemo(
    () => allEntries.filter((e) => e.direction === 'they-owe' && e.isPaid),
    [allEntries]
  );

  const iOweTotal = useMemo(
    () => iOweUnpaid.reduce((sum, e) => sum + e.amount, 0),
    [iOweUnpaid]
  );

  const theyOweTotal = useMemo(
    () => theyOweUnpaid.reduce((sum, e) => sum + e.amount, 0),
    [theyOweUnpaid]
  );

  const activeEntries = activeTab === 'i-owe' ? iOweUnpaid : theyOweUnpaid;
  const historyEntries = activeTab === 'i-owe' ? iOwePaid : theyOwePaid;

  const handleOpenCreate = (direction: 'i-owe' | 'they-owe') => {
    setCreateDirection(direction);
    setCreateModalOpen(true);
  };

  const handleCreate = async (entry: {
    direction: 'i-owe' | 'they-owe';
    personName: string;
    item: string;
    description?: string;
    amount: number;
    date: Timestamp;
    isPaid: boolean;
  }) => {
    if (!user) return;
    await dispatch(createDebtEntry({ userId: user.uid, entry })).unwrap();
  };

  const handleUpdate = async (entry: {
    direction: 'i-owe' | 'they-owe';
    personName: string;
    item: string;
    description?: string;
    amount: number;
    date: Timestamp;
    isPaid: boolean;
  }) => {
    if (!user || !editEntry) return;
    await dispatch(
      updateDebtEntry({
        userId: user.uid,
        entryId: editEntry.id,
        updates: {
          direction: entry.direction,
          personName: entry.personName,
          item: entry.item,
          description: entry.description,
          amount: entry.amount,
          date: entry.date,
        },
      })
    ).unwrap();
  };

  const handleDelete = async (entryId: string) => {
    if (!user) return;
    if (confirm('Delete this debt entry?')) {
      await dispatch(deleteDebtEntry({ userId: user.uid, entryId })).unwrap();
    }
  };

  const handleTogglePaid = async (entry: DebtEntry) => {
    if (!user) return;
    setTogglingId(entry.id);
    try {
      await dispatch(
        markDebtPaid({ userId: user.uid, entryId: entry.id, isPaid: !entry.isPaid })
      ).unwrap();
    } finally {
      setTogglingId(null);
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex justify-center items-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary header */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Handshake className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            <div>
              <h3 className="font-semibold text-indigo-900 dark:text-indigo-100">Debt Tracker</h3>
              <p className="text-sm text-indigo-700 dark:text-indigo-300">
                Track money you owe and money owed to you
              </p>
            </div>
          </div>
          <Button
            onClick={() => handleOpenCreate(activeTab)}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Debt
          </Button>
        </div>

        {/* Totals */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">You Owe</p>
            <p className="text-xl font-bold text-orange-600 dark:text-orange-400">
              {formatCurrency(iOweTotal)}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {iOweUnpaid.length} outstanding
            </p>
          </div>
          <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Owed to You</p>
            <p className="text-xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(theyOweTotal)}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {theyOweUnpaid.length} outstanding
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
        <button
          onClick={() => { setActiveTab('i-owe'); setShowHistory(false); }}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'i-owe'
              ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          I Owe
          {iOweUnpaid.length > 0 && (
            <span className="ml-2 bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 text-xs px-1.5 py-0.5 rounded-full">
              {iOweUnpaid.length}
            </span>
          )}
        </button>
        <button
          onClick={() => { setActiveTab('they-owe'); setShowHistory(false); }}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'they-owe'
              ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          Owed to Me
          {theyOweUnpaid.length > 0 && (
            <span className="ml-2 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 text-xs px-1.5 py-0.5 rounded-full">
              {theyOweUnpaid.length}
            </span>
          )}
        </button>
      </div>

      {/* Active entries */}
      {activeEntries.length === 0 ? (
        <Card>
          <div className="text-center py-10">
            <Handshake className="w-14 h-14 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-1">
              {activeTab === 'i-owe' ? 'Nothing you owe right now' : 'Nobody owes you right now'}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {activeTab === 'i-owe'
                ? 'Add a debt when you borrow money or split a bill.'
                : 'Add an entry when someone owes you money.'}
            </p>
            <Button
              onClick={() => handleOpenCreate(activeTab)}
              className="inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Entry
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {activeEntries.map((entry) => (
            <DebtEntryCard
              key={entry.id}
              entry={entry}
              isToggling={togglingId === entry.id}
              onTogglePaid={() => handleTogglePaid(entry)}
              onEdit={() => setEditEntry(entry)}
              onDelete={() => handleDelete(entry.id)}
            />
          ))}
        </div>
      )}

      {/* History section */}
      {historyEntries.length > 0 && (
        <div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 w-full py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
          >
            {showHistory ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
            History ({historyEntries.length} paid)
          </button>

          {showHistory && (
            <div className="space-y-3 mt-2">
              {historyEntries.map((entry) => (
                <DebtEntryCard
                  key={entry.id}
                  entry={entry}
                  isToggling={togglingId === entry.id}
                  onTogglePaid={() => handleTogglePaid(entry)}
                  onEdit={() => setEditEntry(entry)}
                  onDelete={() => handleDelete(entry.id)}
                  isPaidView
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <DebtEntryModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSubmit={handleCreate}
        initialValues={
          createModalOpen
            ? {
                direction: createDirection,
                personName: '',
                item: '',
                amount: 0,
                date: Timestamp.now(),
              }
            : undefined
        }
      />

      {editEntry && (
        <DebtEntryModal
          isOpen={!!editEntry}
          onClose={() => setEditEntry(null)}
          onSubmit={handleUpdate}
          title="Edit Debt"
          initialValues={{
            direction: editEntry.direction,
            personName: editEntry.personName,
            item: editEntry.item,
            description: editEntry.description,
            amount: editEntry.amount,
            date: editEntry.date,
          }}
        />
      )}
    </div>
  );
};

interface DebtEntryCardProps {
  entry: DebtEntry;
  isToggling: boolean;
  onTogglePaid: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isPaidView?: boolean;
}

const DebtEntryCard = ({
  entry,
  isToggling,
  onTogglePaid,
  onEdit,
  onDelete,
  isPaidView = false,
}: DebtEntryCardProps) => {
  return (
    <Card>
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          <button
            onClick={onTogglePaid}
            disabled={isToggling}
            className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
              entry.isPaid
                ? 'bg-green-500 border-green-500 dark:bg-green-600 dark:border-green-600'
                : 'border-gray-300 dark:border-gray-500 hover:border-indigo-400 dark:hover:border-indigo-500'
            } ${isToggling ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            title={entry.isPaid ? 'Mark as unpaid' : 'Mark as paid'}
          >
            {entry.isPaid && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p
                  className={`font-semibold text-gray-900 dark:text-gray-100 truncate ${
                    isPaidView ? 'line-through text-gray-400 dark:text-gray-500' : ''
                  }`}
                >
                  {entry.personName}
                </p>
                <p
                  className={`text-sm truncate ${
                    isPaidView
                      ? 'text-gray-400 dark:text-gray-500 line-through'
                      : 'text-gray-600 dark:text-gray-300'
                  }`}
                >
                  {entry.item}
                  <span className="mx-1.5 text-gray-300 dark:text-gray-600">·</span>
                  <span className="text-gray-400 dark:text-gray-500">{formatDate(entry.date)}</span>
                </p>
                {entry.description && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                    {entry.description}
                  </p>
                )}
                {isPaidView && entry.paidDate && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                    Paid {formatDate(entry.paidDate)}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <span
                  className={`font-bold text-base ${
                    isPaidView
                      ? 'text-gray-400 dark:text-gray-500 line-through'
                      : entry.direction === 'i-owe'
                      ? 'text-orange-600 dark:text-orange-400'
                      : 'text-green-600 dark:text-green-400'
                  }`}
                >
                  {formatCurrency(entry.amount)}
                </span>
                <button
                  onClick={onEdit}
                  className="p-1.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  title="Edit"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={onDelete}
                  className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
