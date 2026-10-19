// Utilitários de geração automática de cronograma de medicamentos.

/**
 * Gera os horários únicos (HH:MM) de um cronograma a partir dos parâmetros.
 * Ex.: startTime='06:00', intervalHours=8 → ['06:00','14:00','22:00']
 * Lida corretamente com intervalos que geram repetição no dia seguinte.
 */
export function generateTimesFromInterval(startTime, intervalHours) {
  if (!startTime || !intervalHours || intervalHours <= 0) return [];
  const interval = parseFloat(intervalHours);
  const times = new Set();
  const [sh, sm] = startTime.split(':').map(Number);
  let totalMin = sh * 60 + sm;
  const dayMin = 24 * 60;

  // Gera horários únicos até completar 24h
  for (let i = 0; i < 1000; i++) {
    const min = Math.round(totalMin) % dayMin;
    const h = Math.floor(min / 60);
    const m = min % 60;
    const key = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    if (times.has(key) && i > 0) break; // ciclo completo
    times.add(key);
    totalMin += interval * 60;
    if (i > 100) break; // safety
  }
  return [...times].sort();
}

/**
 * Calcula informações do tratamento:
 * - totalDoses: total de doses no período
 * - dosesPerDay: doses por dia
 * - endDate: data de término (YYYY-MM-DD)
 * - endTime: hora da última dose (HH:MM)
 * - schedule: array com as primeiras N datas do cronograma para preview
 */
export function calcTreatmentInfo(startDate, startTime, intervalHours, durationDays) {
  if (!startDate || !startTime || !intervalHours || !durationDays) return null;
  const interval = parseFloat(intervalHours);
  const duration = parseInt(durationDays, 10);
  if (interval <= 0 || duration <= 0) return null;

  const times = generateTimesFromInterval(startTime, interval);
  const dosesPerDay = times.length;
  const totalDoses = dosesPerDay * duration;

  // Data de término: startDate + (durationDays - 1) dias
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + duration - 1);
  const endDate = end.toISOString().split('T')[0];

  // Último horário do último dia
  const sortedTimes = [...times].sort();
  const lastTime = sortedTimes[sortedTimes.length - 1];

  // Preview: primeiros 3 dias
  const preview = [];
  for (let d = 0; d < Math.min(3, duration); d++) {
    const day = new Date(start);
    day.setDate(day.getDate() + d);
    const dateStr = day.toISOString().split('T')[0];
    const label = d === 0 ? 'Dia 1' : d === 1 ? 'Dia 2' : 'Dia 3';
    preview.push({ date: dateStr, label, times: sortedTimes });
  }
  if (duration > 3) {
    const last = new Date(end);
    const lastTimes = sortedTimes;
    preview.push({ date: endDate, label: `Dia ${duration} (último)`, times: lastTimes, isLast: true });
  }

  // Frequência descritiva
  const frequencyLabel = dosesPerDay === 1
    ? '1x ao dia'
    : dosesPerDay === 2
    ? '2x ao dia'
    : dosesPerDay === 3
    ? '3x ao dia'
    : dosesPerDay === 4
    ? '4x ao dia'
    : `${dosesPerDay}x ao dia`;

  return { times: sortedTimes, dosesPerDay, totalDoses, endDate, endTime: lastTime, preview, frequencyLabel };
}

/**
 * Formata uma data YYYY-MM-DD para exibição legível.
 */
export function formatDateBR(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}
