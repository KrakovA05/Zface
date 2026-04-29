import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView,
  Linking, Animated, LayoutAnimation, Platform, UIManager,
} from 'react-native';
import { useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

const TOPICS = [
  {
    id: 'anxiety',
    label: 'Тревога',
    icon: 'pulse-outline',
    color: '#E8A838',
    items: [
      { type: 'video',   title: 'Как справиться с тревогой',              url: 'https://www.youtube.com/watch?v=rJy_0VpWDGM' },
      { type: 'video',   title: 'Лабковский: как избавиться от страха',   url: 'https://www.youtube.com/watch?v=oAJRs9lSgIc' },
      { type: 'article', title: 'Дневник тревог: уменьшаем тревожность',  url: 'https://www.b17.ru/article/549223/' },
      { type: 'article', title: 'Тревога: цикл статей',                   url: 'https://www.b17.ru/article/iamhigh_trevoga2/' },
    ],
  },
  {
    id: 'depression',
    label: 'Апатия и депрессия',
    icon: 'cloud-outline',
    color: '#7B9BD5',
    items: [
      { type: 'video',   title: 'Апатия: когда ничего не хочется',        url: 'https://www.youtube.com/watch?v=rewr6Q7jnVo' },
      { type: 'video',   title: 'Как бороться с депрессией и апатией',    url: 'https://www.youtube.com/watch?v=giPo2OX1FdY' },
      { type: 'article', title: 'Апатия, депрессия. Где брать ресурс?',   url: 'https://www.b17.ru/article/kritskayaapatia/' },
      { type: 'article', title: 'Что такое депрессия: взгляд психолога',  url: 'https://www.b17.ru/article/16298/' },
    ],
  },
  {
    id: 'burnout',
    label: 'Выгорание',
    icon: 'flame-outline',
    color: '#E07060',
    items: [
      { type: 'video',   title: 'Как распознать эмоциональное выгорание',  url: 'https://www.youtube.com/watch?v=R8H0o5Avh98' },
      { type: 'video',   title: 'Выгорание vs усталость: лекция Филоник', url: 'https://www.youtube.com/watch?v=MG2o_ZKZYsM' },
      { type: 'article', title: 'Выгорание: доказательные методы помощи', url: 'https://www.b17.ru/article/827185/' },
      { type: 'article', title: 'Пошаговая стратегия восстановления',     url: 'https://www.b17.ru/article/830567/' },
    ],
  },
  {
    id: 'loneliness',
    label: 'Отношения и одиночество',
    icon: 'heart-outline',
    color: '#9B6B9B',
    items: [
      { type: 'video',   title: 'Лабковский: одиночество — это когда...',  url: 'https://www.youtube.com/watch?v=ZLTiIVk66yg' },
      { type: 'video',   title: 'Одиночество в отношениях',               url: 'https://www.youtube.com/watch?v=ymxKno4RUaM' },
      { type: 'article', title: 'Психологические аспекты одиночества',    url: 'https://www.b17.ru/article/psihologicheskie_aspekty_odinochestva/' },
      { type: 'article', title: 'Когда одиночество идёт на пользу',       url: 'https://www.psychologies.ru/standpoint/otdykh-dlya-psikhiki-kogda-odinochestvo-idet-na-polzu-mnenie-psikhologa/' },
    ],
  },
  {
    id: 'selfesteem',
    label: 'Самооценка',
    icon: 'star-outline',
    color: '#5BAA72',
    items: [
      { type: 'video',   title: 'Низкая самооценка: лекция Орловой',      url: 'https://www.youtube.com/watch?v=_2QKcyvAOZM' },
      { type: 'video',   title: 'Здоровая самооценка: как стать увер.',   url: 'https://www.youtube.com/watch?v=JcwAJ6C8_J4' },
      { type: 'article', title: 'Техники работы с низкой самооценкой',    url: 'https://www.b17.ru/article/nesam/' },
      { type: 'article', title: 'Как научиться ценить себя',              url: 'https://www.psychologies.ru/articles/4-shaga-chtoby-nauchitsya-cenit-sebya-i-priznavat-svoi-dostizheniya/' },
    ],
  },
];

const TYPE_META = {
  video:   { icon: 'play-circle-outline',   label: 'Видео' },
  article: { icon: 'document-text-outline', label: 'Статья' },
  podcast: { icon: 'mic-outline',           label: 'Подкаст' },
};

const ANIM_CONFIG = {
  duration: 280,
  create:   { type: 'easeInEaseOut', property: 'opacity' },
  update:   { type: 'spring', springDamping: 0.85 },
  delete:   { type: 'easeInEaseOut', property: 'opacity' },
};

export default function ResourcesScreen() {
  const [open, setOpen] = useState(null);

  const chevronAnims = useRef(
    Object.fromEntries(TOPICS.map(t => [t.id, new Animated.Value(0)]))
  ).current;

  const toggle = (id) => {
    const isOpen = open === id;

    if (open && open !== id) {
      Animated.timing(chevronAnims[open], {
        toValue: 0, duration: 250, useNativeDriver: true,
      }).start();
    }

    Animated.timing(chevronAnims[id], {
      toValue: isOpen ? 0 : 1, duration: 260, useNativeDriver: true,
    }).start();

    LayoutAnimation.configureNext(ANIM_CONFIG);
    setOpen(isOpen ? null : id);
  };

  const openUrl = (url) => Linking.openURL(url).catch(() => {});

  return (
    <View style={styles.wrap}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Материалы</Text>
        <Text style={styles.subtitle}>Статьи и видео по темам от практикующих психологов</Text>

        {TOPICS.map(topic => {
          const rotate = chevronAnims[topic.id].interpolate({
            inputRange: [0, 1],
            outputRange: ['0deg', '180deg'],
          });

          return (
            <View key={topic.id} style={styles.topicCard}>
              <TouchableOpacity
                style={styles.topicHeader}
                onPress={() => toggle(topic.id)}
                activeOpacity={0.75}
              >
                <View style={[styles.topicIconWrap, { backgroundColor: topic.color + '22' }]}>
                  <Ionicons name={topic.icon} size={20} color={topic.color} />
                </View>
                <Text style={styles.topicLabel}>{topic.label}</Text>
                <Animated.View style={{ transform: [{ rotate }] }}>
                  <Ionicons name="chevron-down" size={18} color={colors.muted} />
                </Animated.View>
              </TouchableOpacity>

              {open === topic.id && (
                <View style={styles.itemList}>
                  {topic.items.map((item, i) => {
                    const meta = TYPE_META[item.type];
                    return (
                      <TouchableOpacity
                        key={i}
                        style={[styles.item, i < topic.items.length - 1 && styles.itemBorder]}
                        onPress={() => openUrl(item.url)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name={meta.icon} size={18} color={topic.color} style={styles.itemIcon} />
                        <View style={styles.itemBody}>
                          <Text style={styles.itemTitle}>{item.title}</Text>
                          <Text style={[styles.itemType, { color: topic.color }]}>{meta.label}</Text>
                        </View>
                        <Ionicons name="open-outline" size={15} color={colors.muted} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}

        <Text style={styles.footer}>
          Материалы носят информационный характер и не являются медицинской консультацией. Мы не несём ответственности за содержание внешних сайтов. При необходимости обратитесь к специалисту.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:    { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 48 },

  title:    { fontSize: 24, fontWeight: '700', color: colors.white, marginBottom: 6 },
  subtitle: { fontSize: 14, color: colors.muted, marginBottom: 24, lineHeight: 20 },

  topicCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  topicHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  topicIconWrap: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  topicLabel: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.white },

  itemList: { borderTopWidth: 1, borderTopColor: colors.border },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  itemIcon: { width: 22 },
  itemBody: { flex: 1 },
  itemTitle: { fontSize: 14, color: colors.white, lineHeight: 19, marginBottom: 2 },
  itemType:  { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },

  footer: {
    fontSize: 11, color: colors.muted, textAlign: 'center',
    lineHeight: 16, marginTop: 8,
  },
});
