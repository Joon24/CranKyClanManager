import { useEffect } from 'react';

export function usePolling(callback: () => void | Promise<void>, intervalMs: number) {
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const tick = () => {
      if (active && document.visibilityState === 'visible') {
        void callback();
      }
    };

    const start = () => {
      if (timer) return;
      timer = setInterval(tick, intervalMs);
    };

    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        tick();
        start();
      } else {
        stop();
      }
    };

    start();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      active = false;
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [callback, intervalMs]);
}
