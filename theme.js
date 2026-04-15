import { StyleSheet } from 'react-native';

export const colors = {
  background: '#1E1E1E',
  card: '#2A2A2A',
  border: '#3A3A3A',
  accent: '#7D8AFF',
  pink: '#FF9B9B',
  white: '#FFFFFF',
  muted: '#888888',
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
    color: colors.white,
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
    color: colors.white,
  },
});
