/**
 * Service worker for Web Push notifications (Module 4.D).
 * Handles push events and notification clicks (opens the related order).
 */

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Tailor Management", body: event.data.text() };
  }
  const title = payload.title || "Tailor Management";
  const options = {
    body: payload.body || payload.message || "",
    icon: payload.icon || "/favicon.ico",
    badge: payload.badge || "/favicon.ico",
    data: payload.data || {},
    tag: payload.tag || payload.notificationId || undefined,
    requireInteraction: payload.priority === "critical",
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/notifications";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
