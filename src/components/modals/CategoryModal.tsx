import { useState, useEffect } from 'react';
import {
  ShoppingCart,
  Home,
  Car,
  Utensils,
  Shirt,
  Heart,
  Gamepad2,
  GraduationCap,
  Plane,
  Gift,
  Smartphone,
  Wifi,
  Zap,
  Droplets,
  CreditCard,
  PiggyBank,
  Briefcase,
  Baby,
  Dog,
  Dumbbell,
  Music,
  Film,
  Book,
  Coffee,
  Bus,
  Fuel,
  Scissors,
  Pill,
  Stethoscope,
  Building,
  MoreHorizontal,
} from 'lucide-react';
import { Modal, Button, Input } from '../shared';
import { Category } from '../../types';

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { name: string; icon: string; color: string }) => Promise<void>;
  category?: Category | null;
  mode: 'add' | 'edit';
}

// Icon options with their names
const ICON_OPTIONS = [
  { name: 'shopping-cart', Icon: ShoppingCart },
  { name: 'home', Icon: Home },
  { name: 'car', Icon: Car },
  { name: 'utensils', Icon: Utensils },
  { name: 'shirt', Icon: Shirt },
  { name: 'heart', Icon: Heart },
  { name: 'gamepad-2', Icon: Gamepad2 },
  { name: 'graduation-cap', Icon: GraduationCap },
  { name: 'plane', Icon: Plane },
  { name: 'gift', Icon: Gift },
  { name: 'smartphone', Icon: Smartphone },
  { name: 'wifi', Icon: Wifi },
  { name: 'zap', Icon: Zap },
  { name: 'droplets', Icon: Droplets },
  { name: 'credit-card', Icon: CreditCard },
  { name: 'piggy-bank', Icon: PiggyBank },
  { name: 'briefcase', Icon: Briefcase },
  { name: 'baby', Icon: Baby },
  { name: 'dog', Icon: Dog },
  { name: 'dumbbell', Icon: Dumbbell },
  { name: 'music', Icon: Music },
  { name: 'film', Icon: Film },
  { name: 'book', Icon: Book },
  { name: 'coffee', Icon: Coffee },
  { name: 'bus', Icon: Bus },
  { name: 'fuel', Icon: Fuel },
  { name: 'scissors', Icon: Scissors },
  { name: 'pill', Icon: Pill },
  { name: 'stethoscope', Icon: Stethoscope },
  { name: 'building', Icon: Building },
  { name: 'more-horizontal', Icon: MoreHorizontal },
];

// Color palette
const COLOR_OPTIONS = [
  '#EF4444', // red
  '#F97316', // orange
  '#F59E0B', // amber
  '#EAB308', // yellow
  '#84CC16', // lime
  '#22C55E', // green
  '#10B981', // emerald
  '#14B8A6', // teal
  '#06B6D4', // cyan
  '#0EA5E9', // sky
  '#3B82F6', // blue
  '#6366F1', // indigo
  '#8B5CF6', // violet
  '#A855F7', // purple
  '#D946EF', // fuchsia
  '#EC4899', // pink
  '#F43F5E', // rose
  '#64748B', // slate
];

export const CategoryModal = ({ isOpen, onClose, onSave, category, mode }: CategoryModalProps) => {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('shopping-cart');
  const [color, setColor] = useState('#3B82F6');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Reset form when modal opens/closes or category changes
  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && category) {
        setName(category.name);
        setIcon(category.icon || 'shopping-cart');
        setColor(category.color || '#3B82F6');
      } else {
        setName('');
        setIcon('shopping-cart');
        setColor('#3B82F6');
      }
      setError('');
    }
  }, [isOpen, category, mode]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Category name is required');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await onSave({ name: name.trim(), icon, color });
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Failed to save category');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedIconData = ICON_OPTIONS.find((i) => i.name === icon);
  const SelectedIcon = selectedIconData?.Icon || ShoppingCart;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'add' ? 'Add Category' : 'Edit Category'}
      size="md"
    >
      <div className="space-y-5">
        {/* Preview */}
        <div className="flex items-center justify-center p-4 bg-gray-50 rounded-lg">
          <div
            className="flex items-center gap-3 px-4 py-2 rounded-lg"
            style={{ backgroundColor: `${color}20` }}
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: color }}
            >
              <SelectedIcon className="w-5 h-5 text-white" />
            </div>
            <span className="font-medium" style={{ color }}>
              {name || 'Category Name'}
            </span>
          </div>
        </div>

        {/* Name Input */}
        <Input
          label="Category Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Groceries, Entertainment"
          error={error && !name.trim() ? error : undefined}
        />

        {/* Icon Picker */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Icon</label>
          <div className="grid grid-cols-8 gap-2 p-3 bg-gray-50 rounded-lg max-h-40 overflow-y-auto">
            {ICON_OPTIONS.map(({ name: iconName, Icon }) => (
              <button
                key={iconName}
                type="button"
                onClick={() => setIcon(iconName)}
                className={`p-2 rounded-lg transition-colors ${
                  icon === iconName
                    ? 'bg-indigo-100 text-indigo-600 ring-2 ring-indigo-500'
                    : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-5 h-5" />
              </button>
            ))}
          </div>
        </div>

        {/* Color Picker */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
          <div className="grid grid-cols-9 gap-2 p-3 bg-gray-50 rounded-lg">
            {COLOR_OPTIONS.map((colorOption) => (
              <button
                key={colorOption}
                type="button"
                onClick={() => setColor(colorOption)}
                className={`w-8 h-8 rounded-full transition-transform ${
                  color === colorOption ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''
                }`}
                style={{ backgroundColor: colorOption }}
              />
            ))}
          </div>
        </div>

        {/* Error Message */}
        {error && name.trim() && (
          <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} isLoading={isLoading} disabled={!name.trim()}>
            {mode === 'add' ? 'Add Category' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
