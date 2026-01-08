import { useState, useEffect } from 'react';
import { Calendar, CalendarDays, DollarSign, Info, Check } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { updateSettings } from '../../settings/settingsSlice';
import { Card, CardHeader, Button, Select, Input } from '../../../components/shared';
import { PaycheckScheduleType } from '../../../types';

// Helper to format Date as YYYY-MM-DD in local time
const formatLocalDate = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

interface PaycheckSetupProps {
  onSetupComplete?: () => void;
}

export const PaycheckSetup = ({ onSetupComplete }: PaycheckSetupProps) => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { data: settings } = useAppSelector((state) => state.settings);

  // Form state
  const [scheduleType, setScheduleType] = useState<PaycheckScheduleType>('semi-monthly');
  const [semiMonthlyDay1, setSemiMonthlyDay1] = useState(1);
  const [semiMonthlyDay2, setSemiMonthlyDay2] = useState(15);
  const [biWeeklyAnchorDate, setBiWeeklyAnchorDate] = useState(
    formatLocalDate(new Date())
  );
  const [defaultMinimumSave, setDefaultMinimumSave] = useState(50);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load existing settings if any
  useEffect(() => {
    if (settings) {
      // Load paycheck-specific settings
      if (settings.scheduleType) {
        setScheduleType(settings.scheduleType);
      }
      if (settings.semiMonthlyDays) {
        setSemiMonthlyDay1(settings.semiMonthlyDays[0]);
        setSemiMonthlyDay2(settings.semiMonthlyDays[1]);
      } else if (settings.payDays) {
        // Fallback to legacy payDays
        setSemiMonthlyDay1(settings.payDays[0]);
        setSemiMonthlyDay2(settings.payDays[1]);
      }
      if (settings.biWeeklyAnchorDate) {
        const date = settings.biWeeklyAnchorDate.toDate();
        setBiWeeklyAnchorDate(formatLocalDate(date));
      }
      if (settings.defaultMinimumSave !== undefined) {
        setDefaultMinimumSave(settings.defaultMinimumSave);
      }
    }
  }, [settings]);

  const dayOptions = Array.from({ length: 28 }, (_, i) => ({
    value: String(i + 1),
    label: `${i + 1}${getOrdinalSuffix(i + 1)}`,
  }));

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await dispatch(
        updateSettings({
          userId: user.uid,
          updates: {
            scheduleType,
            semiMonthlyDays: [semiMonthlyDay1, semiMonthlyDay2] as [number, number],
            biWeeklyAnchorDate: Timestamp.fromDate(new Date(biWeeklyAnchorDate)),
            defaultMinimumSave,
          },
        })
      ).unwrap();

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      onSetupComplete?.();
    } catch (error) {
      console.error('Failed to save paycheck settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Paycheck Schedule"
        subtitle="Configure when you get paid to optimize your budget cycles"
      />

      {/* Schedule Type Selection */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setScheduleType('semi-monthly')}
            className={`p-4 rounded-lg border-2 transition-all text-left ${
              scheduleType === 'semi-monthly'
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <CalendarDays
                className={`w-5 h-5 ${
                  scheduleType === 'semi-monthly' ? 'text-indigo-600' : 'text-gray-400'
                }`}
              />
              <span
                className={`font-medium ${
                  scheduleType === 'semi-monthly' ? 'text-indigo-900' : 'text-gray-700'
                }`}
              >
                Semi-Monthly
              </span>
            </div>
            <p className="text-xs text-gray-500">Same dates each month (e.g., 1st & 15th)</p>
          </button>

          <button
            type="button"
            onClick={() => setScheduleType('bi-weekly')}
            className={`p-4 rounded-lg border-2 transition-all text-left ${
              scheduleType === 'bi-weekly'
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Calendar
                className={`w-5 h-5 ${
                  scheduleType === 'bi-weekly' ? 'text-indigo-600' : 'text-gray-400'
                }`}
              />
              <span
                className={`font-medium ${
                  scheduleType === 'bi-weekly' ? 'text-indigo-900' : 'text-gray-700'
                }`}
              >
                Bi-Weekly
              </span>
            </div>
            <p className="text-xs text-gray-500">Every 14 days (26 paychecks/year)</p>
          </button>
        </div>

        {/* Semi-Monthly Configuration */}
        {scheduleType === 'semi-monthly' && (
          <div className="p-4 bg-gray-50 rounded-lg space-y-3">
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
              <Info className="w-4 h-4" />
              <span>Select the two days of the month when you get paid</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="First Pay Day"
                value={String(semiMonthlyDay1)}
                onChange={(e) => setSemiMonthlyDay1(Number(e.target.value))}
                options={dayOptions}
              />
              <Select
                label="Second Pay Day"
                value={String(semiMonthlyDay2)}
                onChange={(e) => setSemiMonthlyDay2(Number(e.target.value))}
                options={dayOptions}
              />
            </div>
          </div>
        )}

        {/* Bi-Weekly Configuration */}
        {scheduleType === 'bi-weekly' && (
          <div className="p-4 bg-gray-50 rounded-lg space-y-3">
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
              <Info className="w-4 h-4" />
              <span>Enter a recent or upcoming pay date to anchor your 14-day cycles</span>
            </div>
            <Input
              label="Anchor Pay Date"
              type="date"
              value={biWeeklyAnchorDate}
              onChange={(e) => setBiWeeklyAnchorDate(e.target.value)}
            />
            <p className="text-xs text-gray-500">
              Your pay cycles will be calculated from this date in 14-day intervals.
            </p>
          </div>
        )}

        {/* Default Minimum Save */}
        <div className="pt-4 border-t">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="w-5 h-5 text-green-600" />
            <span className="font-medium text-gray-900">Default Minimum Savings</span>
          </div>
          <p className="text-sm text-gray-500 mb-3">
            Set a default amount to save each paycheck. You can adjust this per cycle.
          </p>
          <div className="flex items-center gap-2">
            <span className="text-gray-500">$</span>
            <input
              type="number"
              min="0"
              step="10"
              value={defaultMinimumSave}
              onChange={(e) => setDefaultMinimumSave(Number(e.target.value))}
              className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-500">per paycheck</span>
          </div>
        </div>

        {/* Save Button */}
        <div className="pt-4 flex justify-end items-center gap-3">
          {saveSuccess && (
            <span className="text-green-600 text-sm flex items-center gap-1">
              <Check className="w-4 h-4" />
              Saved!
            </span>
          )}
          <Button onClick={handleSave} isLoading={isSaving}>
            Save Schedule
          </Button>
        </div>
      </div>
    </Card>
  );
};

// Helper function for ordinal suffixes
function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
