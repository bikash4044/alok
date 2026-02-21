// This runs in the background to handle incoming push notifications

self.addEventListener('push', function(event) {
  // 1. Parse the data sent from Python
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: "WeedWeb Alert", body: event.data.text() };
    }
  } else {
    data = { title: "WeedWeb Alert", body: "New notification received." };
  }

  // 2. Define notification options (icon, badge, vibration)
  const options = {
    body: data.body,
    icon: '/vite.svg', // Ensure you have an icon file here (or use a URL)
    badge: '/vite.svg',
    vibrate: [100, 50, 100], // Vibrate pattern for mobile
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    // Actions user can take directly from the notification
    actions: [
      {action: 'explore', title: 'Check Dashboard'},
      {action: 'close', title: 'Close'}
    ]
  };

  // 3. Show the notification
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle what happens when the user clicks the notification
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  if (event.action === 'explore' || !event.action) {
    // Open the app/dashboard window if clicked
    event.waitUntil(
      clients.matchAll({type: 'window'}).then(windowClients => {
        // If app is already open, focus it
        for (var i = 0; i < windowClients.length; i++) {
          var client = windowClients[i];
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        // If not open, open a new window
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
    );
  }
});