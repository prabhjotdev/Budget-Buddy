export const DEFAULT_CATEGORIES = [
  { name: 'Housing', icon: 'home', color: '#6366f1' },
  { name: 'Utilities', icon: 'zap', color: '#f59e0b' },
  { name: 'Groceries', icon: 'shopping-cart', color: '#10b981' },
  { name: 'Transportation', icon: 'car', color: '#3b82f6' },
  { name: 'Healthcare', icon: 'heart', color: '#ef4444' },
  { name: 'Entertainment', icon: 'tv', color: '#8b5cf6' },
  { name: 'Dining Out', icon: 'utensils', color: '#f97316' },
  { name: 'Shopping', icon: 'shopping-bag', color: '#ec4899' },
  { name: 'Personal Care', icon: 'user', color: '#14b8a6' },
  { name: 'Subscriptions', icon: 'credit-card', color: '#6b7280' },
  { name: 'Other', icon: 'more-horizontal', color: '#78716c' },
] as const;

export const CATEGORY_ICONS = [
  'home', 'zap', 'shopping-cart', 'car', 'heart', 'tv', 'utensils',
  'shopping-bag', 'user', 'credit-card', 'more-horizontal', 'gift',
  'phone', 'wifi', 'book', 'music', 'film', 'coffee', 'briefcase',
  'plane', 'baby', 'dog', 'gamepad-2', 'dumbbell', 'scissors', 'wrench'
] as const;

export const CATEGORY_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#3b82f6', '#ef4444',
  '#8b5cf6', '#f97316', '#ec4899', '#14b8a6', '#6b7280',
  '#78716c', '#84cc16', '#06b6d4', '#a855f7', '#f43f5e',
] as const;
