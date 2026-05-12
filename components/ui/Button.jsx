import { Pressable, Text } from 'react-native';
import Skeleton from '@/components/ui/Skeleton';

/**
 * Reusable Button component with variants and sizes
 * Inspired by Inertia.js structure
 * 
 * @param {Object} props
 * @param {string} props.children - Button text
 * @param {Function} props.onPress - Click handler
 * @param {string} props.variant - Button style: 'default' | 'outline' | 'danger' | 'ghost'
 * @param {string} props.size - Button size: 'sm' | 'default' | 'lg'
 * @param {boolean} props.disabled - Disable button
 * @param {boolean} props.loading - Show loading spinner
 * @param {string} props.className - Additional classes
 */
export default function Button({
  children,
  onPress,
  variant = 'default',
  size = 'default',
  disabled = false,
  loading = false,
  className = '',
}) {
  const getVariantClasses = () => {
    switch (variant) {
      case 'outline':
        return 'bg-transparent border-2 border-black dark:border-white';
      case 'danger':
        return 'bg-red-600';
      case 'ghost':
        return 'bg-transparent';
      case 'link':
        return 'bg-transparent underline';
      default:
        return 'bg-alpha dark:bg-alpha';
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'h-8 px-3 py-1';
      case 'lg':
        return 'h-12 px-6 py-3';
      default:
        return 'h-11 px-4 py-2';
    }
  };

  const getTextClasses = () => {
    const base = 'text-center font-bold';
    switch (variant) {
      case 'outline':
        return `${base} text-black dark:text-white`;
      case 'ghost':
        return `${base} text-black dark:text-white`;
      case 'link':
        return `${base} text-alpha underline`;
      default:
        return `${base} text-black`;
    }
  };

  const sizeClasses = getSizeClasses();
  const variantClasses = getVariantClasses();
  const textClasses = getTextClasses();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      className={`${sizeClasses} ${variantClasses} rounded-lg items-center justify-center ${disabled || loading ? 'opacity-50' : ''} ${className}`}
    >
      {loading ? (
        <Skeleton width={18} height={18} borderRadius={9} isDark={variant !== 'default'} />
      ) : (
        <Text className={textClasses}>{children}</Text>
      )}
    </Pressable>
  );
}

