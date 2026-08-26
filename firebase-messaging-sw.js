importScripts("https://www.gstatic.com/firebasejs/12.2.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.2.1/firebase-messaging-compat.js");

const firebaseConfig = {
  apiKey: "AIzaSyBIj-fGXP1Bw2IYualVVteyr2wTs6irx_E",
  authDomain: "kuhlfamily-80202.firebaseapp.com",
  projectId: "kuhlfamily-80202",
  storageBucket: "kuhlfamily-80202.firebasestorage.app",
  messagingSenderId: "879026139300",
  appId: "1:879026139300:web:f5ddbf3e309856b4283631",
  measurementId: "G-9D9Q80WGB5"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();
messaging.onBackgroundMessage(payload => {
  self.registration.showNotification(payload?.notification?.title || "KuhlFamily", {
    body: payload?.notification?.body || "Es gibt etwas Neues."
  });
});
