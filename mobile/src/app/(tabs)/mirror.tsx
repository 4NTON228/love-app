// Вкладка «Вопрос дня» — в вебе App.jsx рендерит SyncMirror отдельно (case 'mirror').
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SyncMirror } from '@/components/advisor/SyncMirror';
import { useMe } from '@/providers/AuthProvider';

export default function MirrorTab() {
  const { uid, profile } = useMe();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: '#0A0206' }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 92 + insets.bottom + 20 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets showsVerticalScrollIndicator={false}>
        <SyncMirror uid={uid} partnerId={profile.partner_id} topInset={insets.top} />
      </ScrollView>
    </View>
  );
}
