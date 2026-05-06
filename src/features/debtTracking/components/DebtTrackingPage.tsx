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
  ChevronRight,
  Check,
  CheckCheck,
} from 'lucide-react';

const formatDate = (ts: Timestamp): string => {
  return ts.toDate().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

interface PersonGroup {
  personName: string;
  entries: DebtEntry[];
  total: number;
}

const groupByPerson = (entries: DebtEntry[]): PersonGroup[] => {
  const map = new Map<string, DebtEntry[]>();
  for (const entry of entries) {
    const list = map.get(entry.personName) ?? [];
    list.push(entry);
    map.set(entry.personName, list);
  }
  return Array.from(map.entries())
    .map(([personName, grouped]) => ({
      personName,
      entries: [...grouped].sort((a, b) => b.date.seconds - a.date.seconds),
      total: grouped.reduce((s, e) => s + e.amount, 0),
    }))
    .sort((a, b) => {
      const aLatest = Math.max(...a.entries.map((e) => e.date.seconds));
      const bLatest = Math.max(...b.entries.map((e) => e.date.seconds));
      return bLatest - aLatest;
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
  const [prefillPersonName, setPrefillPersonName] = useState('');
  const [lockPersonName, setLockPersonName] = useState(false);
  const [editEntry, setEditEntry] = useState<DebtEntry | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [markingAllPaidFor, setMarkingAllPaidFor] = useState<string | null>(null);
  const [expandedPersons, setExpandedPersons] = useState<Set<string>>(new Set());

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
    () => iOweUnpaid.reduce((s, e) => s + e.amount, 0),
    [iOweUnpaid]
  );
  const theyOweTotal = useMemo(
    () => theyOweUnpaid.reduce((s, e) => s + e.amount, 0),
    [theyOweUnpaid]
  );

  const activeEntries = activeTab === 'i-owe' ? iOweUnpaid : theyOweUnpaid;
  const historyEntries = activeTab === 'i-owe' ? iOwePaid : theyOwePaid;

  const activeGroups = useMemo(() => groupByPerson(activeEntries), [activeEntries]);
  const historyGroups = useMemo(() => groupByPerson(historyEntries), [historyEntries]);

  const allPersonNames = useMemo(() => {
    const names = new Set(allEntries.map((e) => e.personName));
    return Array.from(names).sort();
  }, [allEntries]);

  const togglePerson = (key: string) => {
    setExpandedPersons((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleOpenCreate = (
    direction: 'i-owe' | 'they-owe',
    personName = '',
    locked = false
  ) => {
    setCreateDirection(direction);
    setPrefillPersonName(personName);
    setLockPersonName(locked);
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

  const handleMarkAllPaid = async (personName: string, groupEntries: DebtEntry[]) => {
    if (!user) return;
    const unpaid = groupEntries.filter((e) => !e.isPaid);
    if (unpaid.length === 0) return;
    setMarkingAllPaidFor(personName);
    try {
      await Promise.all(
        unpaid.map((e) =>
          dispatch(markDebtPaid({ userId: user.uid, entryId: e.id, isPaid: true })).unwrap()
        )
      );
    } finally {
      setMarkingAllPaidFor(null);
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
          onClick={() => {
            setActiveTab('i-owe');
            setShowHistory(false);
          }}
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
          onClick={() => {
            setActiveTab('they-owe');
            setShowHistory(false);
          }}
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

      {/* Active entries grouped by person */}
      {activeGroups.length === 0 ? (
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
          {activeGroups.map((group) => (
            <PersonGroupCard
              key={group.personName}
              group={group}
              direction={activeTab}
              isExpanded={expandedPersons.has(group.personName)}
              onToggle={() => togglePerson(group.personName)}
              onAddDebt={() => handleOpenCreate(activeTab, group.personName, true)}
              onMarkAllPaid={() => handleMarkAllPaid(group.personName, group.entries)}
              isMarkingAllPaid={markingAllPaidFor === group.personName}
              onTogglePaid={handleTogglePaid}
              onEdit={setEditEntry}
              onDelete={handleDelete}
              togglingId={togglingId}
            />
          ))}
        </div>
      )}

      {/* History section */}
      {historyGroups.length > 0 && (
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
              {historyGroups.map((group) => (
                <PersonGroupCard
                  key={group.personName}
                  group={group}
                  direction={activeTab}
                  isExpanded={expandedPersons.has(`history:${group.personName}`)}
                  onToggle={() => togglePerson(`history:${group.personName}`)}
                  onAddDebt={() => handleOpenCreate(activeTab, group.personName, true)}
                  isMarkingAllPaid={false}
                  onTogglePaid={handleTogglePaid}
                  onEdit={setEditEntry}
                  onDelete={handleDelete}
                  togglingId={togglingId}
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
        existingPersonNames={allPersonNames}
        lockedPersonName={lockPersonName ? prefillPersonName : undefined}
        initialValues={
          createModalOpen
            ? {
                direction: createDirection,
                personName: prefillPersonName,
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
          existingPersonNames={allPersonNames}
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

interface PersonGroupCardProps {
  group: PersonGroup;
  direction: 'i-owe' | 'they-owe';
  isExpanded: boolean;
  onToggle: () => void;
  onAddDebt: () => void;
  onMarkAllPaid?: () => void;
  isMarkingAllPaid: boolean;
  onTogglePaid: (entry: DebtEntry) => void;
  onEdit: (entry: DebtEntry) => void;
  onDelete: (id: string) => void;
  togglingId: string | null;
  isPaidView?: boolean;
}

const PersonGroupCard = ({
  group,
  direction,
  isExpanded,
  onToggle,
  onAddDebt,
  onMarkAllPaid,
  isMarkingAllPaid,
  onTogglePaid,
  onEdit,
  onDelete,
  togglingId,
  isPaidView = false,
}: PersonGroupCardProps) => {
  const amountColor = isPaidView
    ? 'text-gray-400 dark:text-gray-500'
    : direction === 'i-owe'
    ? 'text-orange-600 dark:text-orange-400'
    : 'text-green-600 dark:text-green-400';

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800">
      {/* Person header row */}
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-800/80">
        <button
          onClick={onToggle}
          className="flex-1 flex items-center gap-2 text-left min-w-0"
        >
          <ChevronRight
            className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${
              isExpanded ? 'rotate-90' : ''
            }`}
          />
          <span className="font-semibold text-gray-900 dark:text-gray-100 truncate">
            {group.personName}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
            {group.entries.length} {group.entries.length === 1 ? 'item' : 'items'}
          </span>
        </button>

        <div className="flex items-center gap-1 flex-shrink-0">
          <span className={`font-bold text-sm mr-1 ${amountColor}`}>
            {formatCurrency(group.total)}
          </span>
          {!isPaidView && onMarkAllPaid && (
            <button
              onClick={onMarkAllPaid}
              disabled={isMarkingAllPaid}
              title="Mark all paid"
              className="p-1.5 text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-colors disabled:opacity-40"
            >
              <CheckCheck className="w-4 h-4" />
            </button>
          )}
          {!isPaidView && (
            <button
              onClick={onAddDebt}
              title="Add debt for this person"
              className="p-1.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Debt rows (visible when expanded) */}
      {isExpanded && (
        <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
          {group.entries.map((entry) => (
            <DebtItemRow
              key={entry.id}
              entry={entry}
              direction={direction}
              isToggling={togglingId === entry.id}
              onTogglePaid={() => onTogglePaid(entry)}
              onEdit={() => onEdit(entry)}
              onDelete={() => onDelete(entry.id)}
              isPaidView={isPaidView}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface DebtItemRowProps {
  entry: DebtEntry;
  direction: 'i-owe' | 'they-owe';
  isToggling: boolean;
  onTogglePaid: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isPaidView?: boolean;
}

const DebtItemRow = ({
  entry,
  direction,
  isToggling,
  onTogglePaid,
  onEdit,
  onDelete,
  isPaidView = false,
}: DebtItemRowProps) => {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <button
        onClick={onTogglePaid}
        disabled={isToggling}
        className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
          entry.isPaid
            ? 'bg-green-500 border-green-500 dark:bg-green-600 dark:border-green-600'
            : 'border-gray-300 dark:border-gray-500 hover:border-indigo-400 dark:hover:border-indigo-500'
        } ${isToggling ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        title={entry.isPaid ? 'Mark as unpaid' : 'Mark as paid'}
      >
        {entry.isPaid && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
      </button>

      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium truncate ${
            isPaidView
              ? 'line-through text-gray-400 dark:text-gray-500'
              : 'text-gray-900 dark:text-gray-100'
          }`}
        >
          {entry.item}
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
          {formatDate(entry.date)}
          {entry.description && <span> · {entry.description}</span>}
        </p>
        {isPaidView && entry.paidDate && (
          <p className="text-xs text-green-600 dark:text-green-400">
            Paid {formatDate(entry.paidDate)}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <span
          className={`font-bold text-sm ${
            isPaidView
              ? 'text-gray-400 dark:text-gray-500 line-through'
              : direction === 'i-owe'
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
  );
};
