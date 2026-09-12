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

// Ensure today's dose logs exist for all active medications
export async function ensureTodayDoses(medications) {
  const { base44 } = await import('@/api/base44Client');
  // Auto-mark past pending doses as missed before generating today's doses
  await markMissedDoses();
  const today = todayStr();
  const existing = await base44.entities.DoseLog.filter({ scheduled_date: today });
  const existingKeys = new Set(existing.map((d) => `${d.medication_id}_${d.scheduled_time}`));

  const toCreate = [];
  for (const med of medications) {
    if (!med.active) continue;
    const times = med.times?.length ? med.times : ['08:00'];
    for (const time of times) {
      const key = `${med.id}_${time}`;
      if (!existingKeys.has(key)) {
        toCreate.push({
          medication_id: med.id,
          medication_name: med.name,
          scheduled_date: today,
          scheduled_time: time,
          status: 'pending',
        });
      }
    }
  }

  if (toCreate.length > 0) {
    await base44.entities.DoseLog.bulkCreate(toCreate);
  }

  // Return merged list
  const all = [...existing, ...toCreate];
  return all.sort((a, b) => (a.scheduled_time || '').localeCompare(b.scheduled_time || ''));
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

// Auto-mark pending doses as missed if past their scheduled time.
// - Doses from previous days → missed
// - Today's doses with a 2-hour grace period past scheduled_time → missed
export async function markMissedDoses() {
  const { base44 } = await import('@/api/base44Client');
  const today = todayStr();
  const now = new Date();
  const gracePeriodMinutes = 120; // 2 hours

  const pending = await base44.entities.DoseLog.filter({ status: 'pending' });

  const toMiss = pending.filter((d) => {
    if (!d.scheduled_date) return false;
    if (d.scheduled_date < today) return true;
    if (d.scheduled_date === today && d.scheduled_time) {
      const [dh, dm] = d.scheduled_time.split(':').map(Number);
      const doseMinutes = (dh || 0) * 60 + (dm || 0);
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      return (nowMinutes - doseMinutes) > gracePeriodMinutes;
    }
    return false;
  });

  if (toMiss.length > 0) {
    await base44.entities.DoseLog.bulkUpdate(
      toMiss.map((d) => ({ id: d.id, status: 'missed' }))
    );
  }
  return toMiss.length;
}