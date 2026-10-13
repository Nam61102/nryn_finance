import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const isNative = Platform.OS !== 'web';

export const haptic = {
  light: () => {
    if (isNative) {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      } catch {}
    }
  },
  medium: () => {
    if (isNative) {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      } catch {}
    }
  },
  heavy: () => {
    if (isNative) {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      } catch {}
    }
  },
  success: () => {
    if (isNative) {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } catch {}
    }
  },
  warning: () => {
    if (isNative) {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      } catch {}
    }
  },
  error: () => {
    if (isNative) {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      } catch {}
    }
  },
  selection: () => {
    if (isNative) {
      try {
        Haptics.selectionAsync().catch(() => {});
      } catch {}
    }
  },
};

export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection';

export const triggerHaptic = (type: HapticType = 'light') => {
  if (haptic[type]) haptic[type]();
};

