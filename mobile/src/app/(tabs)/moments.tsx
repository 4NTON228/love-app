// Порт src/components/Moments.jsx (+ StoriesViewer).
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Animated, Easing, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path, Polygon, Polyline } from 'react-native-svg';
import type { ImagePickerAsset } from 'expo-image-picker';

import { Radials } from '@/components/Backgrounds';
import { FormFileLabel, FormGroup, FormInput, FormSubmit, WebModal } from '@/components/webui';
import { chooseImage, processAndUpload, validateImageFile } from '@/lib/media';
import { sendPushNotification } from '@/lib/notify';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import { useMe } from '@/providers/AuthProvider';
import { colors, cssLinear, fonts } from '@/theme';

const HEART = 'M30 52C30 52 3 35 3 16C3 8 9.5 2 18 2C22.5 2 26.5 4.5 30 9C33.5 4.5 37.5 2 42 2C50.5 2 57 8 57 16C57 35 30 52 30 52Z';
const HEART_S = 'M12 20S2 13.5 2 6C2 3.5 4 1.5 6.5 1.5C8.5 1.5 10 3 12 5.5C14 3 15.5 1.5 17.5 1.5C20 1.5 22 3.5 22 6C22 13.5 12 20 12 20Z';

const IcoTrash = () => <Svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Polyline points="3 6 5 6 21 6" /><Path d="M19 6l-1 14H6L5 6" /><Path d="M10 11v6M14 11v6" /><Path d="M9 6V4h6v2" /></Svg>;
const IcoPlay = () => <Svg viewBox="0 0 24 24" width={20} height={20}><Polygon points="5 3 19 12 5 21 5 3" fill="white" /></Svg>;
const IcoCamera = () => <Svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><Circle cx="12" cy="13" r="4" /></Svg>;
const IcoPlus = ({ c = 'white' }: { c?: string }) => <Svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke={c} strokeWidth={2.5} strokeLinecap="round"><Line x1="12" y1="5" x2="12" y2="19" /><Line x1="5" y1="12" x2="19" y2="12" /></Svg>;

function LoadingHeart() {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => { Animated.loop(Animated.timing(v, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true })).start(); }, [v]);
  return (
    <Animated.View style={{ transform: [{ scale: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.15, 1] }) }] }}>
      <Svg viewBox="0 0 60 56" width={48} height={44} fill="none"><Path d={HEART} fill="rgba(200,51,74,0.4)" stroke="rgba(200,51,74,0.6)" strokeWidth={2} /></Svg>
    </Animated.View>
  );
}

const MOODS = [
  { value: 'love', label: 'Любовь', color: '#C8334A' },
  { value: 'happy', label: 'Счастье', color: '#f7c948' },
  { value: 'laugh', label: 'Смех', color: '#ff8fab' },
  { value: 'warm', label: 'Тепло', color: '#f97316' },
  { value: 'dream', label: 'Мечта', color: '#a78bfa' },
  { value: 'kiss', label: 'Поцелуй', color: '#ec4899' },
  { value: 'adventure', label: 'Путешествие', color: '#22c55e' },
  { value: 'cozy', label: 'Уют', color: '#b45309' },
];
const getMood = (v?: string | null) => MOODS.find((m) => m.value === v) || MOODS[0];
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
function formatDate(s: string) { const d = new Date(s); return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]} ${d.getFullYear()} г.`; }
function yearsAgo(n: number) {
  const a = n % 10, b = n % 100;
  const w = a === 1 && b !== 11 ? 'год' : a >= 2 && a <= 4 && (b < 10 || b >= 20) ? 'года' : 'лет';
  return `${n} ${w} назад`;
}

type MomentRow = { id: string; user_id: string; title: string; description: string | null; photo_url: string | null; thumb_url: string | null; mood: string | null; liked: boolean; created_at: string };

/* ── Stories Viewer ── */
const STORY_DURATION = 5000;

function StoryProgress({ active, done, onEnd }: { active: boolean; done: boolean; onEnd: () => void }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!active) return;
    v.setValue(0);
    const a = Animated.timing(v, { toValue: 1, duration: STORY_DURATION, easing: Easing.linear, useNativeDriver: false });
    a.start(({ finished }) => { if (finished) onEnd(); });
    return () => a.stop();
  }, [active, v, onEnd]);
  return (
    <View style={st.progTrack}>
      {done ? <View style={[st.progFill, { width: '100%' }]} /> : null}
      {active ? <Animated.View style={[st.progFill, { width: v.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} /> : null}
    </View>
  );
}

function BurstPiece({ angle }: { angle: number }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => { Animated.timing(v, { toValue: 1, duration: 600, easing: Easing.out(Easing.ease), useNativeDriver: true }).start(); }, [v]);
  const rad = (angle * Math.PI) / 180;
  return (
    <Animated.View style={[st.burst, {
      opacity: v.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
      transform: [
        { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(rad) * 38] }) },
        { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -Math.cos(rad) * 38] }) },
        { scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 0.3] }) },
      ],
    }]} />
  );
}

function StoryImage({ uri, title }: { uri: string; title: string }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => { Animated.timing(v, { toValue: 1, duration: 450, easing: Easing.bezier(0.22, 1, 0.36, 1), useNativeDriver: true }).start(); }, [v]);
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1.05, 1] }) }] }]}>
      <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" accessibilityLabel={title} />
    </Animated.View>
  );
}

function StoriesViewer({ stories, startIdx, onClose, onToggleLike }: { stories: MomentRow[]; startIdx: number; onClose: () => void; onToggleLike: (id: string, v: boolean) => void }) {
  const insets = useSafeAreaInsets();
  const [idx, setIdx] = useState(startIdx);
  const [burst, setBurst] = useState(0);
  const [pop] = useState(() => new Animated.Value(1));
  const story = stories[idx];
  const moodData = getMood(story?.mood);
  const liked = !!story?.liked;

  const goNext = useCallback(() => { setIdx((i) => { if (i < stories.length - 1) return i + 1; onClose(); return i; }); }, [stories.length, onClose]);
  const goPrev = useCallback(() => setIdx((i) => (i > 0 ? i - 1 : i)), []);
  const navRef = useRef({ goNext, goPrev, onClose });
  navRef.current = { goNext, goPrev, onClose };

  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 12 || Math.abs(g.dy) > 12,
    onPanResponderRelease: (_, g) => {
      if (Math.abs(g.dx) > 50 && Math.abs(g.dx) > Math.abs(g.dy)) { if (g.dx > 0) navRef.current.goPrev(); else navRef.current.goNext(); }
      else if (g.dy > 90 && Math.abs(g.dy) > Math.abs(g.dx)) navRef.current.onClose(); // свайп вниз — закрыть
    },
  })).current;

  function triggerHeart() {
    const next = !liked;
    onToggleLike(story.id, next);
    if (next) {
      setBurst((b) => b + 1);
      pop.setValue(1);
      Animated.sequence([
        Animated.timing(pop, { toValue: 1.42, duration: 165, useNativeDriver: true }),
        Animated.timing(pop, { toValue: 0.88, duration: 138, useNativeDriver: true }),
        Animated.timing(pop, { toValue: 1, duration: 247, useNativeDriver: true }),
      ]).start();
    }
  }

  if (!story) return null;

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <View style={StyleSheet.absoluteFill} {...pan.panHandlers}>
          {story.photo_url ? (
            <>
              {/* размытая подложка из того же фото */}
              <Image source={{ uri: story.photo_url }} style={[StyleSheet.absoluteFill, { transform: [{ scale: 1.2 }], opacity: 0.45 }]} contentFit="cover" blurRadius={40} />
              <StoryImage key={story.id} uri={story.photo_url} title={story.title} />
            </>
          ) : (
            <LinearGradient {...cssLinear(160, [`${moodData.color}66`, '#1a0a0a'])} style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
              <Svg viewBox="0 0 60 56" width={100} height={93} fill="none"><Path d={HEART} fill={moodData.color} opacity={0.6} /></Svg>
            </LinearGradient>
          )}
        </View>

        <View style={[st.progRow, { paddingTop: insets.top + 12 }]}>
          {stories.map((_, i) => <StoryProgress key={`${i}-${i === idx ? idx : 'x'}`} active={i === idx} done={i < idx} onEnd={goNext} />)}
        </View>

        <Pressable onPress={onClose} style={[st.close, { top: insets.top + 20 }]} accessibilityLabel="Закрыть">
          <Svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="white" strokeWidth={2.5}><Line x1="18" y1="6" x2="6" y2="18" /><Line x1="6" y1="6" x2="18" y2="18" /></Svg>
        </Pressable>

        <Pressable style={[st.tap, { left: 0 }]} onPress={goPrev} accessibilityLabel="Предыдущий момент" />
        <Pressable style={[st.tap, { right: 0 }]} onPress={goNext} accessibilityLabel="Следующий момент" />

        <LinearGradient colors={['rgba(0,0,0,0.85)', 'transparent']} start={{ x: 0.5, y: 1 }} end={{ x: 0.5, y: 0 }} pointerEvents="none"
          style={[st.caption, { paddingBottom: insets.bottom + 120 }]}>
          <View style={st.storyMood}>
            <View style={[st.dot8, { backgroundColor: moodData.color }]} />
            <Text style={st.storyMoodText}>{moodData.label}</Text>
          </View>
          <Text style={st.storyTitle}>{story.title}</Text>
          {story.description ? <Text style={st.storyDesc}>{story.description}</Text> : null}
          <Text style={st.storyDate}>{formatDate(story.created_at)}</Text>
        </LinearGradient>

        <Pressable onPress={triggerHeart} accessibilityRole="button" accessibilityState={{ selected: liked }} accessibilityLabel={liked ? 'Убрать лайк' : 'Поставить лайк'}
          style={({ pressed }) => [st.heartBtn, { bottom: insets.bottom + 120 }, liked && st.heartBtnLiked, pressed && { transform: [{ scale: 0.92 }] }]}>
          {burst ? <View key={burst} style={StyleSheet.absoluteFill} pointerEvents="none">{[0, 1, 2, 3, 4, 5].map((i) => <BurstPiece key={i} angle={i * 60} />)}</View> : null}
          <Animated.View style={{ transform: [{ scale: pop }] }}>
            <Svg viewBox="0 0 24 22" width={26} height={24} fill="none"><Path d={HEART_S} fill={liked ? '#FF3B5C' : 'rgba(255,255,255,0.25)'} stroke="white" strokeWidth={1.5} /></Svg>
          </Animated.View>
        </Pressable>
      </View>
    </Modal>
  );
}

/* ── карточка с появлением momentIn ── */
function MomentIn({ delay, children, style }: { delay: number; children: React.ReactNode; style?: object }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => { Animated.timing(v, { toValue: 1, duration: 450, delay, easing: Easing.out(Easing.ease), useNativeDriver: true }).start(); }, [v, delay]);
  return <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }, { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] }]}>{children}</Animated.View>;
}

export default function Moments() {
  const { uid, profile } = useMe();
  const pid = profile.partner_id;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [moments, setMoments] = useState<MomentRow[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadStage, setUploadStage] = useState('');
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});
  const [storiesIdx, setStoriesIdx] = useState(0);
  const [showStories, setShowStories] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [mood, setMood] = useState('love');
  const [photo, setPhoto] = useState<ImagePickerAsset | null>(null);

  const loadMoments = useCallback(async () => {
    const ids = [uid, pid].filter(Boolean) as string[];
    const q = supabase.from('moments').select('*').order('created_at', { ascending: false });
    const { data } = ids.length === 1 ? await q.eq('user_id', ids[0]) : await q.in('user_id', ids);
    setMoments((data || []) as MomentRow[]);
    setLoading(false);
  }, [uid, pid]);

  useEffect(() => { loadMoments(); }, [loadMoments]);

  async function handlePhotoSelect() {
    const asset = await chooseImage();
    if (!asset) return;
    const err = validateImageFile(asset);
    if (err) { toast.error(err); return; }
    setPhoto(asset);
  }

  function resetForm() { setTitle(''); setDescription(''); setMood('love'); setPhoto(null); }

  async function handleSubmit() {
    if (!title.trim()) { toast.error('Добавьте название'); return; }
    setSaving(true);
    try {
      let photoUrl: string | null = null, thumbUrl: string | null = null;
      if (photo) {
        setUploadStage('Сжимаем фото…');
        const base = `moments/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        setUploadStage('Загружаем…');
        const res = await processAndUpload(photo, base);
        photoUrl = res.publicUrl;
        thumbUrl = res.thumbPublicUrl;
      }
      setUploadStage('Сохраняем…');
      const { error } = await supabase.from('moments').insert({ user_id: uid, title: title.trim(), description, mood, photo_url: photoUrl, thumb_url: thumbUrl });
      if (error) throw error;
      const hadPhoto = !!photo, t = title;
      resetForm(); setShowModal(false); loadMoments();
      toast.success('Момент сохранён');
      if (pid) sendPushNotification(`📸 ${profile.name || 'Партнёр'} · Новый момент`, hadPhoto ? `📷 ${t}` : `💝 ${t}`, pid).catch(() => {});
    } catch (err) {
      console.error(err);
      toast.error('Не удалось сохранить момент');
    } finally {
      setSaving(false);
      setUploadStage('');
    }
  }

  function deleteMoment(id: string) {
    Alert.alert('Удалить этот момент?', undefined, [
      { text: 'Отмена', style: 'cancel' },
      { text: 'OK', onPress: async () => {
        const { error } = await supabase.from('moments').delete().eq('id', id);
        if (error) { toast.error('Не удалось удалить'); return; }
        setMoments((prev) => prev.filter((m) => m.id !== id));
        toast.success('Момент удалён');
      } },
    ]);
  }

  const openStories = (i: number) => { setStoriesIdx(i); setShowStories(true); };

  const toggleLike = useCallback(async (id: string, value: boolean) => {
    setMoments((prev) => prev.map((m) => (m.id === id ? { ...m, liked: value } : m)));
    const { error } = await supabase.from('moments').update({ liked: value }).eq('id', id);
    if (error) {
      setMoments((prev) => prev.map((m) => (m.id === id ? { ...m, liked: !value } : m)));
      console.error('Не удалось сохранить лайк:', error);
      toast.error('Не удалось сохранить лайк');
    }
  }, []);

  // «В этот день» — момент той же даты в прошлые годы
  const today = new Date();
  const memoryIndex = moments.findIndex((m) => {
    const d = new Date(m.created_at);
    return d.getFullYear() < today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
  });
  const memory = memoryIndex >= 0 ? moments[memoryIndex] : null;
  const memoryYears = memory ? today.getFullYear() - new Date(memory.created_at).getFullYear() : 0;
  const tileW = (width - 28 - 10) / 2;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={st.header}>
          <LinearGradient {...cssLinear(165, [['#5e2545', 0], ['#92384e', 0.42], ['#bd5552', 0.76], ['#cb6650', 1]])} style={StyleSheet.absoluteFill} />
          <Radials items={[{ x: 80, y: 0, color: 'rgba(255,210,150,0.30)', stop: 55 }]} />
          <View style={{ paddingTop: Math.max(60, insets.top + 16), paddingHorizontal: 20, paddingBottom: 30 }}>
            <Text style={st.headerTitle} accessibilityRole="header">Наши моменты</Text>
            <Text style={st.headerSub}>{moments.length} воспоминаний сохранено</Text>
            <View style={st.actions}>
              <Pressable onPress={() => setShowModal(true)} accessibilityRole="button" style={({ pressed }) => [st.addBtn, pressed && { backgroundColor: 'rgba(255,255,255,0.26)', transform: [{ scale: 0.97 }] }]}>
                <IcoPlus /><Text style={st.addBtnText}>Добавить момент</Text>
              </Pressable>
              {moments.length > 0 ? (
                <Pressable onPress={() => openStories(0)} accessibilityLabel="Истории" style={({ pressed }) => [st.slideBtn, pressed && { backgroundColor: 'rgba(255,255,255,0.22)', transform: [{ scale: 0.96 }] }]}>
                  <IcoPlay />
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>

        {!loading && memory ? (
          <MomentIn delay={0}>
            <Pressable onPress={() => openStories(memoryIndex)} accessibilityRole="button" style={({ pressed }) => [pressed && { transform: [{ scale: 0.985 }] }]}>
              <LinearGradient {...cssLinear(135, ['hsl(349, 59%, 13%)', '#1a0b10'])} style={st.memory}>
                {memory.thumb_url || memory.photo_url ? (
                  <Image source={{ uri: memory.thumb_url || memory.photo_url! }} style={st.memoryThumb} contentFit="cover" />
                ) : (
                  <LinearGradient {...cssLinear(160, [getMood(memory.mood).color, '#1d0b12'])} style={[st.memoryThumb, { alignItems: 'center', justifyContent: 'center' }]}>
                    <Svg viewBox="0 0 24 22" width={20} height={18} fill="#fff" opacity={0.7}><Path d={HEART_S} /></Svg>
                  </LinearGradient>
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={st.memoryEyebrow}>В ЭТОТ ДЕНЬ</Text>
                  <Text style={st.memoryTitle} numberOfLines={1}>{memory.title}</Text>
                  <Text style={st.memorySub}>{yearsAgo(memoryYears)} · {formatDate(memory.created_at)}</Text>
                </View>
                <Svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Polyline points="9 6 15 12 9 18" /></Svg>
              </LinearGradient>
            </Pressable>
          </MomentIn>
        ) : null}

        {loading ? (
          <View style={st.empty}><LoadingHeart /></View>
        ) : (
          <View style={st.grid}>
            <MomentIn delay={0}>
              <Pressable onPress={() => setShowModal(true)} accessibilityRole="button" accessibilityLabel="Добавить фото"
                style={({ pressed }) => [st.addTile, { width: tileW, height: tileW * (4 / 3) }, pressed && { transform: [{ scale: 0.97 }] }]}>
                <View style={st.addTileCircle}><IcoPlus /></View>
                <Text style={st.addTileLabel}>Добавить фото</Text>
              </Pressable>
            </MomentIn>
            {moments.map((moment, i) => {
              const moodData = getMood(moment.mood);
              const isMine = moment.user_id === uid;
              return (
                <MomentIn key={moment.id} delay={Math.min(i, 8) * 50}>
                  <Pressable onPress={() => openStories(i)} accessibilityRole="button" accessibilityLabel={`${moment.title}, ${moodData.label}`}
                    style={({ pressed }) => [st.card, { width: tileW, height: tileW * (4 / 3) }, pressed && { transform: [{ scale: 0.97 }] }]}>
                    <LinearGradient {...cssLinear(160, ['#3a1622', '#1d0b12'])} style={StyleSheet.absoluteFill} />
                    {moment.photo_url && !imgErrors[moment.id] ? (
                      <Image source={{ uri: moment.thumb_url || moment.photo_url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150}
                        onError={() => setImgErrors((p) => ({ ...p, [moment.id]: true }))} />
                    ) : (
                      <LinearGradient {...cssLinear(160, [`${moodData.color}88`, '#1d0b12'])} style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
                        <Svg viewBox="0 0 60 56" width={48} height={44} fill="none"><Path d={HEART} fill="#ffffff" opacity={0.55} /></Svg>
                      </LinearGradient>
                    )}
                    {moment.liked ? (
                      <View style={st.likeBadge} pointerEvents="none">
                        <Svg viewBox="0 0 24 22" width={15} height={14} fill="#FF3B5C" stroke="white" strokeWidth={1.5}><Path d={HEART_S} /></Svg>
                      </View>
                    ) : null}
                    {isMine ? (
                      <Pressable onPress={() => deleteMoment(moment.id)} accessibilityLabel="Удалить момент" style={({ pressed }) => [st.delBtn, pressed && { backgroundColor: 'rgba(200,51,74,0.6)' }]} hitSlop={6}>
                        <IcoTrash />
                      </Pressable>
                    ) : null}
                    <LinearGradient colors={['rgba(10,4,8,0.82)', 'rgba(10,4,8,0.40)', 'transparent']} locations={[0, 0.55, 1]} start={{ x: 0.5, y: 1 }} end={{ x: 0.5, y: 0 }} style={st.overlay}>
                      <View style={st.moodChip}>
                        <View style={[st.dot8, { backgroundColor: moodData.color }]} />
                        <Text style={st.moodChipText}>{moodData.label}</Text>
                      </View>
                      <Text style={st.cardTitle} numberOfLines={2}>{moment.title}</Text>
                      <Text style={st.cardDate}>{formatDate(moment.created_at)}</Text>
                    </LinearGradient>
                  </Pressable>
                </MomentIn>
              );
            })}
          </View>
        )}
      </ScrollView>

      {showStories && moments.length > 0 ? (
        <StoriesViewer stories={moments} startIdx={storiesIdx} onClose={() => setShowStories(false)} onToggleLike={toggleLike} />
      ) : null}

      <WebModal visible={showModal} onClose={() => setShowModal(false)} title="Новый момент">
        <FormGroup label="Название">
          <FormInput placeholder="Прогулка по парку..." value={title} onChangeText={setTitle} />
        </FormGroup>
        <FormGroup label="Описание">
          <FormInput textarea placeholder="Расскажи об этом моменте..." value={description} onChangeText={setDescription} />
        </FormGroup>
        <FormGroup label="Настроение">
          <View style={st.moodGrid}>
            {MOODS.map((m) => (
              <Pressable key={m.value} onPress={() => setMood(m.value)} accessibilityRole="button" accessibilityState={{ selected: mood === m.value }}
                style={({ pressed }) => [st.moodBtn, { backgroundColor: mood === m.value ? `${m.color}22` : 'transparent', borderColor: mood === m.value ? m.color : 'rgba(0,0,0,0.1)' }, pressed && { transform: [{ scale: 0.95 }] }]}>
                <Text style={[st.moodBtnText, { color: mood === m.value ? m.color : colors.textMuted }]}>{m.label}</Text>
              </Pressable>
            ))}
          </View>
        </FormGroup>
        <FormGroup label="Фото">
          <FormFileLabel icon={<IcoCamera />} label={photo ? (photo.fileName || 'Фото выбрано') : 'Выбрать фото'} onPress={handlePhotoSelect} />
          {photo ? <Image source={{ uri: photo.uri }} style={st.photoPreview} contentFit="cover" accessibilityLabel="Preview" /> : null}
        </FormGroup>
        <FormSubmit label={saving ? (uploadStage || 'Сохраняем…') : 'Сохранить'} onPress={handleSubmit} disabled={saving} />
      </WebModal>
    </View>
  );
}

const st = StyleSheet.create({
  header: {
    borderBottomLeftRadius: 32, borderBottomRightRadius: 32, marginBottom: 18, overflow: 'hidden',
    shadowColor: 'rgb(60,20,40)', shadowOpacity: 0.45, shadowRadius: 20, shadowOffset: { width: 0, height: 12 },
  },
  headerTitle: { fontFamily: fonts.displayRegular, fontSize: 26, color: 'white', marginBottom: 4, textShadowColor: 'rgba(0,0,0,0.3)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.65)', fontFamily: fonts.body },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  addBtn: { flex: 1, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)', borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  addBtnText: { color: 'white', fontFamily: fonts.bodyMedium, fontSize: 14 },
  slideBtn: { backgroundColor: 'rgba(255,255,255,0.13)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', borderRadius: 14, width: 48, alignItems: 'center', justifyContent: 'center' },

  memory: {
    marginHorizontal: 14, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingLeft: 10, paddingRight: 12,
    borderRadius: 18, borderWidth: 1, borderColor: 'hsl(349, 59%, 24%)', shadowColor: 'rgb(200,51,74)', shadowOpacity: 0.1, shadowRadius: 9, shadowOffset: { width: 0, height: 4 },
  },
  memoryThumb: { width: 52, height: 52, borderRadius: 13, overflow: 'hidden' },
  memoryEyebrow: { fontSize: 10, letterSpacing: 1.4, color: colors.rose, fontFamily: fonts.bodyBold },
  memoryTitle: { fontSize: 14, fontFamily: fonts.bodySemi, color: colors.text, marginTop: 1 },
  memorySub: { fontSize: 12, color: colors.textMuted, fontFamily: fonts.body, marginTop: 1 },

  grid: { paddingHorizontal: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { borderRadius: 20, overflow: 'hidden', shadowColor: 'rgb(40,12,24)', shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } },
  overlay: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 1, paddingTop: 30, paddingHorizontal: 12, paddingBottom: 12 },
  cardTitle: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: '#fff', lineHeight: 17, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } },
  moodChip: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 3, paddingLeft: 7, paddingRight: 9, marginBottom: 7, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.42)' },
  moodChipText: { fontFamily: fonts.bodySemi, fontSize: 10, color: '#fff', letterSpacing: 0.2 },
  dot8: { width: 8, height: 8, borderRadius: 4 },
  cardDate: { marginTop: 4, fontSize: 11, color: 'rgba(255,255,255,0.78)', fontFamily: fonts.body },
  likeBadge: { position: 'absolute', top: 9, right: 9, zIndex: 2, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  delBtn: { position: 'absolute', top: 9, left: 9, zIndex: 2, backgroundColor: 'rgba(0,0,0,0.35)', width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  addTile: { borderRadius: 20, borderWidth: 2, borderStyle: 'dashed', borderColor: 'hsl(349, 59%, 32%)', backgroundColor: 'hsl(349, 59%, 12%)', alignItems: 'center', justifyContent: 'center', gap: 8 },
  addTileCircle: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.rose, alignItems: 'center', justifyContent: 'center', shadowColor: 'rgb(200,51,74)', shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 6 } },
  addTileLabel: { fontFamily: fonts.bodySemi, fontSize: 12.5, color: colors.rose },
  empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 20, gap: 12 },

  moodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  moodBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, borderWidth: 2 },
  moodBtnText: { fontFamily: fonts.bodySemi, fontSize: 12 },
  photoPreview: { width: '100%', height: 180, borderRadius: 12, marginTop: 10 },

  progRow: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 25, paddingHorizontal: 12, flexDirection: 'row', gap: 6 },
  progTrack: { flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 3, overflow: 'hidden' },
  progFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: '#fff', borderRadius: 3 },
  close: { position: 'absolute', right: 20, zIndex: 30, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  tap: { position: 'absolute', top: 0, width: '25%', height: '100%', zIndex: 20 },
  caption: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 15, alignItems: 'flex-start', paddingTop: 100, paddingRight: 96, paddingLeft: 24 },
  storyMood: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingLeft: 8, paddingRight: 11, marginBottom: 10, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.16)' },
  storyMoodText: { fontFamily: fonts.bodySemi, fontSize: 11, color: '#fff', letterSpacing: 0.2 },
  storyTitle: { fontFamily: fonts.displaySemi, fontSize: 28, color: 'white', marginBottom: 8, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 12, textShadowOffset: { width: 0, height: 2 } },
  storyDesc: { fontFamily: fonts.body, fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 21 },
  storyDate: { fontFamily: fonts.body, fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 8 },
  heartBtn: { position: 'absolute', right: 24, zIndex: 20, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)', borderRadius: 28, width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  heartBtnLiked: { backgroundColor: 'rgba(255,59,92,0.18)', borderColor: 'rgba(255,59,92,0.55)' },
  burst: { position: 'absolute', top: '50%', left: '50%', width: 7, height: 7, marginTop: -3.5, marginLeft: -3.5, borderRadius: 3.5, backgroundColor: '#FF3B5C' },
});
