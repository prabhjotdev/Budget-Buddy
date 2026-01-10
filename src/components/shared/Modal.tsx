import { ReactNode, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import clsx from 'clsx';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Modal = ({ isOpen, onClose, title, children, size = 'md' }: ModalProps) => {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, handleEscape]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div
        className={clsx(
          'relative bg-white shadow-xl overflow-hidden flex flex-col',
          'dark:bg-gray-800',
          // Mobile: bottom sheet style with rounded top corners
          'w-full rounded-t-2xl md:rounded-xl',
          'max-h-[85vh] md:max-h-[90vh]',
          // Desktop: centered with max-width
          {
            'md:max-w-sm': size === 'sm',
            'md:max-w-md': size === 'md',
            'md:max-w-lg': size === 'lg',
            'md:max-w-2xl': size === 'xl',
          }
        )}
      >
        {/* Drag handle for mobile */}
        <div className="flex justify-center pt-2 pb-1 md:hidden">
          <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
        </div>
        <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b dark:border-gray-700">
          <h2 className="text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 -mr-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-4 md:px-6 py-4 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body
  );
};
