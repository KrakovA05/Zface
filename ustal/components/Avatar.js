import { View, Image, Text, StyleSheet } from 'react-native';
import { LEVEL_COLORS } from '../constants';
import { colors } from '../theme';

export default function Avatar({ uri, username, level, size = 42, isOnline = false }) {
  const bgColor = LEVEL_COLORS[level] || colors.accent;
  const letter = (username || '?')[0].toUpperCase();
  const dotSize = Math.max(8, Math.round(size * 0.27));

  return (
    <View style={{ width: size, height: size }}>
      <View style={[
        styles.container,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bgColor },
      ]}>
        {uri
          ? <Image source={{ uri }} style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]} />
          : <Text style={[styles.letter, { fontSize: size * 0.42 }]}>{letter}</Text>
        }
      </View>
      {isOnline && (
        <View style={[styles.onlineDot, {
          width: dotSize,
          height: dotSize,
          borderRadius: dotSize / 2,
          bottom: 0,
          right: 0,
        }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    resizeMode: 'cover',
  },
  letter: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  onlineDot: {
    position: 'absolute',
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: colors.background,
  },
});
