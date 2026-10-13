import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { useTheme } from '../../../theme';

export default function TypingIndicator() {
  const theme = useTheme();
  const anim1 = useRef(new Animated.Value(0)).current;
  const anim2 = useRef(new Animated.Value(0)).current;
  const anim3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createBounce = (anim: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: -5,
            duration: 260,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 260,
            useNativeDriver: true,
          }),
          Animated.delay(400 - delay),
        ])
      );
    };

    const loop1 = createBounce(anim1, 0);
    const loop2 = createBounce(anim2, 130);
    const loop3 = createBounce(anim3, 260);

    loop1.start();
    loop2.start();
    loop3.start();

    return () => {
      loop1.stop();
      loop2.stop();
      loop3.stop();
    };
  }, [anim1, anim2, anim3]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
      <Animated.View style={[styles.dot, { backgroundColor: theme.colors.accent, transform: [{ translateY: anim1 }] }]} />
      <Animated.View style={[styles.dot, { backgroundColor: theme.colors.accent, transform: [{ translateY: anim2 }] }]} />
      <Animated.View style={[styles.dot, { backgroundColor: theme.colors.accent, transform: [{ translateY: anim3 }] }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1,
    alignSelf: 'flex-start',
    marginVertical: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
