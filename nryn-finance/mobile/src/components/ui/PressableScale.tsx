import React, { useRef } from 'react';
import {
  Pressable,
  Animated,
  StyleProp,
  ViewStyle,
  GestureResponderEvent,
  Platform,
} from 'react-native';
import { haptic } from '../../utils/haptics';

interface PressableScaleProps {
  children: React.ReactNode;
  onPress?: (event: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  hapticType?: 'light' | 'medium' | 'heavy' | 'selection' | 'none';
  disabled?: boolean;
  activeOpacity?: number;
}

export default function PressableScale({
  children,
  onPress,
  style,
  scaleTo = 0.97,
  hapticType = 'light',
  disabled = false,
}: PressableScaleProps) {
  const animatedScale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (disabled) return;
    if (hapticType !== 'none') {
      if (hapticType === 'light') haptic.light();
      else if (hapticType === 'medium') haptic.medium();
      else if (hapticType === 'heavy') haptic.heavy();
      else if (hapticType === 'selection') haptic.selection();
    }
    Animated.spring(animatedScale, {
      toValue: scaleTo,
      useNativeDriver: Platform.OS !== 'web',
      speed: 40,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    if (disabled) return;
    Animated.spring(animatedScale, {
      toValue: 1,
      useNativeDriver: Platform.OS !== 'web',
      speed: 40,
      bounciness: 6,
    }).start();
  };

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={({ pressed }) => [
        { opacity: disabled ? 0.6 : 1 },
      ]}
    >
      <Animated.View style={[{ transform: [{ scale: animatedScale }] }, style]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
