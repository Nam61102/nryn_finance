import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
  Animated,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { Mic, Square, X } from 'lucide-react-native';
import { Audio } from 'expo-av';
import { useTheme } from '../../../theme';
import { triggerHaptic } from '../../../utils/haptics';
import { api } from '../../../services/api';
import PressableScale from '../../ui/PressableScale';

interface VoiceRecorderProps {
  onTranscriptionComplete: (text: string, language?: string) => void;
  disabled?: boolean;
}

export default function VoiceRecorder({
  onTranscriptionComplete,
  disabled = false,
}: VoiceRecorderProps) {
  const theme = useTheme();
  const [status, setStatus] = useState<'idle' | 'recording' | 'transcribing'>('idle');
  const [durationSec, setDurationSec] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Animated pulse rings
  const pulseAnim1 = useRef(new Animated.Value(1)).current;
  const pulseAnim2 = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let anim: Animated.CompositeAnimation | null = null;
    if (status === 'recording') {
      anim = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(pulseAnim1, {
              toValue: 1.4,
              duration: 800,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim1, {
              toValue: 1,
              duration: 800,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(pulseAnim2, {
              toValue: 1.7,
              duration: 1100,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim2, {
              toValue: 1,
              duration: 1100,
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      anim.start();
    } else {
      pulseAnim1.setValue(1);
      pulseAnim2.setValue(1);
    }

    return () => {
      anim?.stop();
    };
  }, [status, pulseAnim1, pulseAnim2]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, []);

  const startRecording = async () => {
    if (disabled || status !== 'idle') return;

    try {
      triggerHaptic('medium');
      let perm = await Audio.getPermissionsAsync();
      if (!perm.granted) {
        perm = await Audio.requestPermissionsAsync();
      }

      if (!perm.granted) {
        Alert.alert(
          'Microphone Permission Required',
          'Please allow microphone access in App Settings to ask questions in Marathi, Hindi, or English.',
          [
            {
              text: 'Open Settings',
              onPress: () => {
                Linking.openSettings().catch(() => {});
              },
            },
            {
              text: 'Cancel',
              style: 'cancel',
            },
          ]
        );
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();

      recordingRef.current = recording;
      setStatus('recording');
      setDurationSec(0);

      timerRef.current = setInterval(() => {
        setDurationSec((prev) => {
          // Max 30 seconds audio limit
          if (prev >= 30) {
            stopAndTranscribe();
            return 30;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err: any) {
      console.warn('Failed to start recording:', err);
      Alert.alert('Recording Error', 'Could not access the audio recorder. Please try again.');
      setStatus('idle');
    }
  };

  const stopAndTranscribe = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const recording = recordingRef.current;
    if (!recording) {
      setStatus('idle');
      return;
    }

    try {
      triggerHaptic('light');
      setStatus('transcribing');
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      recordingRef.current = null;

      if (!uri) {
        throw new Error('No audio recording URI found.');
      }

      const res = await api.transcribeVoice(uri, 'audio/m4a', 'voice_query.m4a');

      if (res && res.ok && res.text && res.text.trim()) {
        triggerHaptic('success');
        setStatus('idle');
        onTranscriptionComplete(res.text.trim(), res.language);
      } else {
        triggerHaptic('warning');
        setStatus('idle');
        Alert.alert(
          'आवाज ऐकू आला नाही (Speech not heard)',
          'कृपया माइक जवळ धरून स्पष्ट बोला आणि पुन्हा प्रयत्न करा.\n(Please speak clearly near the microphone and try again.)'
        );
      }
    } catch (err: any) {
      triggerHaptic('error');
      console.warn('Transcription error:', err);
      setStatus('idle');
      const msg = err?.data?.message || err?.message || '';
      Alert.alert(
        'Speech Recognition',
        msg && !msg.includes('ApiError')
          ? `${msg}\n\nकृपया पुन्हा प्रयत्न करा.`
          : 'Could not transcribe your voice audio. Please ensure network is connected and speak clearly.'
      );
    }
  };

  const cancelRecording = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch {}
      recordingRef.current = null;
    }

    triggerHaptic('light');
    setStatus('idle');
  };

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <>
      <PressableScale
        onPress={startRecording}
        disabled={disabled || status !== 'idle'}
        style={[
          styles.micBtn,
          {
            backgroundColor: theme.colors.cardAlt,
            borderColor: theme.colors.border,
          },
          disabled && { opacity: 0.5 },
        ]}
      >
        <Mic size={18} color={theme.colors.accent} />
      </PressableScale>

      {/* Voice Recording Active Modal Overlay */}
      <Modal
        visible={status !== 'idle'}
        transparent
        animationType="fade"
        onRequestClose={cancelRecording}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
              },
            ]}
          >
            {/* Close / Cancel Button */}
            <TouchableOpacity
              onPress={cancelRecording}
              style={[styles.cancelBtn, { backgroundColor: theme.colors.cardAlt }]}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <X size={18} color={theme.colors.textDim} />
            </TouchableOpacity>

            {status === 'recording' ? (
              <View style={styles.recordingContent}>
                {/* Pulsing Animated Waveform Circles */}
                <View style={styles.pulseContainer}>
                  <Animated.View
                    style={[
                      styles.pulseRing,
                      {
                        backgroundColor: theme.colors.accentLight,
                        transform: [{ scale: pulseAnim2 }],
                      },
                    ]}
                  />
                  <Animated.View
                    style={[
                      styles.pulseRing,
                      {
                        backgroundColor: theme.colors.accentLight,
                        transform: [{ scale: pulseAnim1 }],
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.micActiveCircle,
                      { backgroundColor: theme.colors.accent },
                    ]}
                  >
                    <Mic size={32} color="#0B0F0D" />
                  </View>
                </View>

                {/* Duration Timer */}
                <Text style={[styles.timerText, { color: theme.colors.text }]}>
                  {formatTimer(durationSec)}
                </Text>

                <Text style={[styles.listeningTitle, { color: theme.colors.text }]}>
                  Listening...
                </Text>
                <Text style={[styles.listeningSubtitle, { color: theme.colors.textDim }]}>
                  Speak in मराठी (Marathi), हिंदी (Hindi), or English
                </Text>

                {/* Stop & Transcribe CTA */}
                <PressableScale
                  onPress={stopAndTranscribe}
                  style={[styles.doneBtn, { backgroundColor: theme.colors.accent }]}
                >
                  <Square size={16} color="#0B0F0D" fill="#0B0F0D" />
                  <Text style={styles.doneBtnText}>Tap when done</Text>
                </PressableScale>
              </View>
            ) : (
              <View style={styles.transcribingContent}>
                <ActivityIndicator size="large" color={theme.colors.accent} />
                <Text style={[styles.transcribingTitle, { color: theme.colors.text }]}>
                  Understanding your voice...
                </Text>
                <Text style={[styles.transcribingSubtitle, { color: theme.colors.textDim }]}>
                  Transcribing Indian dialects with low-latency AI
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  micBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
  },
  cancelBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  recordingContent: {
    alignItems: 'center',
    paddingVertical: 12,
    width: '100%',
  },
  pulseContainer: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  pulseRing: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  micActiveCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  timerText: {
    fontSize: 22,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    marginBottom: 6,
  },
  listeningTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  listeningSubtitle: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 20,
  },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  doneBtnText: {
    color: '#0B0F0D',
    fontSize: 14,
    fontWeight: '700',
  },
  transcribingContent: {
    alignItems: 'center',
    paddingVertical: 36,
  },
  transcribingTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 18,
    marginBottom: 6,
  },
  transcribingSubtitle: {
    fontSize: 12,
    textAlign: 'center',
  },
});
