import { StyleSheet } from 'react-native';

export const colors = {
  background: '#FAF7F2',
  card:       '#FFFFFF',
  border:     '#E8DFD0',
  accent:     '#7c3aed',
  white:      '#2C2420',
  muted:      '#9B8E82',
  onAccent:   '#FFFFFF',
  pink:       '#c0392b',
};

export const shared = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.accent,
    marginBottom: 32,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    color: colors.white,
    fontSize: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button: {
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: colors.onAccent,
    fontSize: 16,
    fontWeight: '600',
  },
  label: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  labelSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  labelText: {
    color: colors.muted,
    fontSize: 14,
  },
  labelTextSelected: {
    color: colors.onAccent,
  },
});
