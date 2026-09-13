// Traduz os modelos do Prisma (camelCase) para a forma que o front-end espera
// (mesmos nomes de campo usados pelo antigo SDK Base44), incluindo os campos de
// sistema `id`, `created_by_id` e `created_date`.

type AnyRecord = Record<string, any>;

function iso(d: Date | null | undefined): string | null {
  return d ? new Date(d).toISOString() : null;
}

export function serializeUser(u: AnyRecord): AnyRecord {
  if (!u) return u;
  const prefs = (u.preferences ?? {}) as AnyRecord;
  // Nunca expõe o PIN em claro/hash: apenas indica se está definido.
  let preferences = u.preferences ?? undefined;
  if (prefs?.security && typeof prefs.security === 'object') {
    const security = { ...prefs.security };
    if (security.pin) security.pin = '__set__';
    preferences = { ...prefs, security };
  }
  return {
    id: u.id,
    email: u.email,
    full_name: u.fullName ?? null,
    role: u.role,
    profile: u.profile,
    provider: u.provider,
    language: u.language,
    theme: u.theme,
    preferences: preferences ?? null,
    email_verified: u.emailVerified,
    created_by_id: u.id,
    created_date: iso(u.createdAt),
    updated_date: iso(u.updatedAt),
  };
}

export function serializeMedication(m: AnyRecord): AnyRecord {
  return {
    id: m.id,
    name: m.name,
    dosage: m.dosage ?? null,
    frequency: m.frequency ?? null,
    times: m.times ?? [],
    color: m.color,
    notes: m.notes ?? null,
    active: m.active,
    created_by_id: m.userId,
    created_date: iso(m.createdAt),
    updated_date: iso(m.updatedAt),
  };
}

export function serializeDoseLog(d: AnyRecord): AnyRecord {
  return {
    id: d.id,
    medication_id: d.medicationId,
    medication_name: d.medicationName ?? null,
    scheduled_date: d.scheduledDate,
    scheduled_time: d.scheduledTime ?? null,
    status: d.status,
    taken_at: iso(d.takenAt),
    notes: d.notes ?? null,
    created_by_id: d.userId,
    created_date: iso(d.createdAt),
    updated_date: iso(d.updatedAt),
  };
}

export function serializeSeizure(s: AnyRecord): AnyRecord {
  return {
    id: s.id,
    date_time: iso(s.dateTime),
    type: s.type ?? null,
    duration_minutes: s.durationMinutes ?? null,
    severity: s.severity ?? null,
    triggers: s.triggers ?? [],
    notes: s.notes ?? null,
    created_by_id: s.userId,
    created_date: iso(s.createdAt),
    updated_date: iso(s.updatedAt),
  };
}

export function serializeSideEffect(s: AnyRecord): AnyRecord {
  return {
    id: s.id,
    date: s.date,
    medication_id: s.medicationId ?? null,
    medication_name: s.medicationName ?? null,
    description: s.description,
    severity: s.severity ?? null,
    notes: s.notes ?? null,
    created_by_id: s.userId,
    created_date: iso(s.createdAt),
    updated_date: iso(s.updatedAt),
  };
}

export function serializeMoodLog(m: AnyRecord): AnyRecord {
  return {
    id: m.id,
    date: m.date,
    mood: m.mood,
    note: m.note ?? null,
    created_by_id: m.userId,
    created_date: iso(m.createdAt),
    updated_date: iso(m.updatedAt),
  };
}

export function serializeSleepRecord(s: AnyRecord): AnyRecord {
  return {
    id: s.id,
    date: s.date,
    hours: s.hours,
    quality: s.quality ?? null,
    bedtime: s.bedtime ?? null,
    wake_time: s.wakeTime ?? null,
    notes: s.notes ?? null,
    created_by_id: s.userId,
    created_date: iso(s.createdAt),
    updated_date: iso(s.updatedAt),
  };
}
