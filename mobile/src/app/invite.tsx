// loveapp://invite?code=… открывает этот маршрут; код сохраняет _layout,
// здесь просто уходим на главную (или ко входу — решат защищённые зоны).
import { Redirect } from 'expo-router';

export default function Invite() {
  return <Redirect href="/" />;
}
