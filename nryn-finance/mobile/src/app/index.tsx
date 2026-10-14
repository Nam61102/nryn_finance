import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { getToken } from '../services/api';
import { getItem } from '../services/storage';
import { hasPermission, isSupported } from '../native/sms.reader';
import { theme } from '../theme';

/** Boot gate: token? → onboarded? → home. */
export default function Boot() {
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const token = await getToken();
        if (!mounted) return;
        if (!token) {
          return router.replace('/login');
        }

        const onboarded = await getItem('nryn_finance_onboarded');
        if (!mounted) return;
        if (!onboarded) {
          return router.replace('/onboarding');
        }

        if (isSupported() && !(await hasPermission())) {
          if (!mounted) return;
          return router.replace('/onboarding');
        }

        if (!mounted) return;
        router.replace('/(tabs)');
      } catch (e) {
        console.warn('Boot router error:', e);
        try {
          if (mounted) router.replace('/login');
        } catch {}
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={theme.accent} />
    </View>
  );
}
