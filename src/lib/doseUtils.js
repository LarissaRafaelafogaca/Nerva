// Utility functions for dose log management

export function todayStr() {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${m || '00'} ${ampm}`;
}

// Busca (e gera no servidor se necessário) as doses do dia atual.
// Usa o endpoint dedicado /api/doses?date=... do backend, que:
//   - gera doses pending para medicamentos ativos do dia (server-side, sem duplicação)
//   - retorna o estado atual — incluindo doses já marcadas como missed pelo cron
// O parâmetro `medications` é mantido por compatibilidade mas não é mais usado.
export async function ensureTodayDoses(_medications) {
  const { base44 } = await import('@/api/base44Client');
  const today = todayStr();
  return base44.doses.getToday(today);
}

// Calculate adherence rate from dose logs
export function calculateAdherence(doseLogs) {
  if (!doseLogs.length) return { rate: 0, taken: 0, missed: 0, skipped: 0, pending: 0, total: 0 };
  const taken = doseLogs.filter((d) => d.status === 'taken').length;
  const missed = doseLogs.filter((d) => d.status === 'missed').length;
  const skipped = doseLogs.filter((d) => d.status === 'skipped').length;
  const pending = doseLogs.filter((d) => d.status === 'pending').length;
  const completed = taken + missed + skipped;
  const rate = completed > 0 ? Math.round((taken / completed) * 100) : 0;
  return { rate, taken, missed, skipped, pending, total: doseLogs.length };
}

// Get last N days as array of date strings
export function getLastNDays(n) {
  const days = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
}

// Get greeting based on hour
export function getGreeting(t) {
  const h = new Date().getHours();
  if (h < 12) return t('dashboard.greetingMorning');
  if (h < 18) return t('dashboard.greetingAfternoon');
  if (h < 22) return t('dashboard.greetingEvening');
  return t('dashboard.greetingNight');
}


