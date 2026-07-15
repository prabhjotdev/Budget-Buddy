import { ReactNode } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import clsx from 'clsx';
import { Modal } from './Modal';
import { Button } from './Button';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: ReactNode;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  isLoading?: boolean;
  /** Hide the cancel button (e.g. for informational notices with only an OK action). */
  hideCancel?: boolean;
}

export const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  description,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  variant = 'danger',
  isLoading,
  hideCancel,
}: ConfirmDialogProps) => {
  const isDanger = variant === 'danger';
  const Icon = isDanger ? AlertTriangle : Info;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="space-y-4">
        <div
          className={clsx('flex items-start gap-3 p-4 rounded-lg', {
            'bg-red-50 dark:bg-red-900/20': isDanger,
            'bg-teal-50 dark:bg-teal-900/20': !isDanger,
          })}
        >
          <Icon
            className={clsx('w-6 h-6 flex-shrink-0 mt-0.5', {
              'text-red-500 dark:text-red-400': isDanger,
              'text-teal-500 dark:text-teal-400': !isDanger,
            })}
          />
          <div>
            <p
              className={clsx('text-sm font-medium', {
                'text-red-800 dark:text-red-300': isDanger,
                'text-teal-800 dark:text-teal-300': !isDanger,
              })}
            >
              {message}
            </p>
            {description && (
              <p
                className={clsx('text-sm mt-1', {
                  'text-red-600 dark:text-red-400': isDanger,
                  'text-teal-600 dark:text-teal-400': !isDanger,
                })}
              >
                {description}
              </p>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-3">
          {!hideCancel && (
            <Button variant="secondary" onClick={onClose} disabled={isLoading}>
              {cancelLabel}
            </Button>
          )}
          <Button variant={variant} onClick={onConfirm} isLoading={isLoading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
