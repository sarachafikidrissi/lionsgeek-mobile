import { View } from 'react-native';
import Navbar from './Navbar';

/**
 * Reusable App Layout component for consistent structure
 * Includes navbar and consistent padding
 */
export default function AppLayout({ children, showNavbar = true, className = '' }) {
  return (
    <View className={`flex-1 bg-light dark:bg-dark ${className}`}>
      {showNavbar && <Navbar />}
      {children}
    </View>
  );
}

