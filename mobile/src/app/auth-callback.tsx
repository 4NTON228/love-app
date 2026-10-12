// loveapp://auth-callback — возврат после входа через Google (сессию ставит lib/oauth.ts).
// Если система открыла маршрут сама — просто уходим на главную.
import { Redirect } from 'expo-router';

export default function AuthCallback() {
  return <Redirect href="/" />;
}
