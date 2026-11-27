import * as XLSX from 'xlsx';

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function fmtDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

const STATUS_PT = { taken: 'Tomada', missed: 'Perdida', skipped: 'Pulada', pending: 'Pendente' };
const SEVERITY_PT = { mild: 'Leve', moderate: 'Moderada', severe: 'Grave' };
const QUALITY_PT = { poor: 'Ruim', fair: 'Regular', good: 'Boa', excellent: 'Excelente' };
const SEIZURE_TYPE_PT = {
  focal: 'Focal',
  generalized: 'Generalizada',
  absence: 'Ausência',
  tonic_clonic: 'Tônico-Clônica',
  myoclonic: 'Mioclônica',
  other: 'Outra',
};

function autoColWidths(data) {
  if (!data.length) return [];
  const keys = Object.keys(data[0]);
  return keys.map((k) => {
    const maxLen = Math.max(k.length, ...data.map((row) => String(row[k] ?? '').length));
    return { wch: Math.min(maxLen + 2, 50) };
  });
}

function makeSheet(rows) {
  if (!rows.length) return XLSX.utils.aoa_to_sheet([['Nenhum registro encontrado']]);
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = autoColWidths(rows);
  return ws;
}

export function exportToExcel({ user, medications, doseLogs, seizures, sleepRecords, sideEffects }) {
  const wb = XLSX.utils.book_new();

  const taken = doseLogs.filter((d) => d.status === 'taken').length;
  const missed = doseLogs.filter((d) => d.status === 'missed').length;
  const skipped = doseLogs.filter((d) => d.status === 'skipped').length;
  const completed = taken + missed + skipped;
  const adherenceRate = completed > 0 ? Math.round((taken / completed) * 100) : 0;

  const resumoRows = [
    { Campo: 'Paciente',              Valor: user?.full_name || '—' },
    { Campo: 'E-mail',                Valor: user?.email || '—' },
    { Campo: 'Exportado em',          Valor: fmtDateTime(new Date().toISOString()) },
    { Campo: '',                      Valor: '' },
    { Campo: 'Medicamentos cadastrados', Valor: medications.length },
    { Campo: 'Medicamentos ativos',   Valor: medications.filter((m) => m.active !== false).length },
    { Campo: '',                      Valor: '' },
    { Campo: 'Total de doses registradas', Valor: doseLogs.length },
    { Campo: 'Doses tomadas',         Valor: taken },
    { Campo: 'Doses perdidas',        Valor: missed },
    { Campo: 'Doses puladas',         Valor: skipped },
    { Campo: 'Taxa de adesão',        Valor: completed > 0 ? `${adherenceRate}%` : '—' },
    { Campo: '',                      Valor: '' },
    { Campo: 'Crises registradas',    Valor: seizures.length },
    { Campo: 'Registros de sono',     Valor: sleepRecords.length },
    {
      Campo: 'Média de horas de sono',
      Valor: sleepRecords.length
        ? `${(sleepRecords.reduce((s, r) => s + (r.hours || 0), 0) / sleepRecords.length).toFixed(1)}h`
        : '—',
    },
    { Campo: 'Efeitos colaterais registrados', Valor: sideEffects.length },
    { Campo: '',                      Valor: '' },
    { Campo: 'AVISO',                 Valor: 'Este arquivo é um registro pessoal. Não substitui acompanhamento médico.' },
  ];
  XLSX.utils.book_append_sheet(wb, makeSheet(resumoRows), 'Resumo');

  const medsRows = medications.map((m) => ({
    'Nome':        m.name,
    'Dosagem':     m.dosage || '—',
    'Frequência':  m.frequency || '—',
    'Horários':    Array.isArray(m.times) && m.times.length ? m.times.join(', ') : '—',
    'Situação':    m.active !== false ? 'Ativo' : 'Inativo',
    'Notas':       m.notes || '',
    'Cadastrado em': fmtDate(m.created_date),
  }));
  XLSX.utils.book_append_sheet(wb, makeSheet(medsRows), 'Medicamentos');

  const dosesRows = doseLogs.map((d) => ({
    'Data':       d.scheduled_date ? fmtDate(d.scheduled_date + 'T00:00:00') : '—',
    'Horário':    d.scheduled_time || '—',
    'Medicamento': d.medication_name || '—',
    'Situação':   STATUS_PT[d.status] || d.status,
    'Tomada em':  d.taken_at ? fmtDateTime(d.taken_at) : '—',
    'Notas':      d.notes || '',
  }));
  XLSX.utils.book_append_sheet(wb, makeSheet(dosesRows), 'Doses');

  const seizuresRows = seizures.map((s) => ({
    'Data e hora':   fmtDateTime(s.date_time),
    'Tipo':          SEIZURE_TYPE_PT[s.type] || s.type || '—',
    'Duração (min)': s.duration_minutes ?? '—',
    'Gravidade':     SEVERITY_PT[s.severity] || s.severity || '—',
    'Gatilhos':      Array.isArray(s.triggers) && s.triggers.length ? s.triggers.join(', ') : '—',
    'Notas':         s.notes || '',
  }));
  XLSX.utils.book_append_sheet(wb, makeSheet(seizuresRows), 'Crises');

  const sleepRows = sleepRecords.map((r) => ({
    'Data':           r.date ? fmtDate(r.date + 'T00:00:00') : '—',
    'Horas dormidas': r.hours ?? '—',
    'Qualidade':      QUALITY_PT[r.quality] || r.quality || '—',
    'Dormiu às':      r.bedtime || '—',
    'Acordou às':     r.wake_time || '—',
    'Notas':          r.notes || '',
  }));
  XLSX.utils.book_append_sheet(wb, makeSheet(sleepRows), 'Sono');

  const effectsRows = sideEffects.map((e) => ({
    'Data':        e.date ? fmtDate(e.date + 'T00:00:00') : '—',
    'Medicamento': e.medication_name || '—',
    'Descrição':   e.description || '—',
    'Gravidade':   SEVERITY_PT[e.severity] || e.severity || '—',
    'Notas':       e.notes || '',
  }));
  XLSX.utils.book_append_sheet(wb, makeSheet(effectsRows), 'Efeitos Colaterais');

  const fileName = `nerva-dados-${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
