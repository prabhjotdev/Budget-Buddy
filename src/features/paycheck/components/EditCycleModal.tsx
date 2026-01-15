import { X } from 'lucide-react';
import { PaycheckCycle } from '../../../types';
import { StartCycleWizard } from './StartCycleWizard';

interface EditCycleModalProps {
  isOpen: boolean;
  onClose: () => void;
  cycle: PaycheckCycle;
}

export const EditCycleModal = ({ isOpen, onClose, cycle }: EditCycleModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-2xl bg-white dark:bg-gray-800 rounded-2xl shadow-xl">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Content */}
          <div className="p-6">
            <StartCycleWizard editingCycle={cycle} onClose={onClose} />
          </div>
        </div>
      </div>
    </div>
  );
};
