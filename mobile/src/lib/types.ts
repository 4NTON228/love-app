export type Profile = {
  id: string;
  name: string | null;
  avatar_url: string | null;
  partner_id: string | null;
  couple_start_date: string | null;
  birthday: string | null;
  last_seen: string | null;
  invite_code: string | null;
  onboarding_done: boolean | null;
  public_key: string | null;
  mood: string | null;
  mood_at: string | null;
};

export type Message = {
  id: string;
  user_id: string;
  text: string | null;
  photo_url: string | null;
  thumb_url: string | null;
  video_url: string | null;
  audio_url: string | null;
  is_voice: boolean | null;
  reply_to_id: string | null;
  created_at: string;
  edited_at: string | null;
  read_at: string | null;
  reactions: Record<string, string[]> | null;
  is_encrypted: boolean;
  ciphertext: string | null;
  photo_enc_meta: unknown | null;
  /** клиентское поле: расшифровать не удалось */
  undecryptable?: boolean;
};

export type Moment = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  photo_url: string | null;
  thumb_url: string | null;
  mood: string | null;
  liked: boolean;
  created_at: string;
  is_encrypted: boolean;
};

export type CalendarEvent = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  event_date: string;
  emoji: string | null;
  photo_url: string | null;
  created_at: string;
};

export type Plan = {
  id: string;
  user_id: string;
  title: string;
  completed: boolean | null;
  category: string | null;
  created_at: string;
  completed_at: string | null;
};
