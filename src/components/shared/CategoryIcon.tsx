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
  LucideIcon,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  'shopping-cart': ShoppingCart,
  home: Home,
  car: Car,
  utensils: Utensils,
  shirt: Shirt,
  heart: Heart,
  'gamepad-2': Gamepad2,
  'graduation-cap': GraduationCap,
  plane: Plane,
  gift: Gift,
  smartphone: Smartphone,
  wifi: Wifi,
  zap: Zap,
  droplets: Droplets,
  'credit-card': CreditCard,
  'piggy-bank': PiggyBank,
  briefcase: Briefcase,
  baby: Baby,
  dog: Dog,
  dumbbell: Dumbbell,
  music: Music,
  film: Film,
  book: Book,
  coffee: Coffee,
  bus: Bus,
  fuel: Fuel,
  scissors: Scissors,
  pill: Pill,
  stethoscope: Stethoscope,
  building: Building,
  'more-horizontal': MoreHorizontal,
};

interface CategoryIconProps {
  icon: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const CategoryIcon = ({ icon, color = '#3B82F6', size = 'md', className = '' }: CategoryIconProps) => {
  const Icon = ICON_MAP[icon] || ShoppingCart;

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  return <Icon className={`${sizeClasses[size]} ${className}`} style={{ color }} />;
};

interface CategoryBadgeProps {
  name: string;
  icon: string;
  color: string;
  size?: 'sm' | 'md';
}

export const CategoryBadge = ({ name, icon, color, size = 'md' }: CategoryBadgeProps) => {
  const Icon = ICON_MAP[icon] || ShoppingCart;

  const sizeClasses = {
    sm: {
      container: 'px-2 py-1 gap-1.5',
      iconBox: 'w-5 h-5',
      icon: 'w-3 h-3',
      text: 'text-xs',
    },
    md: {
      container: 'px-3 py-1.5 gap-2',
      iconBox: 'w-6 h-6',
      icon: 'w-4 h-4',
      text: 'text-sm',
    },
  };

  const classes = sizeClasses[size];

  return (
    <div
      className={`inline-flex items-center rounded-lg ${classes.container}`}
      style={{ backgroundColor: `${color}15` }}
    >
      <div
        className={`${classes.iconBox} rounded flex items-center justify-center`}
        style={{ backgroundColor: color }}
      >
        <Icon className={`${classes.icon} text-white`} />
      </div>
      <span className={`font-medium ${classes.text}`} style={{ color }}>
        {name}
      </span>
    </div>
  );
};
