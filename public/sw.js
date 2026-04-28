// Service worker for Web Push notifications.
//
// Lives at /sw.js so its scope covers the whole origin. It runs independently
// of any open tab — once installed, the browser wakes it on every push event
// even if the site is closed.

self.addEventListener("install", (event) => {
  // Activate immediately on first install — no need to wait for old SW since
  // there isn't one yet.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  // Take control of any open tabs that loaded before the SW registered.
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data = {};
  try {
    data = event.data.json();
  } catch {
    data = { title: "Crazy Hikers", body: event.data.text() };
  }

  const title = data.title || "Crazy Hikers";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icon.png",
    badge: data.badge || "/icon.png",
    data: { url: data.url || "/" },
    tag: data.tag, // dedupes notifications with the same tag
    renotify: !!data.tag,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // If a tab is already open at this origin, focus it and navigate.
      for (const client of allClients) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(targetUrl);
            } catch {
              // navigate() can throw cross-origin; fall through to openWindow
            }
          }
          return;
        }
      }

      // No tab open — open a fresh one.
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })()
  );
});
