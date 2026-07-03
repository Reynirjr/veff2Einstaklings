/* eslint-env browser */
'use strict';

// Bjölluhnappurinn í hausnum: kveikja/slökkva á push-tilkynningum.
// Felur sig sjálfkrafa þegar vafrinn styður ekki push eða VAPID er óstillt.

(function () {
  const button = document.getElementById('pushToggle');
  if (!button) return;

  const publicKeyMeta = document.querySelector('meta[name="vapid-public-key"]');
  const csrfMeta = document.querySelector('meta[name="csrf-token"]');
  const publicKey = publicKeyMeta ? publicKeyMeta.content : '';

  const supported =
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

  if (!supported || !publicKey) {
    button.style.display = 'none';
    return;
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = window.atob(base64);
    const output = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
    return output;
  }

  function setState(subscribed) {
    button.textContent = subscribed ? '🔔' : '🔕';
    button.title = subscribed
      ? 'Tilkynningar virkar — smelltu til að slökkva'
      : 'Kveikja á tilkynningum';
    button.dataset.subscribed = subscribed ? '1' : '0';
  }

  async function post(path, body) {
    return fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfMeta ? csrfMeta.content : '',
      },
      body: JSON.stringify(body),
    });
  }

  async function init() {
    const registration = await navigator.serviceWorker.register('/sw.js');
    const existing = await registration.pushManager.getSubscription();
    setState(!!existing);

    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        const current = await registration.pushManager.getSubscription();

        if (current) {
          await post('/push/unsubscribe', { subscription: current.toJSON() });
          await current.unsubscribe();
          setState(false);
        } else {
          const permission = await Notification.requestPermission();
          if (permission !== 'granted') {
            alert('Tilkynningar eru læstar í vafranum — leyfðu þær í stillingum síðunnar.');
            return;
          }
          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
          });
          await post('/push/subscribe', { subscription: subscription.toJSON() });
          setState(true);
        }
      } catch (err) {
        console.error('Push toggle failed:', err);
      } finally {
        button.disabled = false;
      }
    });
  }

  init().catch((err) => {
    console.error('Push init failed:', err);
    button.style.display = 'none';
  });
})();
