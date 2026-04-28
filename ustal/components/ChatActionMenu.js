import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

const EMOJIS = ['❤️', '😂', '😮', '😢', '😡', '👍'];

export default function ChatActionMenu({ message, isOwn, onClose, onReply, onEdit, onDelete, onReact }) {
  if (!message) return null;
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1}>
          <View style={s.card}>
            <View style={s.emojiRow}>
              {EMOJIS.map(e => (
                <TouchableOpacity key={e} onPress={() => { onReact(e); onClose(); }} style={s.emojiBtn}>
                  <Text style={s.emojiText}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={s.sep} />
            <Item icon="return-down-forward-outline" label="Ответить" onPress={() => { onReply(); onClose(); }} />
            {isOwn && <Item icon="pencil-outline" label="Редактировать" onPress={() => { onEdit(); onClose(); }} />}
            {isOwn && <Item icon="trash-outline" label="Удалить" danger onPress={() => { onDelete(); onClose(); }} />}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

function Item({ icon, label, danger, onPress }) {
  const c = danger ? '#e74c3c' : colors.white;
  return (
    <TouchableOpacity style={s.item} onPress={onPress}>
      <Ionicons name={icon} size={20} color={c} />
      <Text style={[s.itemLabel, { color: c }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  card: {
    backgroundColor: colors.card, borderRadius: 18, width: 240, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 20, elevation: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  emojiRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 14, paddingHorizontal: 8 },
  emojiBtn: { padding: 4 },
  emojiText: { fontSize: 26 },
  sep: { height: 1, backgroundColor: colors.border, marginHorizontal: 12 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 18 },
  itemLabel: { fontSize: 15, fontWeight: '500' },
});
