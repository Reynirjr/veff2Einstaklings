/* eslint-env serviceworker */
'use strict';

// Tónaleikarnir service worker: sýnir push-tilkynningar og opnar réttu síðuna.

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (err) {
    data = { body: event.data ? event.data.text() : '' };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Tónaleikarnir', {
      body: data.body || '',
      tag: data.tag || undefined,
      data: { url: data.url || '/' },
      badge: undefined,
      lang: 'is',
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      // Endurnýta opinn flipa ef hann er til, annars opna nýjan.
      for (const win of windows) {
        if ('focus' in win) {
          win.navigate(url);
          return win.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
