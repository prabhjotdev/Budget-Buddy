import { useState, useMemo, useEffect, ChangeEvent, useRef } from 'react';
import { AlertTriangle, Trash2, Settings as SettingsIcon, Check, Moon, Sun, Download, Upload } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { updateSettings } from '../settingsSlice';
import { clearPaycheckCycles } from '../../paycheck/paycheckCyclesSlice';
import { clearBuffer } from '../../paycheck/bufferSlice';
import { clearEmergencyFund } from '../../emergencyFund/emergencyFundSlice';
import { AppLayout } from '../../../components/layout';
import { Card, CardHeader, Button, Input, Select, Modal, ConfirmDialog } from '../../../components/shared';
import { PaycheckSetup } from '../../paycheck/components';
import { resetAllData } from '../../../services/firebase/dataReset';
import { exportAllData, importAllData, downloadDataAsJson, readJsonFile } from '../../../services/firebase/dataExportImport';
import { useTheme } from '../../../context/ThemeContext';

// App version - update this when releasing new versions
const APP_VERSION = '1.0.0';

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
  const { theme, toggleTheme } = useTheme();

  // General settings state
  const [currency, setCurrency] = useState(settings?.currency || 'USD');
  const [timezone, setTimezone] = useState(settings?.timezone || getBrowserTimezone());
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Reset data state
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetResult, setResetResult] = useState<{ success: boolean; message: string } | null>(null);

  // Export/Import state
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state with loaded settings
  useEffect(() => {
    if (settings) {
      setCurrency(settings.currency || 'USD');
      setTimezone(settings.timezone || getBrowserTimezone());
    }
  }, [settings]);

  const timezoneOptions = useMemo(() => {
    const timezones = getTimezones();
    return timezones.map((tz) => ({
      value: tz,
      label: tz.replace(/_/g, ' '),
    }));
  }, []);

  const handleSaveGeneralSettings = async () => {
    if (!user) return;

    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await dispatch(
        updateSettings({
          userId: user.uid,
          updates: {
            currency,
            timezone,
          },
        })
      ).unwrap();

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetAllData = async () => {
    if (!user || resetConfirmText !== 'DELETE') return;

    setIsResetting(true);
    setResetResult(null);

    try {
      const result = await resetAllData(user.uid);

      // Clear Redux state
      dispatch(clearPaycheckCycles());
      dispatch(clearBuffer());
      dispatch(clearEmergencyFund());

      setResetResult({
        success: true,
        message: `Successfully deleted ${result.totalDocumentsDeleted} records from ${result.collectionsCleared.length} collections.`,
      });

      // Close modal after a delay
      setTimeout(() => {
        setResetModalOpen(false);
        setResetConfirmText('');
        setResetResult(null);
        // Reload the page to refresh all state
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('Failed to reset data:', error);
      setResetResult({
        success: false,
        message: 'Failed to reset data. Please try again.',
      });
    } finally {
      setIsResetting(false);
    }
  };

  const handleExportData = async () => {
    if (!user) return;

    setIsExporting(true);
    try {
      const data = await exportAllData(user.uid);
      downloadDataAsJson(data);
    } catch (error) {
      console.error('Failed to export data:', error);
      setExportError(true);
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setIsImporting(true);
    setImportResult(null);
    setImportModalOpen(true);

    try {
      const data = await readJsonFile(file);

      // Import the data (merge by default)
      const result = await importAllData(user.uid, data, false);

      setImportResult({
        success: result.success,
        message: result.message,
      });

      if (result.success) {
        // Reload the page after a delay to refresh all state
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to import data:', error);
      setImportResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to import data. Please try again.',
      });
    } finally {
      setIsImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <AppLayout title="Settings">
      <div className="max-w-2xl space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-800 dark:to-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <SettingsIcon className="w-6 h-6 text-gray-600 dark:text-gray-400" />
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">App Settings</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Configure your paycheck schedule, preferences, and account settings.
              </p>
            </div>
          </div>
        </div>

        {/* Paycheck Schedule Setup */}
        <PaycheckSetup />

        {/* General Settings */}
        <Card>
          <CardHeader title="General Settings" subtitle="Currency, timezone, and appearance" />
          <div className="space-y-4">
            <Select
              label="Currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              options={[
                { value: 'USD', label: 'USD ($)' },
                { value: 'EUR', label: 'EUR (€)' },
                { value: 'GBP', label: 'GBP (£)' },
                { value: 'CAD', label: 'CAD ($)' },
                { value: 'AUD', label: 'AUD ($)' },
              ]}
            />
            <Select
              label="Timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              options={timezoneOptions}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Detected timezone: {getBrowserTimezone()}
            </p>

            {/* Dark Mode Toggle */}
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {theme === 'dark' ? (
                    <Moon className="w-5 h-5 text-teal-500" />
                  ) : (
                    <Sun className="w-5 h-5 text-amber-500" />
                  )}
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">Dark Mode</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {theme === 'dark' ? 'Currently using dark theme' : 'Currently using light theme'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={toggleTheme}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    theme === 'dark' ? 'bg-teal-600' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      theme === 'dark' ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="flex justify-end items-center gap-3 pt-2">
              {saveSuccess && (
                <span className="text-green-600 text-sm flex items-center gap-1">
                  <Check className="w-4 h-4" />
                  Saved!
                </span>
              )}
              <Button onClick={handleSaveGeneralSettings} isLoading={isSaving}>
                Save Settings
              </Button>
            </div>
          </div>
        </Card>

        {/* Account Info */}
        <Card>
          <CardHeader title="Account" subtitle="Your account information" />
          <div className="space-y-4">
            <Input label="Email" value={user?.email || ''} disabled />
            <Input label="Display Name" value={user?.displayName || ''} disabled />
          </div>
        </Card>

        {/* Data Management */}
        <Card>
          <CardHeader title="Data Management" subtitle="Export and import your budget data" />
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="space-y-4">
                {/* Export Data */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="font-medium text-blue-900 dark:text-blue-400">Export Data</h4>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                      Download all your budget data as a JSON file for backup or transfer to another device.
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={handleExportData}
                    isLoading={isExporting}
                    className="flex-shrink-0"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                </div>

                {/* Import Data */}
                <div className="pt-4 border-t border-blue-200 dark:border-blue-800">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h4 className="font-medium text-blue-900 dark:text-blue-400">Import Data</h4>
                      <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                        Restore your budget data from a previously exported JSON file.
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={handleImportClick}
                      disabled={isImporting}
                      className="flex-shrink-0"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Import
                    </Button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Danger Zone */}
        <Card className="border-red-200 dark:border-red-900">
          <CardHeader
            title="Danger Zone"
            subtitle="Irreversible actions - proceed with caution"
          />
          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="font-medium text-red-900 dark:text-red-400">Reset All Data</h4>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  Delete all your budget data including cycles, transactions, bills, payment methods,
                  tags, and buffer history. This action cannot be undone.
                </p>
              </div>
              <Button
                variant="danger"
                onClick={() => setResetModalOpen(true)}
                className="flex-shrink-0"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Reset Data
              </Button>
            </div>
          </div>
        </Card>

        {/* Version Footer */}
        <div className="text-center py-6 text-gray-400 dark:text-gray-500 text-sm">
          <p>Budget Buddy v{APP_VERSION}</p>
        </div>
      </div>

      {/* Import Data Modal */}
      <Modal
        isOpen={importModalOpen}
        onClose={() => {
          if (!isImporting) {
            setImportModalOpen(false);
            setImportResult(null);
          }
        }}
        title="Import Data"
      >
        <div className="space-y-4">
          {isImporting ? (
            <div className="p-4 text-center">
              <p className="text-gray-700 dark:text-gray-300">Importing data...</p>
            </div>
          ) : importResult ? (
            <div
              className={`p-4 rounded-lg ${
                importResult.success
                  ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800'
              }`}
            >
              <p
                className={`font-medium ${
                  importResult.success ? 'text-green-900 dark:text-green-300' : 'text-red-900 dark:text-red-300'
                }`}
              >
                {importResult.success ? 'Import Complete' : 'Import Failed'}
              </p>
              <p
                className={`text-sm mt-1 ${
                  importResult.success ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
                }`}
              >
                {importResult.message}
              </p>
              {importResult.success && (
                <p className="text-sm text-green-600 dark:text-green-400 mt-2">Reloading page...</p>
              )}
            </div>
          ) : null}
        </div>
      </Modal>

      {/* Reset Confirmation Modal */}
      <Modal
        isOpen={resetModalOpen}
        onClose={() => {
          if (!isResetting) {
            setResetModalOpen(false);
            setResetConfirmText('');
            setResetResult(null);
          }
        }}
        title="Reset All Data"
      >
        <div className="space-y-6">
          {!resetResult ? (
            <>
              <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-red-900 dark:text-red-300">Warning: This action is irreversible</h4>
                  <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                    This will permanently delete:
                  </p>
                  <ul className="text-sm text-red-700 dark:text-red-400 mt-2 list-disc list-inside space-y-1">
                    <li>All paycheck cycles and spending transactions</li>
                    <li>All payment methods, bills, and spending tags</li>
                    <li>Your entire buffer history</li>
                    <li>All legacy budget data (if any)</li>
                  </ul>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Type <span className="font-bold text-red-600 dark:text-red-400">DELETE</span> to confirm
                </label>
                <Input
                  value={resetConfirmText}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setResetConfirmText(e.target.value)}
                  placeholder="DELETE"
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setResetModalOpen(false);
                    setResetConfirmText('');
                  }}
                  disabled={isResetting}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={handleResetAllData}
                  disabled={resetConfirmText !== 'DELETE' || isResetting}
                  isLoading={isResetting}
                >
                  {isResetting ? 'Deleting...' : 'Delete All Data'}
                </Button>
              </div>
            </>
          ) : (
            <div
              className={`p-4 rounded-lg ${
                resetResult.success
                  ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800'
              }`}
            >
              <p
                className={`font-medium ${
                  resetResult.success ? 'text-green-900 dark:text-green-300' : 'text-red-900 dark:text-red-300'
                }`}
              >
                {resetResult.success ? 'Data Reset Complete' : 'Reset Failed'}
              </p>
              <p
                className={`text-sm mt-1 ${
                  resetResult.success ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
                }`}
              >
                {resetResult.message}
              </p>
              {resetResult.success && (
                <p className="text-sm text-green-600 dark:text-green-400 mt-2">Reloading page...</p>
              )}
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={exportError}
        onClose={() => setExportError(false)}
        onConfirm={() => setExportError(false)}
        title="Export Failed"
        message="Failed to export data."
        description="Please try again."
        variant="primary"
        confirmLabel="OK"
        hideCancel
      />
    </AppLayout>
  );
};
