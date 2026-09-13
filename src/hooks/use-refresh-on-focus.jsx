import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

// Recarrega os dados quando a tela volta a ficar visível/ativa: ao navegar de
// volta para a rota, ao focar a aba/app, ou periodicamente (opcional).
//
// `paused`: quando true, o auto-refresh periódico e por foco NÃO dispara. Use
// para não recarregar enquanto o usuário está com um formulário/diálogo aberto
// (evita que a tela "se atualize sozinha" no meio da digitação).
export function useRefreshOnFocus(reload, { intervalMs = 0, paused = false } = {}) {
  const location = useLocation();
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  // Recarrega quando entra na rota (só se não estiver pausado).
  useEffect(() => {
    if (!pausedRef.current) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    const onFocus = () => {
      if (!pausedRef.current) reload();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !pausedRef.current) reload();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);

    let timer = null;
    if (intervalMs > 0) {
      timer = setInterval(() => {
        if (document.visibilityState === 'visible' && !pausedRef.current) reload();
      }, intervalMs);
    }

    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
      if (timer) clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload, intervalMs]);
}
