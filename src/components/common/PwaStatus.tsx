import { useEffect, useRef, useState } from 'react';
import { Workbox } from 'workbox-window';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

function isIosDevice(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isInstalled(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

export function PwaStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);
  const [installing, setInstalling] = useState(false);
  const ios = isIosDevice();
  const workbox = useRef<Workbox | null>(null);
  const updateRequested = useRef(false);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    const onInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => setInstallPrompt(null);
    if ('serviceWorker' in navigator) {
      const worker = new Workbox('/sw.js');
      workbox.current = worker;
      worker.addEventListener('waiting', () => setUpdateReady(true));
      worker.addEventListener('controlling', () => {
        if (updateRequested.current) window.location.reload();
      });
      void worker.register().then((registration) => {
        if (registration?.waiting) setUpdateReady(true);
      }).catch(() => undefined);
    }
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('beforeinstallprompt', onInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('beforeinstallprompt', onInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      workbox.current = null;
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    setInstalling(true);
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') setInstallPrompt(null);
    } finally {
      setInstalling(false);
    }
  };

  if (online && !installPrompt && (!ios || isInstalled()) && !updateReady) return null;

  return (
    <aside className="flex flex-col gap-2 p-2" aria-live="polite">
      {!online && (
        <div role="status" className="mx-auto w-full max-w-3xl rounded-control border border-warn bg-amber-50 px-4 py-2 text-sm text-ink shadow-overlay">
          You’re offline. Recently viewed incidents and notifications may be available read-only. Network actions won’t be sent until you reconnect.
        </div>
      )}
      {installPrompt && !isInstalled() && (
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 rounded-control border border-action bg-surface px-4 py-2 text-sm shadow-overlay">
          <span>Install EmergencyApp for quicker access to emergency information.</span>
          <button type="button" disabled={installing} onClick={handleInstall} className="rounded-control bg-action px-3 py-1 font-semibold text-white disabled:opacity-60">
            {installing ? 'Opening…' : 'Install'}
          </button>
        </div>
      )}
      {ios && !isInstalled() && (
        <div className="mx-auto w-full max-w-3xl rounded-control border border-rule bg-surface px-4 py-2 text-sm shadow-overlay">
          <button type="button" className="font-semibold text-action underline" onClick={() => setShowIosHelp((visible) => !visible)}>
            Install on iPhone or iPad
          </button>
          {showIosHelp && (
            <p className="mt-1">In Safari, tap Share, then choose “Add to Home Screen”.</p>
          )}
        </div>
      )}
      {updateReady && (
        <div role="status" className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 rounded-control border border-action bg-surface px-4 py-2 text-sm shadow-overlay">
          <span>An app update is ready.</span>
          <button type="button" onClick={() => {
            updateRequested.current = true;
            workbox.current?.messageSkipWaiting();
          }} className="rounded-control bg-action px-3 py-1 font-semibold text-white">
            Update
          </button>
        </div>
      )}
    </aside>
  );
}
