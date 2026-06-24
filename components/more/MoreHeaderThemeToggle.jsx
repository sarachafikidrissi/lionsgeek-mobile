import { View } from 'react-native';
import { useCallback, useEffect, useState } from 'react';
import { useAppContext } from '@/context';
import SmoothThemeToggle from '@/components/ui/SmoothThemeToggle';

const ACCENT = '#F5C518';

export default function MoreHeaderThemeToggle() {
  const { colorScheme, setTheme } = useAppContext();
  const isDark = colorScheme === 'dark';
  const [toggleDark, setToggleDark] = useState(isDark);

  useEffect(() => {
    setToggleDark(isDark);
  }, [isDark]);

  const onChange = useCallback(
    (value) => {
      setToggleDark(value);
      setTheme(value ? 'dark' : 'light');
    },
    [setTheme],
  );

  return (
    <View style={{ marginRight: 12 }}>
      <SmoothThemeToggle value={toggleDark} onValueChange={onChange} accent={ACCENT} />
    </View>
  );
}
