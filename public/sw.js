self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', () => self.clients.claim())

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : { title: 'Love App', body: 'Новое сообщение 💕' }
  
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      tag: 'love-app-notification',
      renotify: true,
      data: { url: '/' }  // ← ДОБАВЛЕНО: передаём URL для клика
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  
  const urlToOpen = event.notification.data?.url || '/'
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Сначала пробуем найти уже открытое окно
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus()
        }
      }
      // Если нет — открываем новое
      return clients.openWindow(urlToOpen)
    })
  )
})

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request))
})
