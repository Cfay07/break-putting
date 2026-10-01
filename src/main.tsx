import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AppProvider } from './lib/store';
import './styles.css';

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Installed to a home screen the app resumes instead of navigating, so the page request the
    // worker answers from the network never fires again and a phone can sit on an old build for
    // weeks while a browser tab updates on reload. Ask for a new worker every time it comes back
    // to the foreground, and reload once one takes over.
    const hadController = !!navigator.serviceWorker.controller;
    let reloading = false;

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // A first install also fires this, and reloading then would be a pointless flash.
      if (!hadController || reloading) return;
      reloading = true;
      window.location.reload();
    });

    navigator.serviceWorker
      .register('./sw.js')
      .then((reg) => {
        const check = () => {
          if (document.visibilityState === 'visible') void reg.update();
        };
        document.addEventListener('visibilitychange', check);
        window.addEventListener('focus', check);
      })
      .catch(() => {
        // offline support is a bonus, never a blocker
      });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>,
);
