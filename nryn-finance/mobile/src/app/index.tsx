import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { getToken } from '../services/api';
import { hasPermission, isSupported } from '../native/sms.reader';
import { getItem } from '../services/storage';
import { theme } from '../theme';

/** Boot gate: token? → permission? → home. */
export default function Boot() {
  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) return router.replace('/login');
      const onboarded = await getItem('nryn_finance_onboarded');
      if (!onboarded) return router.replace('/onboarding');
      if (isSupported() && !(await hasPermission())) return router.replace('/onboarding');
      router.replace('/(tabs)');
    })();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={theme.accent} />
    </View>
  );
}
