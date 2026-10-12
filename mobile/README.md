# Love App — приложение для iPhone и Android

Нативное приложение (Expo / React Native), перенесённое из веб-версии один в один:
те же экраны, тексты, цвета и функции, та же база Supabase и то же сквозное шифрование чата.
Веб и телефон работают с одними и теми же данными: можно переписываться с партнёром,
даже если у него веб-версия.

## Что внутри

| Веб (`src/components`) | Приложение (`mobile/src`) |
|---|---|
| `Auth.jsx` | `app/(auth)/index.tsx` |
| `Onboarding.jsx` | `app/onboarding.tsx` |
| `Home.jsx` + `Home.css`, `LoveStory.jsx` | `app/(tabs)/index.tsx`, `components/LoveStory.tsx` |
| `Chat.jsx` | `app/(tabs)/chat.tsx`, `components/chat/parts.tsx` |
| `Moments.jsx` | `app/(tabs)/moments.tsx` |
| `Calendar.jsx` | `app/(tabs)/calendar.tsx` |
| `Plans.jsx` | `app/(tabs)/plans.tsx` |
| `Settings.jsx` | `app/(tabs)/settings.tsx` |
| `Premium.jsx` | `app/(tabs)/premium.tsx` |
| `AIAdvisor.jsx` + 7 разделов | `app/(tabs)/advisor.tsx`, `components/advisor/*` |
| `SyncMirror.jsx` (вкладка «Вопрос дня») | `app/(tabs)/mirror.tsx` |
| `Navigation.jsx` | `components/Dock.tsx` |
| `lib/crypto.js` | `lib/crypto.ts` (совместимо с вебом, проверено тестом) |

## Первый запуск

```bash
cd mobile
npm install
cp .env.example .env      # подставь EXPO_PUBLIC_SUPABASE_URL и EXPO_PUBLIC_SUPABASE_ANON_KEY
npx expo start            # QR-код → открой в Expo Go на телефоне
```

Проверки: `npm run typecheck`, `npm run lint`, `npm test`.

### Один раз настроить в Supabase

1. **Authentication → URL Configuration → Redirect URLs** — добавь `loveapp://**`
   (нужно для входа через Google в приложении).
2. Обнови edge-функции `send-notification`, `relationship-keeper`, `check-contracts`
   (`supabase functions deploy …`) — они теперь умеют слать push и на телефоны (Expo), и в браузер.

## Сборка установочных файлов (EAS)

```bash
npm i -g eas-cli
eas login                 # бесплатный аккаунт expo.dev
eas init                  # привяжет проект; без этого не будет push-уведомлений
eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value https://xxxx.supabase.co --environment preview --environment production --visibility plaintext
eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value eyJ... --environment preview --environment production --visibility plaintext
eas env:create --name EXPO_PUBLIC_WEB_URL --value https://love-app.netlify.app --environment preview --environment production --visibility plaintext
```

Файл `.env` в облачную сборку не попадает, поэтому переменные задаются через `eas env:create`.

- **Android:** `npm run build:android` → ссылка на `.apk`.
- **iPhone:** `npm run build:ios` (нужен Apple Developer, см. ниже).

## Как установить на iPhone без App Store

| Способ | Что нужно | Срок работы | Push |
|---|---|---|---|
| **Ad Hoc через EAS** (рекомендуется) | Apple Developer Program, $99/год | 1 год | ✅ |
| **TestFlight** | Apple Developer Program | 90 дней на сборку | ✅ |
| **Бесплатный Apple ID + Xcode** | Mac с Xcode | 7 дней, потом переустановить | ❌ |
| **AltStore / SideStore** | бесплатный Apple ID | 7 дней, продлевается само | ❌ |
| **Expo Go** | ничего | пока открыт dev-сервер | ❌ |

### 1. Ad Hoc через EAS (лучший вариант)
1. Оформи Apple Developer Program на developer.apple.com.
2. `eas device:create` → отправь ссылку себе и партнёру, откройте её на iPhone — устройства зарегистрируются.
3. `npm run build:ios` — EAS сам создаст сертификаты.
4. Откройте ссылку из EAS на iPhone → «Установить».
5. Настройки → Основные → VPN и управление устройством → доверять (если спросит).
   На iOS 16+ включи **Настройки → Конфиденциальность → Режим разработчика**.

### 2. TestFlight
`eas build -p ios --profile production` → `eas submit -p ios` → в App Store Connect добавь
тестировщиков (до 10 000), им придёт приглашение в приложение TestFlight. Это не публикация в App Store.

### 3. Бесплатно через Xcode (нужен Mac)
`npx expo prebuild -p ios` → открой `ios/LoveApp.xcworkspace` → Signing → выбери свой Apple ID →
подключи iPhone кабелем → ▶. Приложение работает 7 дней, push-уведомления недоступны.

### 4. AltStore / SideStore
Собери `.ipa` (например, `eas build -p ios --profile preview` с аккаунтом разработчика или через Xcode) и
установи через AltStore/SideStore — они переподписывают приложение бесплатным Apple ID каждые 7 дней.

## Android
`npm run build:android` → открой ссылку на телефоне → скачай `.apk` → разреши установку
из этого источника → установи. Push работает без оплаты.

## Отличия от веба (честно)

- Поля даты и времени — системные пикеры iOS/Android вместо браузерного `<input type="date">`.
- Кружки и голосовые, записанные в вебе (`webm`), на iPhone не воспроизводятся — это ограничение iOS.
  Записанные в приложении (`mp4`/`m4a`) играют везде.
- Ошибки веба перенесены как есть, чтобы поведение совпадало (например, редактирование
  зашифрованного сообщения сохраняет текст без шифрования; «Переводчик» отправляет сообщение без шифрования;
  в барометре «мы»-слова не распознаются из-за регулярного выражения).
- Ключи шифрования хранятся на устройстве: если пользоваться и вебом, и телефоном, новые сообщения
  расшифровываются на устройстве, где ключ создан последним (так же устроена веб-версия).
