// Вкладки как в веб-версии (App.jsx + Navigation.jsx): 6 пунктов дока и
// разделы advisor / premium / mirror, которые открываются из «Профиля».
import { Tabs } from 'expo-router';

import { Dock } from '@/components/Dock';
import { colors } from '@/theme';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <Dock {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg }, animation: 'none' }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="chat" />
      <Tabs.Screen name="moments" />
      <Tabs.Screen name="calendar" />
      <Tabs.Screen name="plans" />
      <Tabs.Screen name="settings" />
      <Tabs.Screen name="advisor" />
      <Tabs.Screen name="premium" />
      <Tabs.Screen name="mirror" />
    </Tabs>
  );
}
