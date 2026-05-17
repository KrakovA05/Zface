import React, { useState } from 'react'
import { Modal, KeyboardAvoidingView, Platform, TouchableOpacity, View, Text, TextInput, StyleSheet } from 'react-native'
import { colors } from '../theme'

export default function BanModal({ visible, username, currentBannedUntil, onClose, onApply }) {
  const isBanned = currentBannedUntil && new Date(currentBannedUntil) > new Date()
  const [days, setDays] = useState('')
  const [reason, setReason] = useState('')

  const handleClose = () => { setDays(''); setReason(''); onClose(); }

  const handleUnban = () => {
    onApply({ bannedUntil: null, reason: '' })
    handleClose()
  }

  const handleBan = () => {
    const d = parseInt(days, 10)
    const isPermanent = !days.trim() || isNaN(d) || d <= 0
    const bannedUntil = isPermanent
      ? '2099-01-01T00:00:00Z'
      : new Date(Date.now() + d * 86400000).toISOString()
    onApply({ bannedUntil, reason: reason.trim() })
    handleClose()
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={handleClose}>
          <TouchableOpacity activeOpacity={1} style={s.card}>
            <Text style={s.title}>
              {isBanned ? `Управление баном @${username}` : `Заблокировать @${username}`}
            </Text>

            {isBanned && (
              <TouchableOpacity style={s.unbanBtn} onPress={handleUnban}>
                <Text style={s.unbanText}>Разбанить сейчас</Text>
              </TouchableOpacity>
            )}

            <Text style={s.label}>Срок (дней, пусто = навсегда)</Text>
            <TextInput
              style={s.input}
              placeholder="Например: 30"
              placeholderTextColor={colors.muted}
              value={days}
              onChangeText={setDays}
              keyboardType="number-pad"
            />

            <Text style={s.label}>Причина</Text>
            <TextInput
              style={[s.input, { height: 72, textAlignVertical: 'top' }]}
              placeholder="Спам, оскорбления, нарушение правил..."
              placeholderTextColor={colors.muted}
              value={reason}
              onChangeText={setReason}
              multiline
            />

            <View style={s.btns}>
              <TouchableOpacity style={s.cancelBtn} onPress={handleClose}>
                <Text style={s.cancelText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.confirmBtn} onPress={handleBan}>
                <Text style={s.confirmText}>{isBanned ? 'Изменить бан' : 'Заблокировать'}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: 'white', borderRadius: 20, padding: 20, width: '100%' },
  title: { fontSize: 16, fontWeight: '700', color: '#2C2420', marginBottom: 16 },
  unbanBtn: { backgroundColor: '#e8f5e9', borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginBottom: 16 },
  unbanText: { color: '#5DAA72', fontWeight: '600', fontSize: 14 },
  label: { fontSize: 12, fontWeight: '600', color: '#888', marginBottom: 4, marginTop: 8 },
  input: { backgroundColor: '#FAF7F2', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#2C2420', borderWidth: 1, borderColor: '#E8DFD0', marginBottom: 4 },
  btns: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#F0E8D8', alignItems: 'center' },
  cancelText: { fontSize: 14, color: '#8B7355', fontWeight: '600' },
  confirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#fdecea', alignItems: 'center' },
  confirmText: { fontSize: 14, color: '#c0392b', fontWeight: '600' },
})
