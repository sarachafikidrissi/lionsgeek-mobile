import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAccentFillColor, getAccentIconColor } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

const TABS = [
  { key: 'events', label: 'Events', icon: 'calendar-outline', activeIcon: 'calendar' },
  { key: 'infoSession', label: 'Info Session', icon: 'school-outline', activeIcon: 'school' },
];

export default function ScanTabBar({ activeTab, onTabChange }) {
  const isDark = useColorScheme() === 'dark';
  const accent = getAccentFillColor(isDark);

  return (
    <View className="flex-row bg-light dark:bg-dark border-b border-beta/10 dark:border-light/10">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onTabChange(tab.key)}
            className="flex-1 items-center py-3"
            style={{
              borderBottomWidth: 2,
              borderBottomColor: isActive ? accent : 'transparent',
            }}
          >
            <Ionicons
              name={isActive ? tab.activeIcon : tab.icon}
              size={20}
              color={isActive ? getAccentIconColor(isDark) : 'rgba(128,128,128,0.7)'}
            />
            <Text
              className={`text-[10px] font-semibold mt-1 ${
                isActive ? 'text-beta dark:text-alpha' : 'text-beta/40 dark:text-light/40'
              }`}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
