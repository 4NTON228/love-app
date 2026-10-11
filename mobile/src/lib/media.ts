// Медиа как в вебе: выбор фото, сжатие, загрузка в бакет photos.
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { ActionSheetIOS, Alert, Platform } from 'react-native';

import { supabase } from './supabase';

export async function pickImage(source: 'library' | 'camera'): Promise<ImagePicker.ImagePickerAsset | null> {
  const perm = source === 'camera'
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  return res.canceled ? null : res.assets[0] ?? null;
}

/** <input type="file" accept="image/*">: на iOS браузер сам предлагает «Камера / Медиатека» — здесь так же. */
export function chooseImage(): Promise<ImagePicker.ImagePickerAsset | null> {
  return new Promise((resolve) => {
    const pick = (i: number) => {
      if (i === 0) pickImage('library').then(resolve);
      else if (i === 1) pickImage('camera').then(resolve);
      else resolve(null);
    };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions({ options: ['Медиатека', 'Снять фото', 'Отмена'], cancelButtonIndex: 2 }, pick);
    } else {
      Alert.alert('Фото', undefined, [
        { text: 'Галерея', onPress: () => pick(0) },
        { text: 'Камера', onPress: () => pick(1) },
        { text: 'Отмена', style: 'cancel', onPress: () => pick(2) },
      ], { cancelable: true, onDismiss: () => resolve(null) });
    }
  });
}

/** Уменьшить так, чтобы большая сторона ≤ maxSize, и сохранить JPEG. */
export async function compressImage(uri: string, w: number, h: number, maxSize: number, quality: number): Promise<string> {
  const ctx = ImageManipulator.manipulate(uri);
  if (w > maxSize || h > maxSize) {
    if (w >= h) ctx.resize({ width: maxSize });
    else ctx.resize({ height: maxSize });
  }
  const img = await ctx.renderAsync();
  const out = await img.saveAsync({ compress: quality, format: SaveFormat.JPEG });
  return out.uri;
}

/** Загрузка файла в photos/<path>; возвращает публичный URL (как getPublicUrl в вебе). */
export async function uploadToStorage(uri: string, path: string, contentType: string): Promise<string> {
  const bytes = await new File(uri).arrayBuffer();
  const { error } = await supabase.storage.from('photos').upload(path, bytes, { contentType });
  if (error) throw error;
  return supabase.storage.from('photos').getPublicUrl(path).data.publicUrl;
}

/** Имя файла как в Chat.jsx upload(): `${Date.now()}-${random}.${ext}` */
export function webFileName(ext: string) {
  return `${Date.now()}-${Math.random().toString(36).slice(6)}.${ext}`;
}

/* ── Порт src/lib/mediaUtils.js (без E2EE-ветки — в вебе она не используется) ── */
const MAX_FULL_W = 1600, FULL_QUALITY = 0.85, THUMB_W = 320, THUMB_QUALITY = 0.75, THUMB_SUFFIX = '_thumb';
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_MB = 10;

type Asset = { uri: string; width: number; height: number; mimeType?: string | null; fileSize?: number | null; fileName?: string | null };

export function validateImageFile(file: Asset | null): string | null {
  if (!file) return 'Файл не выбран';
  const type = file.mimeType ?? 'image/jpeg';
  // HEIC с iPhone пикер отдаёт как JPEG после конвертации — проверяем то, что пришло
  if (!ALLOWED_TYPES.includes(type) && !/heic|heif/i.test(type)) return 'Формат: JPEG, PNG, WebP, GIF';
  if (file.fileSize && file.fileSize > MAX_FILE_MB * 1024 * 1024) return `Макс. размер: ${MAX_FILE_MB} МБ`;
  return null;
}

/** Полное фото (1600px, 0.85) + превью (320px, 0.75): `${base}.jpg` и `${base}_thumb.jpg` */
export async function processAndUpload(file: Asset, basePath: string) {
  const err = validateImageFile(file);
  if (err) throw new Error(err);
  const isGif = file.mimeType === 'image/gif';
  const ext = isGif ? 'gif' : 'jpg';
  const fullPath = `${basePath}.${ext}`;
  const thumbPath = `${basePath}${THUMB_SUFFIX}.${ext}`;
  const [full, thumb] = isGif ? [file.uri, file.uri] : await Promise.all([
    compressImage(file.uri, file.width, file.height, MAX_FULL_W, FULL_QUALITY),
    compressImage(file.uri, file.width, file.height, THUMB_W, THUMB_QUALITY),
  ]);
  const type = isGif ? 'image/gif' : 'image/jpeg';
  const upload = async (uri: string, path: string) => {
    const bytes = await new File(uri).arrayBuffer();
    const { error } = await supabase.storage.from('photos').upload(path, bytes, { upsert: true, contentType: type });
    if (error) throw new Error(`Upload failed: ${error.message}`);
  };
  await Promise.all([upload(full, fullPath), upload(thumb, thumbPath)]);
  return {
    fullPath, thumbPath,
    publicUrl: supabase.storage.from('photos').getPublicUrl(fullPath).data.publicUrl,
    thumbPublicUrl: supabase.storage.from('photos').getPublicUrl(thumbPath).data.publicUrl,
  };
}
