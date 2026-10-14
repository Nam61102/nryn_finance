import React, { useEffect, useRef, useState } from 'react';
import { Text, StyleSheet, StyleProp, TextStyle, AccessibilityInfo } from 'react-native';
import { formatCompactINR, formatNumberINR } from '../../utils/format';

interface AnimatedNumberProps {
  value: number; // in rupees or paise (see isPaise)
  isPaise?: boolean;
  prefix?: string;
  suffix?: string;
  compact?: boolean;
  duration?: number;
  style?: StyleProp<TextStyle>;
}

export default function AnimatedNumber({
  value,
  isPaise = false,
  prefix = '₹',
  suffix = '',
  compact = false,
  duration = 700,
  style,
}: AnimatedNumberProps) {
  const numVal = Number(value);
  const safeVal = Number.isFinite(numVal) ? numVal : 0;
  const targetRupees = Math.round(isPaise ? safeVal / 100 : safeVal);
  const [displayValue, setDisplayValue] = useState(targetRupees);
  const prevValueRef = useRef(targetRupees);

  useEffect(() => {
    let animId: number;
    let isMounted = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduceMotion) => {
        if (!isMounted) return;
        if (reduceMotion) {
          setDisplayValue(targetRupees);
          prevValueRef.current = targetRupees;
          return;
        }

        const startVal = prevValueRef.current;
        const endVal = targetRupees;
        const diff = endVal - startVal;

        if (diff === 0 || !Number.isFinite(diff)) {
          setDisplayValue(endVal);
          return;
        }

        const startTime = Date.now();

        const tick = () => {
          if (!isMounted) return;
          const elapsed = Date.now() - startTime;
          const progress = Math.min(1, elapsed / duration);
          // Ease out cubic: 1 - pow(1 - progress, 3)
          const easeProgress = 1 - Math.pow(1 - progress, 3);
          const current = Math.round(startVal + diff * easeProgress);

          setDisplayValue(Number.isFinite(current) ? current : endVal);

          if (progress < 1) {
            animId = requestAnimationFrame(tick);
          } else {
            prevValueRef.current = endVal;
          }
        };

        animId = requestAnimationFrame(tick);
      })
      .catch(() => {
        if (isMounted) setDisplayValue(targetRupees);
      });

  return () => {
      isMounted = false;
      if (animId) cancelAnimationFrame(animId);
    };
  }, [targetRupees, duration]);

  if (compact) {
    const compactText = formatCompactINR(displayValue * 100);
    return <Text style={[styles.text, style]}>{compactText}{suffix}</Text>;
  }

  const formatted = `${prefix}${formatNumberINR(displayValue)}${suffix}`;

  return <Text style={[styles.text, style]}>{formatted}</Text>;
}

const styles = StyleSheet.create({
  text: {
    fontWeight: '800',
  },
});
