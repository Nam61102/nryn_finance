import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { getToken } from '../services/api';
import { hasPermission, isSupported } from '../native/sms.reader';
import { theme } from '../theme';

/** Boot gate: token? → permission? → home. */
export default function Boot() {
  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) return router.replace('/login');
      // On web/iOS there is no inbox to ask for — go straight to the dashboard.
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
