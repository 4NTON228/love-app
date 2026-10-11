// Порт src/components/Chat.jsx (тёмная тема).
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Animated, AppState, Easing, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient as SvgLinear, Path, Stop } from 'react-native-svg';

import {
  Avatar, CH, ContextMenu, type ChatMsg, type CtxMenu, IcCamera, IcDown, IcEdit, IcMic, IcPin, IcSearch, IcSend, IcVideo, IcX,
  Message, PhotoLightbox, SearchOverlay, VALID_REACTIONS, diffDate, fmtDateSep,
} from '@/components/chat/parts';
import { beatScale, useLoop } from '@/components/anim';
import { useKeyboardVisible } from '@/hooks/useKeyboardVisible';
import { useRoomKeys } from '@/hooks/useRoomKeys';
import { encryptMessage, isEncryptedEnvelope, type RoomKey, safeDecryptWithKeys } from '@/lib/crypto';
import { chooseImage, compressImage, uploadToStorage, webFileName } from '@/lib/media';
import { sendPushNotification } from '@/lib/notify';
import { supabase } from '@/lib/supabase';
import { useMe } from '@/providers/AuthProvider';
import { cssLinear, fonts, gradients } from '@/theme';

const GROUP_DIFF_SECONDS = 121;

function fmtLastSeen(ts: string | null) {
  if (!ts) return 'не в сети';
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60) return 'в сети';
  if (diff < 3600) return `был(а) ${Math.floor(diff / 60)} мин. назад`;
  if (diff < 86400) return `был(а) ${Math.floor(diff / 3600)} ч. назад`;
  return 'был(а) давно';
}
const isOnline = (ts: string | null) => !!ts && Date.now() - new Date(ts).getTime() < 120000;
function isSameGroup(a?: ChatMsg, b?: ChatMsg) {
  if (!a || !b || a.user_id !== b.user_id) return false;
  return Math.abs(new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) / 1000 <= GROUP_DIFF_SECONDS;
}
function needAvatar(msg: ChatMsg, next: ChatMsg | undefined, uid: string) {
  if (msg.user_id === uid) return false;
  if (!next) return true;
  if (next.user_id !== msg.user_id) return true;
  return diffDate(msg.created_at, next.created_at);
}

function decryptMsg(m: ChatMsg, keys: RoomKey[]): ChatMsg {
  if (!(m.is_encrypted || isEncryptedEnvelope(m.ciphertext))) return m;
  if (!keys.length) return { ...m, _decryptFailed: false };
  const { ok, text } = safeDecryptWithKeys(m.ciphertext!, keys);
  return ok ? { ...m, text } : { ...m, text: null, _decryptFailed: true };
}

const GRAD = cssLinear(gradients.bubbleMine.angle, gradients.bubbleMine.colors);

function Pulse({ children, dur = 1000 }: { children: React.ReactNode; dur?: number }) {
  const v = useLoop(dur, 0, Easing.inOut(Easing.ease));
  return (
    <Animated.View style={{
      opacity: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.5, 1] }),
      transform: [{ scale: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.1, 1] }) }],
    }}>{children}</Animated.View>
  );
}

function LoadingHeart() {
  const v = useLoop(1400, 0, Easing.inOut(Easing.ease));
  return (
    <View style={[st.center, { backgroundColor: CH.BG }]}>
      <Animated.View style={{ transform: [{ scale: beatScale(v, 1.3, 1.2) }] }}>
        <Svg viewBox="0 0 60 56" width={64} height={60} fill="none">
          <Defs><SvgLinear id="grad" x1="0" y1="0" x2="60" y2="56" gradientUnits="userSpaceOnUse"><Stop offset="0%" stopColor="#E8556A" /><Stop offset="100%" stopColor="#C8334A" /></SvgLinear></Defs>
          <Path d="M30 52C30 52 3 35 3 16C3 8 9.5 2 18 2C22.5 2 26.5 4.5 30 9C33.5 4.5 37.5 2 42 2C50.5 2 57 8 57 16C57 35 30 52 30 52Z" fill="url(#grad)" />
        </Svg>
      </Animated.View>
    </View>
  );
}

export default function Chat() {
  const { uid, profile, partner } = useMe();
  const pid = profile.partner_id;
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardVisible();
  const { roomKey, roomKeys } = useRoomKeys(uid, pid);

  const [messages, setMessages] = useState<ChatMsg[]>([]); // по возрастанию, как в вебе
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [allLoaded, setAllLoaded] = useState(false);
  const [newText, setNewText] = useState('');
  const [sending, setSending] = useState(false);
  const [showDown, setShowDown] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [partnerRecording, setPartnerRecording] = useState<'voice' | 'video' | null>(null);
  const [partnerLastSeen, setPartnerLastSeen] = useState<string | null>(partner?.last_seen ?? null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [voiceRec, setVoiceRec] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<{ id: string; text: string | null; user_id: string; photo_url: string | null } | null>(null);
  const [ctxMenu, setCtxMenu] = useState<CtxMenu>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const listRef = useRef<FlatList>(null);
  const broadcastRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const cancelledRef = useRef(false);
  const voiceCancelledRef = useRef(false);
  const voiceSecRef = useRef(0);
  const keysRef = useRef(roomKeys);
  const messagesRef = useRef<ChatMsg[]>([]);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [, requestCam] = useCameraPermissions();
  const [, requestMic] = useMicrophonePermissions();

  // Перерасшифровываем, когда ключи готовы/сменились
  useEffect(() => {
    keysRef.current = roomKeys;
    if (!roomKeys.length) return;
    setMessages((prev) => prev.map((m) => (m.ciphertext ? decryptMsg({ ...m, text: m._decryptFailed ? null : m.text }, roomKeys) : m)));
  }, [roomKeys]);

  useEffect(() => { setPartnerLastSeen(partner?.last_seen ?? null); }, [partner?.last_seen]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // Только своя пара (uid + partner_id)
  const applyPairFilter = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (q: any) => (pid ? q.or(`user_id.eq.${uid},user_id.eq.${pid}`) : q.eq('user_id', uid)),
    [uid, pid],
  );

  const scrollToBottom = useCallback(() => listRef.current?.scrollToOffset({ offset: 0, animated: true }), []);

  const markMessagesRead = useCallback(async (msgs: ChatMsg[]) => {
    if (!pid) return;
    const unread = msgs.filter((m) => m.user_id === pid && !m.read_at);
    if (!unread.length) return;
    await supabase.from('messages').update({ read_at: new Date().toISOString() }).in('id', unread.map((m) => m.id));
  }, [pid]);

  useEffect(() => {
    let on = true;
    const updateLastSeen = () => supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', uid).then(() => {});
    (async () => {
      const { data } = await applyPairFilter(supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(50));
      if (!on) return;
      const raw = ((data ?? []) as ChatMsg[]).reverse();
      const list = raw.map((m) => decryptMsg(m, keysRef.current));
      setMessages(list);
      setAllLoaded(raw.length < 50);
      setLoading(false);
      markMessagesRead(list);
    })();
    updateLastSeen();
    const lastSeenTimer = setInterval(() => { if (AppState.currentState === 'active') updateLastSeen(); }, 30000);
    const appSub = AppState.addEventListener('change', (s) => { if (s === 'active') updateLastSeen(); });

    const channel = supabase.channel('chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p) => {
        const n = p.new as ChatMsg;
        if (n.user_id !== uid && n.user_id !== pid) return;
        const m = decryptMsg(n, keysRef.current);
        setMessages((prev) => (prev.find((x) => x.id === m.id) ? prev : [...prev, m]));
        if (n.user_id !== uid) supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('id', n.id).then(() => {});
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (p) => {
        setMessages((prev) => prev.filter((x) => x.id !== (p.old as { id: string }).id));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (p) => {
        const n = p.new as ChatMsg;
        if (n.user_id !== uid && n.user_id !== pid) return;
        const m = decryptMsg(n, keysRef.current);
        setMessages((prev) => prev.map((x) => (x.id === m.id ? m : x)));
      })
      .subscribe();

    return () => {
      on = false;
      supabase.removeChannel(channel);
      clearInterval(lastSeenTimer);
      appSub.remove();
    };
  }, [uid, pid, applyPairFilter, markMessagesRead]);

  useEffect(() => {
    if (!pid) return;
    const typingChannel = supabase.channel(`typing-${pid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'typing_status', filter: `user_id=eq.${pid}` },
        (p) => setPartnerTyping(!!(p.new as { is_typing?: boolean })?.is_typing))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${pid}` },
        (p) => setPartnerLastSeen((p.new as { last_seen: string }).last_seen))
      .subscribe();
    const bc = supabase.channel('user-activity')
      .on('broadcast', { event: 'typing' }, ({ payload }) => { if (payload?.userId === pid) setPartnerTyping(!!payload.value); })
      .on('broadcast', { event: 'recording' }, ({ payload }) => { if (payload?.userId === pid) setPartnerRecording(payload.kind || null); })
      .subscribe();
    broadcastRef.current = bc;
    return () => { supabase.removeChannel(typingChannel); supabase.removeChannel(bc); broadcastRef.current = null; };
  }, [pid]);

  async function loadMore() {
    if (loadingMore || allLoaded || !messages.length) return;
    setLoadingMore(true);
    const oldest = messages[0].created_at;
    const { data } = await applyPairFilter(supabase.from('messages').select('*').lt('created_at', oldest).order('created_at', { ascending: false }).limit(50));
    if (!data || data.length < 50) setAllLoaded(true);
    if (data?.length) {
      const older = (data as ChatMsg[]).reverse().map((m) => decryptMsg(m, keysRef.current));
      setMessages((prev) => [...older.filter((o) => !prev.some((p) => p.id === o.id)), ...prev]);
    }
    setLoadingMore(false);
  }

  const sendBroadcast = (event: string, payload: Record<string, unknown>) => broadcastRef.current?.send({ type: 'broadcast', event, payload });

  async function handleSend() {
    if (!newText.trim() && !photo) return;
    if (typingTimer.current) clearTimeout(typingTimer.current);
    supabase.from('typing_status').upsert({ user_id: uid, is_typing: false, updated_at: new Date().toISOString() }).then(() => {});
    setSending(true);
    try {
      let photoUrl: string | null = null;
      if (photo) photoUrl = await uploadToStorage(photo, `chat/${webFileName('jpg')}`, 'image/jpeg');
      if (editingId) {
        await supabase.from('messages').update({ text: newText.trim(), edited_at: new Date().toISOString() }).eq('id', editingId);
        setEditingId(null);
      } else {
        const plainText = newText.trim() || null;
        let msgData: Record<string, unknown> = { user_id: uid, photo_url: photoUrl };
        if (replyTo) msgData.reply_to_id = replyTo.id;
        if (roomKey && plainText) msgData = { ...msgData, ciphertext: encryptMessage(plainText, roomKey), is_encrypted: true, text: null };
        else msgData.text = plainText;
        const { data: inserted, error } = await supabase.from('messages').insert(msgData).select().single();
        if (error) throw error;
        if (inserted) {
          const localMsg = roomKey && plainText ? { ...(inserted as ChatMsg), text: plainText } : (inserted as ChatMsg);
          setMessages((prev) => (prev.find((m) => m.id === localMsg.id) ? prev : [...prev, localMsg]));
        }
        setReplyTo(null);
        scrollToBottom();
        if (pid) {
          // В push никогда не уходит текст — только общая фраза (E2EE)
          const pushBody = photoUrl && !plainText ? '📷 Фото' : '💬 Новое сообщение';
          sendPushNotification(`💬 ${profile.name || 'Сообщение'}`, pushBody, pid).catch(() => {});
        }
      }
      setNewText('');
      setPhoto(null);
    } catch (e) { console.error(e); }
    setSending(false);
  }

  async function attachPhoto() {
    const asset = await chooseImage();
    if (!asset) return;
    setPhoto(await compressImage(asset.uri, asset.width, asset.height, 1280, 0.85));
  }

  /* ── видео-кружок ── */
  async function startRecord() {
    const cam = await requestCam();
    const mic = await requestMic();
    if (!cam.granted || !mic.granted) { Alert.alert('Нет доступа к камере'); return; }
    cancelledRef.current = false;
    setRecording(true);
    sendBroadcast('recording', { userId: uid, kind: 'video' });
    setRecordSeconds(0);
    if (recTimer.current) clearInterval(recTimer.current);
    recTimer.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
  }

  async function onCameraReady() {
    try {
      const res = await cameraRef.current?.recordAsync({ maxDuration: 60, ...(Platform.OS === 'ios' ? { codec: 'avc1' as const } : {}) });
      if (recTimer.current) clearInterval(recTimer.current);
      if (cancelledRef.current || !res?.uri) { cancelledRef.current = false; setRecording(false); setRecordSeconds(0); return; }
      setRecording(false);
      setSending(true);
      try {
        const url = await uploadToStorage(res.uri, `circles/circle-${Date.now()}.mp4`, 'video/mp4');
        const { error } = await supabase.from('messages').insert({ user_id: uid, video_url: url, is_video_circle: true });
        if (error) throw error;
        const { data: latest } = await supabase.from('messages').select('*').eq('user_id', uid).eq('video_url', url).limit(1);
        if (latest?.[0]) setMessages((prev) => (prev.find((m) => m.id === latest[0].id) ? prev : [...prev, latest[0] as ChatMsg]));
        scrollToBottom();
        if (pid) sendPushNotification(`💬 ${profile.name || 'Сообщение'}`, '📹 Видео-сообщение', pid).catch(() => {});
      } catch (e) { console.error(e); }
      sendBroadcast('recording', { userId: uid, kind: null });
      setSending(false);
      setRecordSeconds(0);
    } catch (e) {
      console.error(e);
      setRecording(false);
    }
  }

  function stopRecord() {
    cameraRef.current?.stopRecording();
    if (recTimer.current) clearInterval(recTimer.current);
  }

  function cancelRecord() {
    cancelledRef.current = true;
    if (recTimer.current) clearInterval(recTimer.current);
    cameraRef.current?.stopRecording();
    setRecording(false);
    setRecordSeconds(0);
    sendBroadcast('recording', { userId: uid, kind: null });
  }

  /* ── голосовые ── */
  async function startVoice() {
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) { Alert.alert('Нет доступа к микрофону'); return; }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      voiceCancelledRef.current = false;
      sendBroadcast('recording', { userId: uid, kind: 'voice' });
      setVoiceRec(true);
      setRecordSeconds(0);
      voiceSecRef.current = 0;
      if (recTimer.current) clearInterval(recTimer.current);
      recTimer.current = setInterval(() => { voiceSecRef.current++; setRecordSeconds((s) => s + 1); }, 1000);
    } catch (e) { console.error(e); Alert.alert('Нет доступа к микрофону: ' + (e as Error).message); }
  }

  async function finishVoice(cancel: boolean) {
    if (recTimer.current) clearInterval(recTimer.current);
    const sec = voiceSecRef.current;
    voiceSecRef.current = 0;
    try { await recorder.stop(); } catch (e) { console.error('stopVoice error:', e); }
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    const uri = recorder.uri;
    if (cancel || !uri) { setVoiceRec(false); setRecordSeconds(0); sendBroadcast('recording', { userId: uid, kind: null }); return; }
    setSending(true);
    try {
      const url = await uploadToStorage(uri, `voices/voice-${Date.now()}.m4a`, 'audio/mp4');
      const { error } = await supabase.from('messages').insert({ user_id: uid, audio_url: url, is_voice: true, duration: sec });
      if (error) throw error;
      const { data: latest } = await supabase.from('messages').select('*').eq('user_id', uid).eq('audio_url', url).limit(1);
      if (latest?.[0]) setMessages((prev) => (prev.find((m) => m.id === latest[0].id) ? prev : [...prev, latest[0] as ChatMsg]));
      scrollToBottom();
      if (pid) sendPushNotification(`💬 ${profile.name || 'Сообщение'}`, '🎤 Голосовое сообщение', pid).catch(() => {});
    } catch (e) { console.error('voice send error:', e); Alert.alert('Ошибка отправки: ' + (e as Error).message); }
    sendBroadcast('recording', { userId: uid, kind: null });
    setSending(false);
    setVoiceRec(false);
    setRecordSeconds(0);
  }

  async function deleteMsg(id: string) { await supabase.from('messages').delete().eq('id', id); }

  async function pinMsg(id: string) {
    const msg = messages.find((m) => m.id === id);
    if (!msg) return;
    await supabase.from('messages').update({ is_pinned: !msg.is_pinned }).eq('id', id);
  }

  const addReact = useCallback(async (msgId: string, emoji: string) => {
    if (!VALID_REACTIONS.has(emoji)) return;
    const msg = messagesRef.current.find((m) => m.id === msgId);
    if (!msg) return;
    const reactions = { ...(msg.reactions || {}) };
    if (reactions[emoji]?.includes(uid)) {
      reactions[emoji] = reactions[emoji].filter((id) => id !== uid);
      if (!reactions[emoji].length) delete reactions[emoji];
    } else {
      reactions[emoji] = [...(reactions[emoji] || []), uid];
    }
    await supabase.from('messages').update({ reactions }).eq('id', msgId);
  }, [uid]);

  const onLongPress = useCallback((msg: ChatMsg) => {
    setCtxMenu({ msgId: msg.id, text: msg.text || '', isMe: msg.user_id === uid, isPinned: !!msg.is_pinned });
  }, [uid]);

  const onReply = useCallback((msgId: string) => {
    const m = messagesRef.current.find((x) => x.id === msgId);
    if (m) setReplyTo({ id: m.id, text: m.text, user_id: m.user_id, photo_url: m.photo_url });
  }, []);

  function handleTextChange(t: string) {
    setNewText(t);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    sendBroadcast('typing', { userId: uid, value: true });
    typingTimer.current = setTimeout(() => sendBroadcast('typing', { userId: uid, value: false }), 3000);
  }

  const pinnedMsg = messages.find((m) => m.is_pinned);
  const partnerName = partner?.name || (pid ? 'Партнёр' : 'Партнёр не подключён');
  const partnerAvatar = partner?.avatar_url;

  // Строки списка (список перевёрнут: новые снизу)
  const rows = useMemo(() => messages.map((msg, i) => {
    const prev = messages[i - 1], next = messages[i + 1];
    return {
      msg,
      isMine: msg.user_id === uid,
      showDate: i === 0 || diffDate(prev?.created_at, msg.created_at),
      isLast: !isSameGroup(msg, next),
      showAv: needAvatar(msg, next, uid),
      replyData: msg.reply_to_id ? messages.find((m) => m.id === msg.reply_to_id) || null : null,
    };
  }).reverse(), [messages, uid]);

  function jumpTo(id: string) {
    const index = rows.findIndex((r) => r.msg.id === id);
    if (index >= 0) listRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true });
  }

  if (loading) return <LoadingHeart />;

  if (!pid) {
    return (
      <View style={[st.center, { backgroundColor: CH.BG, paddingVertical: 40, paddingHorizontal: 32, gap: 16 }]}>
        <Text style={{ fontSize: 56 }}>💬</Text>
        <Text style={st.emptyTitle}>Партнёр не подключён</Text>
        <Text style={st.emptyText}>Пригласите партнёра через настройки, чтобы начать общение</Text>
      </View>
    );
  }

  const status = partnerRecording === 'voice' ? 'записывает голосовое...'
    : partnerRecording === 'video' ? 'записывает кружочек...'
      : partnerTyping ? 'печатает...' : fmtLastSeen(partnerLastSeen);
  const statusGreen = !!(partnerTyping || partnerRecording) || isOnline(partnerLastSeen);
  const recTime = `${Math.floor(recordSeconds / 60)}:${String(recordSeconds % 60).padStart(2, '0')}`;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: CH.BG }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ flex: 1, paddingBottom: keyboard ? 0 : 92 + insets.bottom }}>
        {/* Шапка */}
        <View style={[st.header, { paddingTop: Math.max(10, insets.top) }]}>
          <Avatar url={partnerAvatar} size={44} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={st.partnerName}>{partnerName}</Text>
            <Text style={[st.status, { color: statusGreen ? '#4CAF50' : CH.MUTED }]} accessibilityLiveRegion="polite">{status}</Text>
          </View>
          <Pressable onPress={() => setShowSearch(true)} style={st.headerBtn} accessibilityLabel="Поиск по сообщениям"><IcSearch /></Pressable>
          <View style={{ padding: 6 }}><IcVideo c={CH.MUTED} /></View>
        </View>

        {pinnedMsg ? (
          <View style={st.pinned}>
            <View style={st.pinnedBar} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={st.pinnedHead}><IcPin c={CH.ROSE} /><Text style={st.pinnedLabel}>Закреплено</Text></View>
              <Text numberOfLines={1} style={st.pinnedText}>{pinnedMsg.text || 'Фото'}</Text>
            </View>
            <Pressable onPress={() => pinMsg(pinnedMsg.id)} accessibilityLabel="Открепить" hitSlop={8}><Text style={{ fontSize: 16, color: CH.INK }}>✕</Text></Pressable>
          </View>
        ) : null}

        <FlatList
          ref={listRef}
          inverted
          data={rows}
          keyExtractor={(r) => r.msg.id}
          contentContainerStyle={{ paddingVertical: 12, paddingHorizontal: 10, gap: 2, flexGrow: 1 }}
          onScroll={(e) => setShowDown(e.nativeEvent.contentOffset.y > 300)}
          scrollEventThrottle={64}
          onEndReached={loadMore}
          onEndReachedThreshold={0.2}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          onScrollToIndexFailed={(info) => listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true })}
          ListEmptyComponent={
            <View style={[st.center, { transform: [{ scaleY: -1 }], gap: 12, opacity: 0.5 }]}>
              <Svg viewBox="0 0 60 56" width={52} height={48} fill="none"><Path d="M30 52C30 52 3 35 3 16C3 8 9.5 2 18 2C22.5 2 26.5 4.5 30 9C33.5 4.5 37.5 2 42 2C50.5 2 57 8 57 16C57 35 30 52 30 52Z" fill="rgba(200,51,74,0.35)" /></Svg>
              <Text style={{ fontSize: 14, color: CH.MUTED, fontFamily: fonts.body }}>Напишите первое сообщение</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View>
              {item.showDate ? (
                <View style={st.dateWrap}><Text style={st.date}>{fmtDateSep(item.msg.created_at)}</Text></View>
              ) : null}
              <View style={[st.row, { justifyContent: item.isMine ? 'flex-end' : 'flex-start' }]}>
                {!item.isMine && item.showAv ? <View style={{ marginRight: 8, marginTop: 4 }}><Avatar url={partnerAvatar} size={32} /></View> : null}
                {!item.isMine && !item.showAv ? <View style={{ width: 40 }} /> : null}
                <Message msg={item.msg} isMine={item.isMine} uid={uid} partnerName={partnerName} isLast={item.isLast} replyData={item.replyData}
                  onLongPress={onLongPress} onReact={addReact} onReply={onReply} onPhotoOpen={setLightboxUrl} />
              </View>
            </View>
          )}
        />

        {showDown ? (
          <Pressable onPress={scrollToBottom} style={[st.downBtn, { bottom: 80 }]} accessibilityLabel="Вниз"><IcDown c={CH.ROSE} /></Pressable>
        ) : null}

        {replyTo ? (
          <View style={st.bar}>
            <View style={st.barLine} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={st.barWho}>{replyTo.user_id === uid ? 'Вы' : (partner?.name || 'Партнёр')}</Text>
              <Text numberOfLines={1} style={st.barText}>{replyTo.photo_url && !replyTo.text ? 'Фото' : (replyTo.text || '')}</Text>
            </View>
            {replyTo.photo_url ? <Image source={{ uri: replyTo.photo_url }} style={st.barThumb} contentFit="cover" /> : null}
            <Pressable onPress={() => setReplyTo(null)} accessibilityLabel="Отменить ответ" hitSlop={8}><Text style={st.barClose}>×</Text></Pressable>
          </View>
        ) : null}

        {editingId ? (
          <View style={[st.bar, { backgroundColor: 'rgba(200,51,74,0.1)', borderTopColor: 'rgba(200,51,74,0.15)', paddingVertical: 8 }]}>
            <IcEdit c={CH.ROSE} />
            <Text style={st.editLabel}>Редактирование сообщения</Text>
            <Pressable onPress={() => { setEditingId(null); setNewText(''); }} accessibilityLabel="Отменить редактирование" hitSlop={8}><Text style={[st.barClose, { fontSize: 18 }]}>×</Text></Pressable>
          </View>
        ) : null}

        {photo ? (
          <View style={[st.bar, { paddingVertical: 8 }]}>
            <Image source={{ uri: photo }} style={{ width: 50, height: 50, borderRadius: 10 }} contentFit="cover" />
            <Text style={[st.barText, { flex: 1, fontSize: 13 }]}>Фото прикреплено</Text>
            <Pressable onPress={() => setPhoto(null)} accessibilityLabel="Убрать фото" hitSlop={8}><Text style={{ color: CH.INK }}>✕</Text></Pressable>
          </View>
        ) : null}

        {recording ? (
          <View style={st.recBar}>
            <View style={st.recPreview}>
              <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" mode="video" mirror onCameraReady={onCameraReady} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Pulse><View style={st.recDot} /></Pulse>
                <Text style={st.recTime}>{recTime}</Text>
              </View>
              <Text style={st.recHint}>Запись кружочка...</Text>
            </View>
            <Pressable onPress={cancelRecord} style={{ padding: 8 }} accessibilityLabel="Отменить запись"><IcX /></Pressable>
            <Pressable onPress={stopRecord} accessibilityLabel="Отправить кружок">
              <LinearGradient {...GRAD} style={st.recSend}><IcSend /></LinearGradient>
            </Pressable>
          </View>
        ) : null}

        {voiceRec ? (
          <View style={[st.recBar, { paddingVertical: 10 }]}>
            <Pulse dur={1200}><LinearGradient {...GRAD} style={st.voiceIcon}><IcMic c="white" s={18} /></LinearGradient></Pulse>
            <View style={{ flex: 1 }}>
              <Text style={st.voiceLabel}>Запись голосового...</Text>
              <Text style={[st.recHint, { fontFamily: 'monospace' }]}>{recTime}</Text>
            </View>
            <Pressable onPress={() => finishVoice(true)} style={{ padding: 8 }} accessibilityLabel="Отменить голосовое"><IcX /></Pressable>
            <Pressable onPress={() => finishVoice(false)} accessibilityLabel="Отправить голосовое">
              <LinearGradient {...GRAD} style={st.recSend}><IcSend /></LinearGradient>
            </Pressable>
          </View>
        ) : null}

        {/* Панель ввода */}
        <View style={[st.composer, { paddingBottom: 8 }]}>
          <Pressable onPress={attachPhoto} style={st.iconBtn} accessibilityLabel="Прикрепить фото"><IcCamera c="#C8334A" /></Pressable>
          <Pressable onPress={recording ? stopRecord : startRecord} accessibilityLabel={recording ? 'Остановить кружок' : 'Записать кружок'}>
            {recording
              ? <LinearGradient {...GRAD} style={st.iconBtnBase}><IcVideo c="white" /></LinearGradient>
              : <View style={st.iconBtn}><IcVideo c="#C8334A" /></View>}
          </Pressable>
          <View style={st.inputWrap}>
            <TextInput
              value={newText}
              onChangeText={handleTextChange}
              placeholder={replyTo ? 'Напишите ответ...' : 'Сообщение...'}
              placeholderTextColor={CH.MUTED}
              style={st.input}
              multiline
              selectionColor="#C8334A"
              submitBehavior="submit"
              returnKeyType="send"
              onSubmitEditing={handleSend}
              accessibilityLabel="Сообщение"
            />
          </View>
          {!newText.trim() && !photo && !recording && !voiceRec ? (
            <Pressable onPress={startVoice} style={st.iconBtn} accessibilityLabel="Записать голосовое"><IcMic c="#C8334A" /></Pressable>
          ) : null}
          {newText.trim() || photo ? (
            <Pressable onPress={handleSend} disabled={sending} accessibilityLabel="Отправить" style={{ opacity: sending ? 0.6 : 1 }}>
              <LinearGradient {...GRAD} style={st.iconBtnBase}><IcSend s={15} /></LinearGradient>
            </Pressable>
          ) : null}
        </View>

        {showSearch ? <SearchOverlay messages={messages} onClose={() => setShowSearch(false)} onJump={jumpTo} /> : null}
      </View>

      {lightboxUrl ? <PhotoLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} /> : null}
      <ContextMenu
        menu={ctxMenu}
        onClose={() => setCtxMenu(null)}
        onEdit={(id, text) => { setEditingId(id); setNewText(text); setReplyTo(null); }}
        onDelete={deleteMsg}
        onPin={pinMsg}
        onReact={addReact}
        onReply={(id) => { onReply(id); setCtxMenu(null); }}
      />
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: fonts.displaySemi, fontSize: 22, color: CH.INK, textAlign: 'center' },
  emptyText: { fontSize: 14, color: CH.MUTED, lineHeight: 21, textAlign: 'center', fontFamily: fonts.body },

  header: { backgroundColor: CH.SURF, borderBottomWidth: 0.5, borderBottomColor: CH.BDR, paddingBottom: 10, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, zIndex: 20 },
  partnerName: { fontFamily: fonts.displaySemi, fontSize: 17, color: CH.INK },
  status: { fontSize: 11, fontFamily: fonts.body },
  headerBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(200,51,74,0.09)', alignItems: 'center', justifyContent: 'center' },

  pinned: { backgroundColor: 'rgba(200,51,74,0.1)', borderBottomWidth: 0.5, borderBottomColor: 'rgba(200,51,74,0.12)', paddingVertical: 8, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  pinnedBar: { width: 3, height: 36, backgroundColor: CH.ROSE, borderRadius: 3 },
  pinnedHead: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  pinnedLabel: { fontSize: 11, color: CH.ROSE, fontFamily: fonts.bodySemi },
  pinnedText: { fontSize: 13, color: CH.INK, fontFamily: fonts.body },

  dateWrap: { alignItems: 'center', marginTop: 12, marginBottom: 8 },
  date: { backgroundColor: 'rgba(200,51,74,0.15)', paddingVertical: 4, paddingHorizontal: 16, borderRadius: 20, fontSize: 11, color: CH.MUTED, overflow: 'hidden', fontFamily: fonts.body },
  row: { flexDirection: 'row', marginBottom: 2 },
  downBtn: {
    position: 'absolute', right: 14, width: 38, height: 38, borderRadius: 19, backgroundColor: CH.SURF, borderWidth: 0.5, borderColor: CH.BDR,
    alignItems: 'center', justifyContent: 'center', zIndex: 15, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6,
  },

  bar: { paddingVertical: 6, paddingHorizontal: 14, backgroundColor: CH.SURF, borderTopWidth: 0.5, borderTopColor: CH.BDR, flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLine: { width: 3, height: 34, backgroundColor: CH.ROSE, borderRadius: 3 },
  barWho: { fontSize: 11, color: CH.ROSE, fontFamily: fonts.bodySemi },
  barText: { fontSize: 12, color: CH.MUTED, fontFamily: fonts.body },
  barThumb: { width: 34, height: 34, borderRadius: 6 },
  barClose: { color: CH.MUTED, fontSize: 20, paddingHorizontal: 6 },
  editLabel: { flex: 1, fontSize: 12, color: CH.ROSE, fontFamily: fonts.bodyMedium },

  recBar: { backgroundColor: '#1A0810', borderBottomWidth: 0.5, borderBottomColor: 'rgba(200,51,74,0.15)', paddingVertical: 8, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  recPreview: { width: 64, height: 64, borderRadius: 32, overflow: 'hidden', borderWidth: 2, borderColor: CH.ROSE, backgroundColor: '#000' },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: CH.ROSE },
  recTime: { fontSize: 13, color: CH.INK, fontFamily: 'monospace' },
  recHint: { fontSize: 11, color: CH.MUTED, fontFamily: fonts.body },
  recSend: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', shadowColor: 'rgb(200,51,74)', shadowOpacity: 0.4, shadowRadius: 5 },
  voiceIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  voiceLabel: { fontSize: 13, color: CH.ROSE, fontFamily: fonts.bodySemi },

  composer: { backgroundColor: CH.SURF, borderTopWidth: 0.5, borderTopColor: CH.BDR, paddingTop: 8, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'flex-end', gap: 7 },
  iconBtnBase: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(200,51,74,0.09)' },
  inputWrap: { flex: 1, backgroundColor: CH.SURF2, borderRadius: 22, borderWidth: 0.5, borderColor: CH.BDR, paddingHorizontal: 14, justifyContent: 'flex-end' },
  input: { fontSize: 16, fontFamily: fonts.body, color: CH.INK, paddingTop: 10, paddingBottom: 10, maxHeight: 120, lineHeight: 23 },
});
