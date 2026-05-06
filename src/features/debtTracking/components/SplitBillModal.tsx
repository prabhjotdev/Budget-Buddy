import { useState, useEffect, useRef } from 'react';
import { Timestamp } from 'firebase/firestore';
import { Modal, Input, CurrencyInput, Button } from '../../../components/shared';
import { formatCurrency } from '../../../utils';
import { Plus, X } from 'lucide-react';

interface SplitBillEntry {
  direction: 'they-owe';
  personName: string;
  item: string;
  description?: string;
  amount: number;
  date: Timestamp;
  isPaid: false;
}

interface SplitBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (entries: SplitBillEntry[]) => Promise<void>;
  existingPersonNames?: string[];
}

interface PersonRowProps {
  index: number;
  value: string;
  onChange: (index: number, value: string) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
  existingPersonNames: string[];
  isDuplicate: boolean;
  isDropdownOpen: boolean;
  onOpen: (index: number) => void;
  onClose: () => void;
  onSelect: (index: number, name: string) => void;
}

const PersonRow = ({
  index,
  value,
  onChange,
  onRemove,
  canRemove,
  existingPersonNames,
  isDuplicate,
  isDropdownOpen,
  onOpen,
  onClose,
  onSelect,
}: PersonRowProps) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const filteredNames = existingPersonNames.filter((n) =>
    n.toLowerCase().includes(value.toLowerCase())
  );

  return (
    <div className="flex gap-2 items-start">
      <div
        className="relative flex-1"
        ref={rowRef}
        onFocus={() => onOpen(index)}
        onBlur={(e) => {
          if (!rowRef.current?.contains(e.relatedTarget as Node)) {
            onClose();
          }
        }}
      >
        <Input
          placeholder="Person's name"
          value={value}
          onChange={(e) => onChange(index, e.target.value)}
          autoComplete="off"
          error={isDuplicate ? 'Duplicate name' : undefined}
        />
        {isDropdownOpen && filteredNames.length > 0 && (
          <div className="absolute z-20 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto">
            {filteredNames.map((name) => (
              <button
                key={name}
                type="button"
                onMouseDown={() => {
                  onSelect(index, name);
                  onClose();
                }}
                className="w-full text-left px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors first:rounded-t-lg last:rounded-b-lg"
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </div>
      {canRemove && (
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="mt-2.5 p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors flex-shrink-0"
          title="Remove person"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export const SplitBillModal = ({
  isOpen,
  onClose,
  onSubmit,
  existingPersonNames = [],
}: SplitBillModalProps) => {
  const [totalAmount, setTotalAmount] = useState(0);
  const [item, setItem] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [people, setPeople] = useState<string[]>(['']);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openDropdownIdx, setOpenDropdownIdx] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTotalAmount(0);
      setItem('');
      setDescription('');
      setDate(new Date().toISOString().split('T')[0]);
      setPeople(['']);
      setError(null);
    }
    setOpenDropdownIdx(null);
  }, [isOpen]);

  const validPeople = people.map((p) => p.trim()).filter(Boolean);
  const hasDuplicates = new Set(validPeople).size !== validPeople.length;
  const perShare = validPeople.length > 0 ? totalAmount / (validPeople.length + 1) : 0;
  const isValid =
    totalAmount > 0 && item.trim() && date && validPeople.length > 0 && !hasDuplicates;

  const addPerson = () => setPeople((prev) => [...prev, '']);

  const updatePerson = (idx: number, val: string) =>
    setPeople((prev) => prev.map((p, i) => (i === idx ? val : p)));

  const removePerson = (idx: number) =>
    setPeople((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    if (!isValid) return;
    setSubmitting(true);
    setError(null);
    try {
      const share = totalAmount / (validPeople.length + 1);
      const dateTs = Timestamp.fromDate(new Date(date + 'T00:00:00'));
      const entries: SplitBillEntry[] = validPeople.map((name) => ({
        direction: 'they-owe',
        personName: name,
        item: item.trim(),
        description: description.trim() || undefined,
        amount: share,
        date: dateTs,
        isPaid: false,
      }));
      await onSubmit(entries);
      onClose();
    } catch {
      setError('Some entries may not have saved. Please check and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const entryLabel = validPeople.length === 1 ? 'entry' : 'entries';
  const personLabel = validPeople.length === 1 ? 'person' : 'people';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Split Bill" size="lg">
      <div className="space-y-4">
        <CurrencyInput
          label="Total Amount You Paid"
          value={totalAmount}
          onChange={setTotalAmount}
          placeholder="0.00"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Item"
            placeholder="e.g. Dinner, Concert tickets"
            value={item}
            onChange={(e) => setItem(e.target.value)}
          />
          <Input
            label="Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <Input
          label="Description (optional)"
          placeholder="Any extra details"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        {/* People list */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Split with
          </label>
          <div className="space-y-2">
            {people.map((person, idx) => {
              const trimmed = person.trim();
              const isDuplicate =
                trimmed !== '' &&
                validPeople.filter((p) => p === trimmed).length > 1;
              return (
                <PersonRow
                  key={idx}
                  index={idx}
                  value={person}
                  onChange={updatePerson}
                  onRemove={removePerson}
                  canRemove={people.length > 1}
                  existingPersonNames={existingPersonNames}
                  isDuplicate={isDuplicate}
                  isDropdownOpen={openDropdownIdx === idx}
                  onOpen={setOpenDropdownIdx}
                  onClose={() => setOpenDropdownIdx(null)}
                  onSelect={(i, name) => updatePerson(i, name)}
                />
              );
            })}
          </div>
          <button
            type="button"
            onClick={addPerson}
            className="mt-2 flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Person
          </button>
        </div>

        {/* Live preview */}
        {perShare > 0 && validPeople.length > 0 && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 text-sm text-green-700 dark:text-green-300">
            <span className="font-semibold">{formatCurrency(perShare)}</span>
            {' '}each — split {validPeople.length + 1} ways ({validPeople.length} {personLabel} + you)
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid}
            isLoading={submitting}
            className="flex-1"
          >
            Split Bill ({validPeople.length} {entryLabel})
          </Button>
        </div>
      </div>
    </Modal>
  );
};
