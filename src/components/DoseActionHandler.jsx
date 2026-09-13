import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { http } from '@/api/httpClient';
import { toast } from '@/components/ui/use-toast';

// Processa a ação "Tomei" (ou "Pulei") vinda da notificação push:
//  - via postMessage do service worker (app já aberto);
//  - via parâmetros de URL ?markDose=<id>&status=taken (app aberto do zero).
// O app tem o token de autenticação, então a marcação é feita aqui com segurança.
export default function DoseActionHandler() {
  const navigate = useNavigate();
  const location = useLocation();
  const handled = useRef(new Set());

  async function markDose(doseId, status) {
    if (!doseId || handled.current.has(doseId + status)) return;
    handled.current.add(doseId + status);
    try {
      const endpoint = status === 'skipped' ? 'skip' : 'take';
      await http.post(`/doses/${doseId}/${endpoint}`, {});
      toast({ title: status === 'skipped' ? 'Dose registrada como pulada' : 'Dose registrada como tomada' });
    } catch {
      toast({ title: 'Não foi possível registrar a dose', variant: 'destructive' });
    }
  }

  // Mensagens do service worker (app aberto).
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMessage = (event) => {
      const d = event.data || {};
      if (d.type === 'mark-dose') {
        markDose(d.doseId, d.status || 'taken').then(() => {
          // Leva o usuário para o painel para ver a dose já marcada.
          navigate('/dashboard');
        });
      } else if (d.type === 'notification-click' && d.url) {
        navigate(d.url.replace(window.location.origin, ''));
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  // Parâmetros de URL (app aberto pela notificação com o app fechado).
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const doseId = params.get('markDose');
    const status = params.get('status') || 'taken';
    if (doseId) {
      markDose(doseId, status).finally(() => {
        // Remove os parâmetros da URL para não repetir a ação ao recarregar.
        params.delete('markDose');
        params.delete('status');
        const clean = location.pathname + (params.toString() ? `?${params.toString()}` : '');
        navigate(clean, { replace: true });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  return null;
}
