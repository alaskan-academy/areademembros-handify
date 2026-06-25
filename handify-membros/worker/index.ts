// Push notification handler — compilado e mesclado com o Workbox SW pelo next-pwa
// Roda no contexto do Service Worker, não do browser

declare const self: ServiceWorkerGlobalScope;

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data: { title: string; body?: string; link?: string } = { title: "Handify" };
  try {
    data = event.data.json() as typeof data;
  } catch {
    data = { title: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body ?? "",
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-192x192.png",
      data: { link: data.link ?? "/" },
      vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link: string =
    (event.notification.data as { link?: string })?.link ?? "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            (client as WindowClient).navigate(link);
            return client.focus();
          }
        }
        return self.clients.openWindow(link);
      })
  );
});
