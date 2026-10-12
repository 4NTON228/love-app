// Компоненты Chat.jsx: Avatar, VideoCircle, VoiceMessage, ReplyPreview, Reactions,
// TextBubble, Message (долгое нажатие, двойной тап, свайп-ответ), PhotoLightbox,
// ContextMenu, SearchOverlay.
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Easing, FlatList, Modal, PanResponder, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path, Polygon, Polyline, Rect } from 'react-native-svg';
import { BlurView } from 'expo-blur';

import { RichText } from '@/lib/richText';
import { thud, tap } from '@/lib/haptics';
import { cssLinear, fonts, gradients } from '@/theme';

export const REACTIONS = ['❤️', '🔥', '😍', '😂', '👍', '💔'];
export const VALID_REACTIONS = new Set(REACTIONS);
const WAVE_H = [
  3, 5, 8, 6, 4, 7, 11, 15, 19, 22, 17, 13, 8, 5, 7, 12, 18, 24, 28, 24, 19, 14, 9,
  6, 4, 8, 13, 19, 25, 30, 26, 21, 16, 11, 7, 5, 9, 15, 21, 27, 30, 25, 19, 13, 8,
  5, 8, 13, 18, 22, 26, 22, 17, 12, 7, 4, 6, 10, 14, 18, 13, 8, 5,
];

// Тёмная тема Chat.jsx (dark = true)
export const CH = {
  BG: '#200A10', SURF: '#1E0A10', SURF2: '#3D1520', INK: '#F5E8EA', MUTED: '#8A5060',
  BDR: 'rgba(232,85,106,0.18)', ROSE: 'hsl(349, 59%, 41%)', RED: '#C8334A',
};

export type ChatMsg = {
  id: string; user_id: string; text: string | null; photo_url: string | null; video_url: string | null;
  audio_url: string | null; is_voice: boolean | null; is_video_circle: boolean | null; duration: number | null;
  reply_to_id: string | null; created_at: string; edited_at: string | null; read_at: string | null;
  reactions: Record<string, string[]> | null; is_pinned: boolean | null; is_encrypted: boolean; ciphertext: string | null;
  _decryptFailed?: boolean;
};

export function pad(n: number) { return String(n).padStart(2, '0'); }
export function fmtTime(d: string) { const dt = new Date(d); return `${pad(dt.getHours())}:${pad(dt.getMinutes())}`; }
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
export function fmtDateSep(d: string) {
  const dt = new Date(d), now = new Date();
  const y = new Date(now); y.setDate(y.getDate() - 1);
  if (dt.toDateString() === now.toDateString()) return 'Сегодня';
  if (dt.toDateString() === y.toDateString()) return 'Вчера';
  return `${dt.getDate()} ${MONTHS_GEN[dt.getMonth()]} ${dt.getFullYear()} г.`;
}
export function diffDate(a?: string, b?: string) { return new Date(a ?? 0).toDateString() !== new Date(b ?? 0).toDateString(); }
function fmtDuration(sec: number) {
  if (!sec) return '0:00';
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}
export function hasValidReactions(r: ChatMsg['reactions']) {
  return !!r && Object.keys(r).some((k) => VALID_REACTIONS.has(k));
}

/* ── галочки прочтения ── */
export function Ticks({ read, color = 'rgba(255,255,255,0.8)', faded = 'rgba(255,255,255,0.4)', w = 20, h = 9 }: { read: boolean; color?: string; faded?: string; w?: number; h?: number }) {
  const c1 = read ? '#4FC3F7' : color, c2 = read ? '#4FC3F7' : faded;
  return (
    <Svg viewBox="0 0 20 9" width={w} height={h} fill="none">
      <Path d="M1 4.5l3 3L11 1" stroke={c1} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M7 4.5l3 3L17 1" stroke={c2} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/* ── Avatar ── */
export function Avatar({ url, size = 40 }: { url?: string | null; size?: number }) {
  const [err, setErr] = useState(false);
  return (
    <LinearGradient {...cssLinear(gradients.bubbleMine.angle, gradients.bubbleMine.colors)} style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
      {url && !err ? <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} contentFit="cover" onError={() => setErr(true)} /> : (
        <Svg viewBox="0 0 40 40" width={size} height={size} fill="none">
          <Circle cx="20" cy="15" r="7" fill="rgba(255,255,255,.85)" />
          <Path d="M5 37c0-8.3 6.7-15 15-15s15 6.7 15 15" fill="rgba(255,255,255,.65)" />
        </Svg>
      )}
    </LinearGradient>
  );
}

/* ── VideoCircle ── */
export const VideoCircle = memo(function VideoCircle({ url, isMine, time, readAt }: { url: string; isMine: boolean; time: string; readAt: string | null }) {
  const player = useVideoPlayer(url, (p) => { p.loop = false; });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const [ended, setEnded] = useState(false);
  useEffect(() => {
    const sub = player.addListener('playToEnd', () => setEnded(true));
    return () => sub.remove();
  }, [player]);

  function toggle() {
    if (isPlaying) player.pause();
    else {
      if (ended) { setEnded(false); player.replay(); } else player.play();
    }
  }

  return (
    <Pressable onPress={toggle} accessibilityRole="button" accessibilityLabel={isPlaying ? 'Пауза' : 'Воспроизвести кружок'}>
      <View style={[st.circle, { borderColor: isMine ? '#C8334A' : 'rgba(200,51,74,0.35)' }]}>
        <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
      </View>
      {!isPlaying ? (
        <View style={st.circleOverlay} pointerEvents="none">
          <View style={st.circlePlay}>
            {ended ? (
              <Svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="white" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <Polyline points="1 4 1 10 7 10" /><Path d="M3.51 15a9 9 0 1 0 .49-4.65" />
              </Svg>
            ) : (
              <Svg viewBox="0 0 24 24" width={24} height={24} fill="white"><Polygon points="7,4 20,12 7,20" /></Svg>
            )}
          </View>
        </View>
      ) : null}
      <View style={st.circleTime} pointerEvents="none">
        <Text style={st.circleTimeText}>{time}</Text>
        {isMine ? <Ticks read={!!readAt} w={18} h={8} /> : null}
      </View>
    </Pressable>
  );
});

/* ── VoiceMessage ── */
export const VoiceMessage = memo(function VoiceMessage({ url, isMine, duration, time, readAt }: { url: string; isMine: boolean; duration: number | null; time: string; readAt: string | null }) {
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const loaded = useRef(false);
  const progress = status.duration ? status.currentTime / status.duration : 0;
  const BAR_W = 2, BAR_GAP = 1, BAR_MAX_H = 28;
  const svgW = WAVE_H.length * (BAR_W + BAR_GAP);

  useEffect(() => {
    if (status.didJustFinish) { player.pause(); player.seekTo(0); }
  }, [status.didJustFinish, player]);

  async function toggle() {
    if (status.playing) { player.pause(); return; }
    if (!loaded.current) {
      await setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
      player.replace({ uri: url });
      loaded.current = true;
    }
    player.play();
  }

  const content = (
    <>
      <Pressable onPress={toggle} accessibilityRole="button" accessibilityLabel={status.playing ? 'Пауза' : 'Слушать голосовое'}
        style={[st.voiceBtn, { backgroundColor: isMine ? 'rgba(255,255,255,0.22)' : 'rgba(200,51,74,0.1)' }]}>
        <Svg viewBox="0 0 24 24" width={16} height={16} fill={isMine ? 'white' : '#C8334A'}>
          {status.playing ? (<><Rect x="6" y="4" width="4" height="16" rx="1" /><Rect x="14" y="4" width="4" height="16" rx="1" /></>) : <Polygon points="5,3 19,12 5,21" />}
        </Svg>
      </Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Svg viewBox={`0 0 ${svgW} ${BAR_MAX_H}`} width={Math.min(svgW, 170)} height={BAR_MAX_H}>
          {WAVE_H.map((h, i) => (
            <Rect key={i} x={i * (BAR_W + BAR_GAP)} y={BAR_MAX_H - h} width={BAR_W} height={h} rx={1}
              fill={progress * WAVE_H.length > i ? (isMine ? 'rgba(255,255,255,0.92)' : '#C8334A') : (isMine ? 'rgba(255,255,255,0.30)' : 'rgba(200,51,74,0.22)')} />
          ))}
        </Svg>
        <View style={st.voiceMeta}>
          <Text style={[st.voiceMetaText, { color: isMine ? 'rgba(255,255,255,0.65)' : CH.MUTED }]}>{fmtDuration(duration || 0)} · {time}</Text>
          {isMine ? <Ticks read={!!readAt} w={18} h={8} color="rgba(255,255,255,0.7)" faded="rgba(255,255,255,0.35)" /> : null}
        </View>
      </View>
    </>
  );
  return isMine
    ? <LinearGradient {...cssLinear(gradients.bubbleMine.angle, gradients.bubbleMine.colors)} style={st.voice}>{content}</LinearGradient>
    : <View style={[st.voice, { backgroundColor: CH.SURF, borderWidth: 0.5, borderColor: 'rgba(200,51,74,0.15)' }]}>{content}</View>;
});

/* ── ReplyPreview ── */
export const ReplyPreview = memo(function ReplyPreview({ msg, isMine, uid, partnerName }: { msg: ChatMsg; isMine: boolean; uid: string; partnerName: string }) {
  return (
    <View style={st.replyPrev}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={st.replyWho}>{msg.user_id === uid ? 'Вы' : (partnerName || 'Партнёр')}</Text>
        <Text numberOfLines={1} style={[st.replyText, { color: isMine ? 'rgba(255,255,255,0.72)' : CH.MUTED }]}>
          {msg.photo_url && !msg.text ? 'Фото' : (msg.text || '')}
        </Text>
      </View>
      {msg.photo_url ? <Image source={{ uri: msg.photo_url }} style={st.replyThumb} contentFit="cover" /> : null}
    </View>
  );
});

/* ── Reactions ── */
export const Reactions = memo(function Reactions({ reactions, uid, onReact, msgId, isMine }: { reactions: Record<string, string[]>; uid: string; onReact: (id: string, e: string) => void; msgId: string; isMine: boolean }) {
  const valid = Object.entries(reactions).filter(([e]) => VALID_REACTIONS.has(e));
  if (!valid.length) return null;
  return (
    <View style={[st.reactions, { justifyContent: isMine ? 'flex-end' : 'flex-start' }]}>
      {valid.map(([emoji, users]) => users.length > 0 ? (
        <Pressable key={emoji} onPress={() => onReact(msgId, emoji)} accessibilityRole="button" accessibilityLabel={`${emoji} ${users.length}`}
          style={[st.reaction, users.includes(uid) ? { backgroundColor: 'rgba(200,51,74,0.2)', borderColor: 'rgba(200,51,74,0.5)' } : { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
          <Text style={{ fontSize: 13 }}>{emoji}</Text>
          <Text style={st.reactionCount}>{users.length}</Text>
        </Pressable>
      ) : null)}
    </View>
  );
});

/* ── TextBubble ── */
type Radius = { tl: number; tr: number; br: number; bl: number };
const TextBubble = memo(function TextBubble({ msg, isMine, radius, replyData, uid, partnerName, onPhotoOpen }: {
  msg: ChatMsg; isMine: boolean; radius: Radius; replyData: ChatMsg | null; uid: string; partnerName: string; onPhotoOpen: (url: string) => void;
}) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => { Animated.timing(v, { toValue: 1, duration: 200, easing: Easing.out(Easing.ease), useNativeDriver: true }).start(); }, [v]);
  const [photoErr, setPhotoErr] = useState(false);
  const br = { borderTopLeftRadius: radius.tl, borderTopRightRadius: radius.tr, borderBottomRightRadius: radius.br, borderBottomLeftRadius: radius.bl };
  const anim = { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }, { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }] };

  if (msg._decryptFailed) {
    return (
      <View style={[st.failed, br]}>
        <Text style={st.failedText}>🔒 Не удалось расшифровать сообщение</Text>
      </View>
    );
  }
  const onlyPhoto = !!msg.photo_url && !msg.text;
  const color = isMine ? 'white' : CH.INK;
  const inner = (
    <>
      {replyData ? <ReplyPreview msg={replyData} isMine={isMine} uid={uid} partnerName={partnerName} /> : null}
      {msg.photo_url && !photoErr ? (
        <Pressable onPress={() => onPhotoOpen(msg.photo_url!)} accessibilityRole="imagebutton" accessibilityLabel="Открыть фото">
          <Image source={{ uri: msg.photo_url }} onError={() => setPhotoErr(true)} contentFit="cover"
            style={{ width: 240, height: 240, maxHeight: 280, borderRadius: msg.text ? 10 : 14, marginBottom: msg.text ? 6 : 0, marginTop: replyData ? 6 : 0 }} />
        </Pressable>
      ) : null}
      {msg.text ? <RichText text={msg.text} style={{ color, fontSize: 15, lineHeight: 22, fontFamily: fonts.body }} /> : null}
      <View style={st.meta}>
        {msg.edited_at ? <Text style={[st.metaText, { color }]}>ред.</Text> : null}
        <Text style={[st.metaText, { color }]}>{fmtTime(msg.created_at)}</Text>
        {isMine ? <Ticks read={!!msg.read_at} color="rgba(255,255,255,0.65)" faded="rgba(255,255,255,0.26)" /> : null}
      </View>
    </>
  );
  const pad = onlyPhoto && !replyData ? { padding: 3 } : { paddingTop: 10, paddingHorizontal: 14, paddingBottom: 8 };
  return (
    <Animated.View style={[anim, st.bubbleShadow]}>
      {isMine
        ? <LinearGradient {...cssLinear(gradients.bubbleMine.angle, gradients.bubbleMine.colors)} style={[st.bubble, br, pad]}>{inner}</LinearGradient>
        : <View style={[st.bubble, br, pad, { backgroundColor: CH.SURF, borderWidth: 0.5, borderColor: 'rgba(200,51,74,0.15)' }]}>{inner}</View>}
    </Animated.View>
  );
});

/* ── Message: долгое нажатие → меню, двойной тап → ❤️, свайп → ответ ── */
export const Message = memo(function Message({ msg, isMine, uid, partnerName, onLongPress, onReact, onReply, onPhotoOpen, isLast, replyData }: {
  msg: ChatMsg; isMine: boolean; uid: string; partnerName: string; isLast: boolean; replyData: ChatMsg | null;
  onLongPress: (m: ChatMsg) => void; onReact: (id: string, e: string) => void; onReply: (id: string) => void; onPhotoOpen: (u: string) => void;
}) {
  const lastTap = useRef(0);
  const [dx] = useState(() => new Animated.Value(0));
  const [hint, setHint] = useState(0);

  const pan = useMemo(() => {
    const g0 = { cur: 0 }; // текущий сдвиг жеста
    return PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5 && (isMine ? g.dx < 0 : g.dx > 0),
    onPanResponderMove: (_, g) => {
      const rightDir = isMine ? g.dx < 0 : g.dx > 0;
      if (!rightDir) return;
      const clamped = Math.min(Math.abs(g.dx), 68) * (isMine ? -1 : 1);
      g0.cur = clamped;
      dx.setValue(clamped);
      setHint(Math.abs(clamped));
    },
    onPanResponderRelease: () => {
      if (Math.abs(g0.cur) >= 55) { thud(); onReply(msg.id); }
      g0.cur = 0;
      setHint(0);
      Animated.timing(dx, { toValue: 0, duration: 200, easing: Easing.bezier(0.25, 1, 0.5, 1), useNativeDriver: true }).start();
    },
    onPanResponderTerminate: () => { g0.cur = 0; setHint(0); dx.setValue(0); },
    });
  }, [isMine, msg.id, onReply, dx]);

  const radius: Radius = isMine
    ? { tl: 18, tr: 18, br: isLast ? 4 : 8, bl: 18 }
    : { tl: 18, tr: 18, br: 18, bl: isLast ? 4 : 8 };

  function handlePress() {
    const now = Date.now();
    if (now - lastTap.current < 300) onReact(msg.id, '❤️');
    lastTap.current = now;
  }

  const replyBox = replyData ? (
    isMine
      ? <LinearGradient {...cssLinear(135, ['#C8334A', '#8B1A2C'])} style={st.mediaReply}><ReplyPreview msg={replyData} isMine uid={uid} partnerName={partnerName} /></LinearGradient>
      : <View style={[st.mediaReply, { backgroundColor: CH.SURF, borderWidth: 0.5, borderColor: 'rgba(200,51,74,0.15)' }]}><ReplyPreview msg={replyData} isMine={false} uid={uid} partnerName={partnerName} /></View>
  ) : null;

  return (
    <View>
      {hint > 18 ? (
        <View pointerEvents="none" style={[st.replyHint, isMine ? { right: hint + 6 } : { left: hint + 6 }, { opacity: Math.min(hint / 55, 1) }]}>
          <Svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="#C8334A" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <Polyline points="9 17 4 12 9 7" /><Line x1="20" y1="12" x2="4" y2="12" />
          </Svg>
        </View>
      ) : null}
      <Animated.View style={{ transform: [{ translateX: dx }] }} {...pan.panHandlers}>
        <Pressable onPress={handlePress} onLongPress={() => { thud(); onLongPress(msg); }} delayLongPress={490}
          accessibilityHint="Двойное касание — ❤️, долгое — меню">
          {msg.is_video_circle && msg.video_url ? (
            <View style={{ gap: 4, alignItems: isMine ? 'flex-end' : 'flex-start' }}>
              {replyBox}
              <VideoCircle url={msg.video_url} isMine={isMine} time={fmtTime(msg.created_at)} readAt={msg.read_at} />
            </View>
          ) : msg.is_voice && msg.audio_url ? (
            <View style={{ gap: 4 }}>
              {replyBox}
              <VoiceMessage url={msg.audio_url} isMine={isMine} duration={msg.duration} time={fmtTime(msg.created_at)} readAt={msg.read_at} />
            </View>
          ) : (
            <TextBubble msg={msg} isMine={isMine} radius={radius} replyData={replyData} uid={uid} partnerName={partnerName} onPhotoOpen={onPhotoOpen} />
          )}
          {hasValidReactions(msg.reactions) ? <Reactions reactions={msg.reactions!} uid={uid} onReact={onReact} msgId={msg.id} isMine={isMine} /> : null}
        </Pressable>
      </Animated.View>
    </View>
  );
});

/* ── PhotoLightbox ── */
export function PhotoLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={st.lightbox} onPress={onClose} accessibilityLabel="Закрыть фото">
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.93)' }]} />
        <Image source={{ uri: url }} style={{ width: '96%', height: '88%', borderRadius: 12 }} contentFit="contain" />
        <Pressable onPress={onClose} style={[st.lightboxClose, { top: Math.max(16, insets.top) }]} accessibilityLabel="Закрыть">
          <Svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="white" strokeWidth={2.2}><Line x1="18" y1="6" x2="6" y2="18" /><Line x1="6" y1="6" x2="18" y2="18" /></Svg>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ── ContextMenu ── */
export type CtxMenu = { msgId: string; text: string; isMe: boolean; isPinned: boolean } | null;

function MenuIcon({ d, stroke = '#C8334A' }: { d: string; stroke?: string }) {
  return <Svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Path d={d} /></Svg>;
}

const MENU_DIV = 'rgba(232,85,106,0.1)';
function MenuRow({ label, d, onPress, onClose, danger, last }: { label: string; d: string; onPress: () => void; onClose: () => void; danger?: boolean; last?: boolean }) {
  return (
    <Pressable onPress={() => { tap(); onPress(); onClose(); }} accessibilityRole="button"
      style={({ pressed }) => [st.menuRow, !last && { borderBottomWidth: 0.5, borderBottomColor: MENU_DIV }, pressed && { backgroundColor: 'rgba(255,255,255,0.04)' }]}>
      <MenuIcon d={d} stroke={danger ? '#E0404A' : '#C8334A'} />
      <Text style={[st.menuText, danger && { color: '#E0404A' }]}>{label}</Text>
    </Pressable>
  );
}

export function ContextMenu({ menu, onClose, onEdit, onDelete, onPin, onReply, onReact }: {
  menu: CtxMenu; onClose: () => void; onEdit: (id: string, text: string) => void; onDelete: (id: string) => void;
  onPin: (id: string) => void; onReply: (id: string) => void; onReact: (id: string, e: string) => void;
}) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!menu) return;
    v.setValue(0);
    Animated.timing(v, { toValue: 1, duration: 180, easing: Easing.bezier(0.34, 1.56, 0.64, 1), useNativeDriver: true }).start();
  }, [menu, v]);
  if (!menu) return null;
  const divColor = MENU_DIV;
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Закрыть меню">
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)' }]} />
      </Pressable>
      <View style={st.menuCenter} pointerEvents="box-none">
        <Animated.View style={[st.menu, { opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) }] }]}>
          <View style={[st.menuReacts, { borderBottomColor: divColor }]}>
            {REACTIONS.map((r) => (
              <Pressable key={r} onPress={() => { onReact(menu.msgId, r); onClose(); }} accessibilityLabel={`Реакция ${r}`}
                style={({ pressed }) => [{ paddingVertical: 4, paddingHorizontal: 6 }, pressed && { transform: [{ scale: 1.35 }] }]}>
                <Text style={{ fontSize: 24 }}>{r}</Text>
              </Pressable>
            ))}
          </View>
          <MenuRow onClose={onClose} label="Ответить" d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" onPress={() => onReply(menu.msgId)} />
          {menu.isMe && menu.text ? <MenuRow onClose={onClose} label="Редактировать" d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4z" onPress={() => onEdit(menu.msgId, menu.text)} /> : null}
          {menu.text ? <MenuRow onClose={onClose} label="Копировать" d="M8 4H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2M16 2H8a2 2 0 00-2 2v0a2 2 0 002 2h8a2 2 0 002-2v0a2 2 0 00-2-2z" onPress={() => { Clipboard.setStringAsync(menu.text); }} /> : null}
          <MenuRow onClose={onClose} label={menu.isPinned ? 'Открепить' : 'Закрепить'} last={!menu.isMe}
            d="M12 17v5M5 17h14v-1.76a2 2 0 00-1.11-1.79l-1.78-.9A2 2 0 0115 10.76V6h1a2 2 0 000-4H8a2 2 0 000 4h1v4.76a2 2 0 01-1.11 1.79l-1.78.9A2 2 0 005 15.24V17z" onPress={() => onPin(menu.msgId)} />
          {menu.isMe ? <MenuRow onClose={onClose} label="Удалить" danger last d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" onPress={() => onDelete(menu.msgId)} /> : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

/* ── SearchOverlay ── */
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <Text style={st.searchText}>{text}</Text>;
  const safe = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${safe})`, 'gi'));
  return (
    <Text style={st.searchText}>
      {parts.map((p, i) => (p.toLowerCase() === query.toLowerCase()
        ? <Text key={i} style={{ backgroundColor: 'rgba(200,51,74,0.3)' }}>{p}</Text>
        : <Text key={i}>{p}</Text>))}
    </Text>
  );
}

export function SearchOverlay({ messages, onClose, onJump }: { messages: ChatMsg[]; onClose: () => void; onJump: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const [idx, setIdx] = useState(0);
  const insets = useSafeAreaInsets();
  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return messages.filter((m) => m.text?.toLowerCase().includes(q));
  }, [query, messages]);
  const goTo = (i: number) => { const m = results[i]; if (!m) return; setIdx(i); onJump(m.id); };

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 50, backgroundColor: CH.SURF, paddingTop: insets.top }]}>
      <View style={st.searchBar}>
        <Pressable onPress={onClose} accessibilityLabel="Закрыть поиск" hitSlop={8}><Text style={{ color: '#C8334A', fontSize: 22 }}>←</Text></Pressable>
        <TextInput autoFocus value={query} onChangeText={(t) => { setQuery(t); setIdx(0); }} placeholder="Поиск по сообщениям..."
          placeholderTextColor={CH.MUTED} style={st.searchInput} selectionColor="#C8334A" accessibilityLabel="Поиск по сообщениям" />
        {results.length > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 12, color: CH.MUTED }}>{idx + 1}/{results.length}</Text>
            <Pressable onPress={() => goTo(Math.max(0, idx - 1))} accessibilityLabel="Предыдущее" hitSlop={6}><Text style={st.arrow}>↑</Text></Pressable>
            <Pressable onPress={() => goTo(Math.min(results.length - 1, idx + 1))} accessibilityLabel="Следующее" hitSlop={6}><Text style={st.arrow}>↓</Text></Pressable>
          </View>
        ) : null}
      </View>
      <FlatList
        data={results}
        keyExtractor={(m) => m.id}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={query ? <Text style={st.searchEmpty}>Ничего не найдено</Text> : null}
        renderItem={({ item, index }) => (
          <Pressable onPress={() => goTo(index)} style={[st.searchRow, index === idx && { backgroundColor: 'rgba(200,51,74,0.08)' }]}>
            <Text style={st.searchDate}>{fmtDateSep(item.created_at)}</Text>
            <Highlight text={item.text || ''} query={query} />
          </Pressable>
        )}
      />
    </View>
  );
}

/* ── иконки панели ввода ── */
export const IcCamera = ({ c }: { c: string }) => <Svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke={c} strokeWidth={2}><Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><Circle cx="12" cy="13" r="4" /></Svg>;
export const IcVideo = ({ c, s = 20 }: { c: string; s?: number }) => <Svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke={c} strokeWidth={2}><Polygon points="23 7 16 12 23 17 23 7" /><Rect x="1" y="5" width="15" height="14" rx="2" /></Svg>;
export const IcMic = ({ c, s = 20 }: { c: string; s?: number }) => <Svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke={c} strokeWidth={2}><Path d="M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3z" /><Path d="M19 10v2a7 7 0 01-14 0v-2M12 19v3" /></Svg>;
export const IcSend = ({ s = 18 }: { s?: number }) => <Svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="white" strokeWidth={2.5}><Line x1="22" y1="2" x2="11" y2="13" /><Polygon points="22 2 15 22 11 13 2 9 22 2" /></Svg>;
export const IcX = ({ c = CH.MUTED }: { c?: string }) => <Svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke={c} strokeWidth={2}><Line x1="18" y1="6" x2="6" y2="18" /><Line x1="6" y1="6" x2="18" y2="18" /></Svg>;
export const IcSearch = () => <Svg viewBox="0 0 24 24" width={17} height={17} fill="none" stroke="#C8334A" strokeWidth={2} strokeLinecap="round"><Circle cx="11" cy="11" r="8" /><Line x1="21" y1="21" x2="16.65" y2="16.65" /></Svg>;
export const IcPin = ({ c }: { c: string }) => <Svg viewBox="0 0 24 24" width={11} height={11} fill="none" stroke={c} strokeWidth={2}><Path d="M12 17v5 M5 17h14v-1.76a2 2 0 00-1.11-1.79l-1.78-.9A2 2 0 0115 10.76V6h1a2 2 0 000-4H8a2 2 0 000 4h1v4.76a2 2 0 01-1.11 1.79l-1.78.9A2 2 0 005 15.24V17z" /></Svg>;
export const IcDown = ({ c }: { c: string }) => <Svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke={c} strokeWidth={2}><Polyline points="6 9 12 15 18 9" /></Svg>;
export const IcEdit = ({ c }: { c: string }) => <Svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke={c} strokeLinecap="round" strokeLinejoin="round"><Path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><Path d="M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4z" /></Svg>;

const st = StyleSheet.create({
  circle: { width: 180, height: 180, borderRadius: 90, overflow: 'hidden', borderWidth: 2.5, shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 8, backgroundColor: '#000' },
  circleOverlay: { ...StyleSheet.absoluteFill, borderRadius: 90, backgroundColor: 'rgba(0,0,0,0.32)', alignItems: 'center', justifyContent: 'center' },
  circlePlay: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.18)' },
  circleTime: { position: 'absolute', bottom: 12, right: 14, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 6, paddingVertical: 2, paddingHorizontal: 7, flexDirection: 'row', alignItems: 'center', gap: 4 },
  circleTimeText: { fontSize: 10, color: 'white', fontFamily: 'monospace' },

  voice: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingLeft: 10, paddingRight: 14, borderRadius: 18, minWidth: 220 },
  voiceBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  voiceMeta: { marginTop: 3, flexDirection: 'row', alignItems: 'center', gap: 4 },
  voiceMetaText: { fontSize: 10, fontFamily: fonts.body },

  replyPrev: { flexDirection: 'row', gap: 6, marginBottom: 5, borderLeftWidth: 3, borderLeftColor: '#C8334A', paddingLeft: 8, opacity: 0.82 },
  replyWho: { fontSize: 11, color: '#C8334A', fontFamily: fonts.bodySemi, marginBottom: 1 },
  replyText: { fontSize: 12, fontFamily: fonts.body },
  replyThumb: { width: 34, height: 34, borderRadius: 6 },
  mediaReply: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 14, maxWidth: 240 },

  reactions: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, marginTop: 3 },
  reaction: { borderRadius: 999, paddingVertical: 3, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: 'transparent' },
  reactionCount: { fontSize: 11, color: '#C4909A', fontFamily: fonts.body },

  failed: { paddingVertical: 8, paddingHorizontal: 12, backgroundColor: CH.SURF, borderWidth: 0.5, borderColor: 'rgba(200,51,74,0.3)', maxWidth: 280 },
  failedText: { fontSize: 13, color: 'rgba(245,232,234,0.5)', fontStyle: 'italic', fontFamily: fonts.body },
  bubble: { maxWidth: 290, overflow: 'hidden' },
  bubbleShadow: { shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3, marginTop: 3, opacity: 0.65 },
  metaText: { fontSize: 10, fontFamily: fonts.body },
  replyHint: { position: 'absolute', top: '50%', marginTop: -13, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(200,51,74,0.18)', alignItems: 'center', justifyContent: 'center', zIndex: 1 },

  lightbox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  lightboxClose: { position: 'absolute', right: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },

  menuCenter: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  menu: {
    backgroundColor: CH.SURF, borderRadius: 22, overflow: 'hidden', minWidth: 252, maxWidth: '100%',
    borderWidth: 0.5, borderColor: 'rgba(232,85,106,0.18)', shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 28, shadowOffset: { width: 0, height: 16 },
  },
  menuReacts: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 12, paddingBottom: 10, paddingHorizontal: 8, borderBottomWidth: 0.5 },
  menuRow: { width: '100%', paddingVertical: 13, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 13 },
  menuText: { fontSize: 15, color: CH.INK, fontFamily: fonts.body },

  searchBar: { paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 0.5, borderBottomColor: CH.BDR },
  searchInput: { flex: 1, fontSize: 15, color: CH.INK, fontFamily: fonts.body, paddingVertical: 4 },
  arrow: { color: '#C8334A', fontSize: 18 },
  searchEmpty: { textAlign: 'center', paddingVertical: 40, paddingHorizontal: 20, color: CH.MUTED, fontSize: 14, fontFamily: fonts.body },
  searchRow: { paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: 0.5, borderBottomColor: CH.BDR },
  searchDate: { fontSize: 11, color: '#C8334A', marginBottom: 3, fontFamily: fonts.body },
  searchText: { fontSize: 14, color: CH.INK, fontFamily: fonts.body },
});
