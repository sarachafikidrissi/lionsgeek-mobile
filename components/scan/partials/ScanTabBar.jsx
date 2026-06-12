import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const TABS = [
  { key: 'events', label: 'Events', icon: 'calendar-outline', activeIcon: 'calendar' },
  { key: 'infoSession', label: 'Info Session', icon: 'school-outline', activeIcon: 'school' },
];

export default function ScanTabBar({ activeTab, onTabChange }) {
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
              borderBottomColor: isActive ? '#ffc801' : 'transparent',
            }}
          >
            <Ionicons
              name={isActive ? tab.activeIcon : tab.icon}
              size={20}
              color={isActive ? '#ffc801' : 'rgba(128,128,128,0.7)'}
            />
            <Text
              className={`text-[10px] font-semibold mt-1 ${
                isActive ? 'text-alpha' : 'text-beta/40 dark:text-light/40'
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
