import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { updateSettings } from '../settingsSlice';
import { AppLayout } from '../../../components/layout';
import { Card, CardHeader, Button, Input, Select } from '../../../components/shared';

export const SettingsPage = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { data: settings } = useAppSelector((state) => state.settings);

  const [payDay1, setPayDay1] = useState(settings?.payDays[0] || 1);
  const [payDay2, setPayDay2] = useState(settings?.payDays[1] || 15);
  const [currency, setCurrency] = useState(settings?.currency || 'USD');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      await dispatch(
        updateSettings({
          userId: user.uid,
          updates: {
            payDays: [payDay1, payDay2] as [number, number],
            currency,
          },
        })
      );
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const dayOptions = Array.from({ length: 28 }, (_, i) => ({
    value: String(i + 1),
    label: String(i + 1),
  }));

  return (
    <AppLayout title="Settings">
      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader
            title="Pay Day Configuration"
            subtitle="Set the days of the month when you get paid"
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="First Pay Day"
              value={String(payDay1)}
              onChange={(e) => setPayDay1(Number(e.target.value))}
              options={dayOptions}
            />
            <Select
              label="Second Pay Day"
              value={String(payDay2)}
              onChange={(e) => setPayDay2(Number(e.target.value))}
              options={dayOptions}
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="Currency" subtitle="Select your preferred currency" />
          <Select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            options={[
              { value: 'USD', label: 'USD ($)' },
              { value: 'EUR', label: 'EUR (\u20AC)' },
              { value: 'GBP', label: 'GBP (\u00A3)' },
              { value: 'CAD', label: 'CAD ($)' },
              { value: 'AUD', label: 'AUD ($)' },
            ]}
          />
        </Card>

        <Card>
          <CardHeader title="Account" subtitle="Your account information" />
          <div className="space-y-4">
            <Input label="Email" value={user?.email || ''} disabled />
            <Input label="Display Name" value={user?.displayName || ''} disabled />
          </div>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} isLoading={isSaving}>
            Save Settings
          </Button>
        </div>
      </div>
    </AppLayout>
  );
};
