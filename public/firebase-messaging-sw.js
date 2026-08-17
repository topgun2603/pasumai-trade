/**
 * The service worker that receives a push when the app is not open.
 *
 * It runs outside the bundle, so none of the app's code or environment reaches
 * it — a service worker is fetched by URL by the browser, not imported. That is
 * why the Firebase config is read from the query string the client registers it
 * with rather than from `process.env`: there is no build step here to inline
 * anything into.
 *
 * It is deliberately almost empty. Firebase shows the notification itself from
 * the `notification` block the server sends, and the only thing worth adding is
 * making a tap land on the right screen instead of the home page.
 */

importScripts("https://www.gstatic.com/firebasejs/12.0.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.0.0/firebase-messaging-compat.js");

const params = new URL(self.location.href).searchParams;

const config = {
  apiKey: params.get("apiKey"),
  authDomain: params.get("authDomain"),
  projectId: params.get("projectId"),
  messagingSenderId: params.get("messagingSenderId"),
  appId: params.get("appId"),
};

// Without a project this worker has nothing to listen to. Registering it
// anyway would install a permanently broken worker that the browser then keeps
// alive across deploys.
if (config.projectId && config.apiKey) {
  firebase.initializeApp(config);
  firebase.messaging();
}

/**
 * A tap opens the bargain, not the front page.
 *
 * Focuses a tab that is already on the platform rather than opening a second
 * one — somebody with the console open and a phone buzzing wants the tab they
 * already have.
 */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const href =
    (event.notification.data && event.notification.data.href) ||
    (event.notification.data &&
      event.notification.data.FCM_MSG &&
      event.notification.data.FCM_MSG.data &&
      event.notification.data.FCM_MSG.data.href) ||
    "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if (new URL(client.url).origin === self.location.origin) {
            return client.focus().then(() => client.navigate(href));
          }
        }
        return self.clients.openWindow(href);
      }),
  );
});
