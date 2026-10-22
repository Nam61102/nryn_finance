import { Platform } from 'react-native';

const isNative = Platform.OS !== 'web';

let HapticsModule: any = null;
if (isNative) {
  try {
    HapticsModule = require('expo-haptics');
  } catch {
    HapticsModule = null;
  }
}

export const haptic = {
  light: () => {
    if (isNative && HapticsModule?.impactAsync) {
      try {
        HapticsModule.impactAsync(HapticsModule.ImpactFeedbackStyle?.Light ?? 'light').catch(() => {});
      } catch {}
    }
  },
  medium: () => {
    if (isNative && HapticsModule?.impactAsync) {
      try {
        HapticsModule.impactAsync(HapticsModule.ImpactFeedbackStyle?.Medium ?? 'medium').catch(() => {});
      } catch {}
    }
  },
  heavy: () => {
    if (isNative && HapticsModule?.impactAsync) {
      try {
        HapticsModule.impactAsync(HapticsModule.ImpactFeedbackStyle?.Heavy ?? 'heavy').catch(() => {});
      } catch {}
    }
  },
  success: () => {
    if (isNative && HapticsModule?.notificationAsync) {
      try {
        HapticsModule.notificationAsync(HapticsModule.NotificationFeedbackType?.Success ?? 'success').catch(() => {});
      } catch {}
    }
  },
  warning: () => {
    if (isNative && HapticsModule?.notificationAsync) {
      try {
        HapticsModule.notificationAsync(HapticsModule.NotificationFeedbackType?.Warning ?? 'warning').catch(() => {});
      } catch {}
    }
  },
  error: () => {
    if (isNative && HapticsModule?.notificationAsync) {
      try {
        HapticsModule.notificationAsync(HapticsModule.NotificationFeedbackType?.Error ?? 'error').catch(() => {});
      } catch {}
    }
  },
  selection: () => {
    if (isNative && HapticsModule?.selectionAsync) {
      try {
        HapticsModule.selectionAsync().catch(() => {});
      } catch {}
    }
  },
};

export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection';

export const triggerHaptic = (type: HapticType = 'light') => {
  if (haptic[type]) haptic[type]();
};

