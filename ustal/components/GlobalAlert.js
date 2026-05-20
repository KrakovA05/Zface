import { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { _registerAlert } from '../utils/alert';
import { colors } from '../theme';

export default function GlobalAlert() {
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState({ title: '', message: '', buttons: [] });
  const scale = useRef(new Animated.Value(0.92)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    _registerAlert((cfg) => {
      setConfig(cfg);
      setVisible(true);
    });
  }, []);

  useEffect(() => {
    if (visible) {
      scale.setValue(0.92);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 18, stiffness: 280 }),
        Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const dismiss = (onPress) => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 0.92, useNativeDriver: true, damping: 18, stiffness: 280 }),
      Animated.timing(opacity, { toValue: 0, duration: 120, useNativeDriver: true }),
    ]).start(() => {
      setVisible(false);
      if (onPress) onPress();
    });
  };

  const buttons = config.buttons || [{ text: 'OK' }];

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={() => dismiss(null)}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.card, { opacity, transform: [{ scale }] }]}>
          {!!config.title && <Text style={styles.title}>{config.title}</Text>}
          {!!config.message && <Text style={styles.message}>{config.message}</Text>}

          <View style={[styles.buttons, buttons.length === 2 && styles.buttonsRow]}>
            {buttons.map((btn, i) => {
              const isDestructive = btn.style === 'destructive';
              const isCancel = btn.style === 'cancel';
              return (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.btn,
                    buttons.length === 2 && styles.btnHalf,
                    isDestructive && styles.btnDestructive,
                    isCancel && styles.btnCancel,
                    !isDestructive && !isCancel && styles.btnPrimary,
                  ]}
                  onPress={() => dismiss(btn.onPress)}
                  activeOpacity={0.75}
                >
                  <Text style={[
                    styles.btnText,
                    isDestructive && styles.btnTextDestructive,
                    isCancel && styles.btnTextCancel,
                    !isDestructive && !isCancel && styles.btnTextPrimary,
                  ]}>
                    {btn.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(44,36,32,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  card: {
    backgroundColor: colors.background,
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    shadowColor: '#2C2420',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.white,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: colors.muted,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 20,
  },
  buttons: {
    gap: 8,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  btn: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  btnHalf: {
    flex: 1,
  },
  btnPrimary: {
    backgroundColor: colors.accent,
  },
  btnDestructive: {
    backgroundColor: '#FFF0EE',
  },
  btnCancel: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  btnTextPrimary: {
    color: colors.onAccent,
  },
  btnTextDestructive: {
    color: '#D94040',
  },
  btnTextCancel: {
    color: colors.muted,
  },
});
