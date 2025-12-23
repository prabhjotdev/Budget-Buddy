import { useState, useRef } from 'react';
import { Upload, FileText, AlertCircle, Check, X, Filter, Calendar } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { addTransaction } from '../../features/transactions/transactionsSlice';
import { updateAllocationSpent } from '../../features/budget-periods/budgetPeriodsSlice';
import { Modal, Button, Select } from '../shared';
import { parseCSV, readFileAsText, ParsedTransaction, ParseResult } from '../../utils/csvParser';
import { formatCurrency } from '../../utils/currency';
import { formatShortDate, formatPeriodRange, toDate } from '../../utils/date';

interface ImportTransactionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TransactionToImport extends ParsedTransaction {
  selected: boolean;
  categoryId: string;
  outOfPeriod: boolean;
}

export const ImportTransactionsModal = ({ isOpen, onClose }: ImportTransactionsModalProps) => {
  const dispatch = useAppDispatch();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { user } = useAppSelector((state) => state.auth);
  const { activePeriodId, allocationsByPeriodId, byId: periodsById } = useAppSelector((state) => state.budgetPeriods);
  const { byId: categoriesById, allIds: categoryIds } = useAppSelector((state) => state.categories);
  const { data: settings } = useAppSelector((state) => state.settings);
  const timezone = settings?.timezone;

  // Get active period dates
  const activePeriod = activePeriodId ? periodsById[activePeriodId] : null;
  const periodStart = activePeriod ? toDate(activePeriod.startDate) : null;
  const periodEnd = activePeriod ? toDate(activePeriod.endDate) : null;

  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [transactions, setTransactions] = useState<TransactionToImport[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [showExcluded, setShowExcluded] = useState(false);
  const [showOutOfPeriod, setShowOutOfPeriod] = useState(false);
  const [importComplete, setImportComplete] = useState(false);
  const [importedCount, setImportedCount] = useState(0);

  const allocations = activePeriodId ? allocationsByPeriodId[activePeriodId] : null;

  // Check if date is within period
  const isDateInPeriod = (date: Date): boolean => {
    if (!periodStart || !periodEnd) return true;
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const startOnly = new Date(periodStart.getFullYear(), periodStart.getMonth(), periodStart.getDate());
    const endOnly = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), periodEnd.getDate());
    return dateOnly >= startOnly && dateOnly <= endOnly;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const content = await readFileAsText(file);
      const result = parseCSV(content);
      setParseResult(result);

      // Initialize transactions with selection, default category, and period check
      const defaultCategoryId = categoryIds[0] || '';
      const txs: TransactionToImport[] = result.transactions.map(tx => {
        const outOfPeriod = !isDateInPeriod(tx.date);
        return {
          ...tx,
          selected: !tx.excluded && !outOfPeriod, // Pre-select non-excluded, in-period transactions
          categoryId: defaultCategoryId,
          outOfPeriod,
        };
      });
      setTransactions(txs);
      setImportComplete(false);
      setImportedCount(0);
    } catch (error) {
      console.error('Failed to parse file:', error);
    }
  };

  const handleToggleSelect = (index: number) => {
    setTransactions(prev =>
      prev.map((tx, i) => (i === index ? { ...tx, selected: !tx.selected } : tx))
    );
  };

  const handleSelectAll = (selected: boolean) => {
    setTransactions(prev =>
      prev.map(tx => ({
        ...tx,
        selected: showExcluded ? selected : (tx.excluded ? tx.selected : selected),
      }))
    );
  };

  const handleCategoryChange = (index: number, categoryId: string) => {
    setTransactions(prev =>
      prev.map((tx, i) => (i === index ? { ...tx, categoryId } : tx))
    );
  };

  const handleBulkCategoryChange = (categoryId: string) => {
    setTransactions(prev =>
      prev.map(tx => (tx.selected ? { ...tx, categoryId } : tx))
    );
  };

  const handleTypeChange = (index: number, type: 'expense' | 'income') => {
    setTransactions(prev =>
      prev.map((tx, i) => (i === index ? { ...tx, type } : tx))
    );
  };

  const handleBulkTypeChange = (type: 'expense' | 'income') => {
    setTransactions(prev =>
      prev.map(tx => (tx.selected ? { ...tx, type } : tx))
    );
  };

  const handleImport = async () => {
    if (!user || !activePeriodId) return;

    const toImport = transactions.filter(tx => tx.selected && tx.categoryId);
    if (toImport.length === 0) return;

    setIsImporting(true);

    try {
      for (const tx of toImport) {
        const category = categoriesById[tx.categoryId];

        await dispatch(
          addTransaction({
            userId: user.uid,
            transaction: {
              budgetPeriodId: activePeriodId,
              categoryId: tx.categoryId,
              categoryName: category?.name || 'Unknown',
              type: tx.type,
              amount: tx.amount,
              description: tx.description,
              date: tx.date,
            },
          })
        );

        // Update allocation if expense
        if (tx.type === 'expense' && allocations) {
          const allocationId = allocations.allIds.find(
            id => allocations.byId[id].categoryId === tx.categoryId
          );
          if (allocationId) {
            dispatch(
              updateAllocationSpent({
                periodId: activePeriodId,
                allocationId,
                amount: tx.amount,
              })
            );
          }
        }
      }

      setImportedCount(toImport.length);
      setImportComplete(true);
    } catch (error) {
      console.error('Failed to import transactions:', error);
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setParseResult(null);
    setTransactions([]);
    setImportComplete(false);
    setImportedCount(0);
    setShowExcluded(false);
    setShowOutOfPeriod(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  const visibleTransactions = transactions.filter(tx => {
    if (!showExcluded && tx.excluded) return false;
    if (!showOutOfPeriod && tx.outOfPeriod) return false;
    return true;
  });

  const selectedCount = transactions.filter(tx => tx.selected).length;
  const excludedCount = transactions.filter(tx => tx.excluded).length;
  const outOfPeriodCount = transactions.filter(tx => tx.outOfPeriod).length;
  const inPeriodCount = transactions.filter(tx => !tx.outOfPeriod && !tx.excluded).length;
  const totalExpenses = transactions
    .filter(tx => tx.selected && tx.type === 'expense')
    .reduce((sum, tx) => sum + tx.amount, 0);
  const totalIncome = transactions
    .filter(tx => tx.selected && tx.type === 'income')
    .reduce((sum, tx) => sum + tx.amount, 0);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Import Transactions" size="xl">
      <div className="space-y-4">
        {/* File Upload */}
        {!parseResult && (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
              id="csv-upload"
            />
            <label htmlFor="csv-upload" className="cursor-pointer">
              <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-lg font-medium text-gray-700">Upload CSV File</p>
              <p className="text-sm text-gray-500 mt-1">
                Supports TD, RBC, Amex, and other bank formats
              </p>
              <Button variant="secondary" className="mt-4" onClick={() => fileInputRef.current?.click()}>
                Select File
              </Button>
            </label>
          </div>
        )}

        {/* Import Complete */}
        {importComplete && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
            <Check className="w-12 h-12 mx-auto text-green-500 mb-2" />
            <p className="text-lg font-medium text-green-700">
              Successfully imported {importedCount} transactions!
            </p>
            <Button variant="secondary" className="mt-4" onClick={handleClose}>
              Close
            </Button>
          </div>
        )}

        {/* Parse Results */}
        {parseResult && !importComplete && (
          <>
            {/* Bank Detection & Period Info */}
            <div className="bg-gray-50 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-gray-500" />
                  <span className="text-sm text-gray-700">
                    Detected format: <strong>{parseResult.bank}</strong>
                  </span>
                  <span className="text-sm text-gray-500">
                    ({transactions.length} transactions found)
                  </span>
                </div>
              </div>

              {/* Active Period Info */}
              {activePeriod && periodStart && periodEnd && (
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-500" />
                  <span className="text-sm text-gray-700">
                    Active period: <strong>{formatPeriodRange(periodStart, periodEnd, timezone)}</strong>
                  </span>
                  <span className="text-sm text-green-600">
                    ({inPeriodCount} in period)
                  </span>
                </div>
              )}

              {/* Filter toggles */}
              <div className="flex flex-wrap items-center gap-4 pt-1">
                {outOfPeriodCount > 0 && (
                  <button
                    onClick={() => setShowOutOfPeriod(!showOutOfPeriod)}
                    className="flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700"
                  >
                    <Filter className="w-4 h-4" />
                    {showOutOfPeriod ? 'Hide' : 'Show'} {outOfPeriodCount} outside period
                  </button>
                )}
                {excludedCount > 0 && (
                  <button
                    onClick={() => setShowExcluded(!showExcluded)}
                    className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-700"
                  >
                    <Filter className="w-4 h-4" />
                    {showExcluded ? 'Hide' : 'Show'} {excludedCount} excluded
                  </button>
                )}
              </div>
            </div>

            {/* Errors */}
            {parseResult.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-red-700">
                  <AlertCircle className="w-5 h-5" />
                  <span className="font-medium">Parsing errors:</span>
                </div>
                <ul className="mt-2 text-sm text-red-600 list-disc list-inside">
                  {parseResult.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Bulk Actions */}
            <div className="flex flex-wrap items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedCount === visibleTransactions.length && visibleTransactions.length > 0}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-600">Select All</span>
              </div>
              <div className="flex-1" />
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Set type:</span>
                <button
                  onClick={() => handleBulkTypeChange('expense')}
                  className="px-2 py-1 text-xs font-medium rounded bg-red-100 text-red-700 hover:bg-red-200"
                >
                  Expense
                </button>
                <button
                  onClick={() => handleBulkTypeChange('income')}
                  className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-700 hover:bg-green-200"
                >
                  Income
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Category:</span>
                <select
                  onChange={(e) => handleBulkCategoryChange(e.target.value)}
                  className="text-sm border border-gray-300 rounded-md px-2 py-1"
                  defaultValue=""
                >
                  <option value="" disabled>Choose...</option>
                  {categoryIds.map(id => (
                    <option key={id} value={id}>
                      {categoriesById[id]?.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* No Active Period Warning */}
            {!activePeriodId && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                <span className="text-sm text-yellow-700">
                  No active budget period. Please create one before importing.
                </span>
              </div>
            )}

            {/* Transactions List */}
            <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
              {visibleTransactions.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No transactions to display
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="w-10 px-3 py-2"></th>
                      <th className="px-3 py-2 text-left text-gray-600">Date</th>
                      <th className="px-3 py-2 text-left text-gray-600">Description</th>
                      <th className="px-3 py-2 text-right text-gray-600">Amount</th>
                      <th className="px-3 py-2 text-center text-gray-600">Type</th>
                      <th className="px-3 py-2 text-left text-gray-600">Category</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {visibleTransactions.map((tx, index) => {
                      const actualIndex = transactions.indexOf(tx);
                      const rowClass = tx.excluded
                        ? 'bg-gray-50 text-gray-400'
                        : tx.outOfPeriod
                          ? 'bg-orange-50 text-orange-700'
                          : tx.selected
                            ? 'bg-indigo-50'
                            : '';
                      return (
                        <tr key={index} className={rowClass}>
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={tx.selected}
                              onChange={() => handleToggleSelect(actualIndex)}
                              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {formatShortDate(tx.date, timezone)}
                            {tx.outOfPeriod && (
                              <span className="ml-1 inline-block px-1.5 py-0.5 text-xs bg-orange-100 text-orange-700 rounded">
                                Outside period
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <div className="max-w-xs truncate" title={tx.description}>
                              {tx.description}
                            </div>
                            {tx.excluded && (
                              <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                                {tx.excludeReason}
                              </span>
                            )}
                          </td>
                          <td className={`px-3 py-2 text-right whitespace-nowrap font-medium ${
                            tx.type === 'expense' ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {tx.type === 'expense' ? '-' : '+'}
                            {formatCurrency(tx.amount)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={() => handleTypeChange(actualIndex, tx.type === 'expense' ? 'income' : 'expense')}
                              className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                                tx.type === 'expense'
                                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                  : 'bg-green-100 text-green-700 hover:bg-green-200'
                              }`}
                            >
                              {tx.type === 'expense' ? 'Expense' : 'Income'}
                            </button>
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={tx.categoryId}
                              onChange={(e) => handleCategoryChange(actualIndex, e.target.value)}
                              className="w-full text-sm border border-gray-300 rounded-md px-2 py-1"
                              disabled={tx.excluded && !tx.selected}
                            >
                              <option value="">Select...</option>
                              {categoryIds.map(id => (
                                <option key={id} value={id}>
                                  {categoriesById[id]?.name}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Summary */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600">
                <span className="font-medium">{selectedCount}</span> transactions selected
                {selectedCount > 0 && (
                  <>
                    {' '}
                    (Expenses: <span className="text-red-600">{formatCurrency(totalExpenses)}</span>,
                    Income: <span className="text-green-600">{formatCurrency(totalIncome)}</span>)
                  </>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  onClick={handleImport}
                  isLoading={isImporting}
                  disabled={selectedCount === 0 || !activePeriodId}
                >
                  Import {selectedCount} Transactions
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
