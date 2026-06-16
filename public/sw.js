self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', () => self.clients.claim())

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : { title: 'Love App', body: 'Новое сообщение' }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      // Уникальный тег, чтобы уведомления разного типа (сообщение/момент/план)
      // не затирали друг друга, а показывались отдельно.
      tag: data.tag || ('love-' + Date.now()),
      renotify: true,
      data: { url: data.url || '/?tab=chat' }
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const urlToOpen = event.notification.data?.url || '/?tab=chat'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Если приложение уже открыто — фокусируем и переключаем на чат
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({ type: 'OPEN_CHAT' })
          return client.focus()
        }
      }
      // Иначе открываем новое окно
      return clients.openWindow(urlToOpen)
    })
  )
})

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request))
})
