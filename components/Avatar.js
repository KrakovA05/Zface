import { View, Image, Text, StyleSheet } from 'react-native';
import { LEVEL_COLORS } from '../constants';
import { colors } from '../theme';

export default function Avatar({ uri, username, level, size = 42 }) {
  const bgColor = LEVEL_COLORS[level] || colors.accent;
  const letter = (username || '?')[0].toUpperCase();

  return (
    <View style={[
      styles.container,
      { width: size, height: size, borderRadius: size / 2, backgroundColor: bgColor },
    ]}>
      {uri
        ? <Image source={{ uri }} style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]} />
        : <Text style={[styles.letter, { fontSize: size * 0.42 }]}>{letter}</Text>
      }
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
});
