import { z } from 'zod';
import { prisma } from '../../config/database';
import {
  serializeDoseLog,
  serializeMedication,
  serializeMoodLog,
  serializeSeizure,
  serializeSideEffect,
  serializeSleepRecord,
} from '../../utils/serialize';

// Um "recurso" descreve como um modelo Prisma é exposto de forma compatível com
// o antigo SDK Base44: mapeamento de campos FE(snake) -> Prisma(camel), o
// serializer inverso, o schema de escrita e a chave de ordenação padrão.

export interface ResourceConfig {
  // nome do delegate no PrismaClient (ex.: 'medication')
  model: 'medication' | 'doseLog' | 'seizure' | 'sideEffect' | 'sleepRecord';
  // FE field -> Prisma field
  fieldMap: Record<string, string>;
  // Prisma field default para ordenação quando sort não é informado
  defaultSort: { field: string; dir: 'asc' | 'desc' };
  serialize: (row: any) => any;
  // schema de criação (campos FE); campos de sistema são adicionados pelo service
  createSchema: z.ZodTypeAny;
  updateSchema: z.ZodTypeAny;
  // coerção de valores de entrada (ex.: datas) por campo FE
  coerce?: (data: Record<string, any>) => Record<string, any>;
}

const severity = z.enum(['mild', 'moderate', 'severe']);

// Aceita tanto ISO completo (2026-09-13T14:30:00.000Z) quanto o formato de
// <input type="datetime-local"> (2026-09-13T14:30) e normaliza para Date válido.
const flexibleDateTime = z
  .string()
  .refine((v) => !Number.isNaN(new Date(v).getTime()), 'Data/hora inválida');

// ---------- Medication ----------
const medicationCreate = z.object({
  name: z.string().trim().min(1).max(200),
  dosage: z.string().max(100).optional().nullable(),
  frequency: z.string().max(100).optional().nullable(),
  times: z.array(z.string().regex(/^\d{2}:\d{2}$/)).optional(),
  color: z
    .enum(['emerald', 'teal', 'cyan', 'lime', 'green', 'amber', 'rose', 'violet'])
    .optional(),
  notes: z.string().max(2000).optional().nullable(),
  active: z.boolean().optional(),
});

// ---------- DoseLog ----------
const doseCreate = z.object({
  medication_id: z.string().min(1),
  medication_name: z.string().optional().nullable(),
  scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scheduled_time: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  status: z.enum(['pending', 'taken', 'missed', 'skipped']).optional(),
  taken_at: flexibleDateTime.optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

// ---------- Seizure ----------
const seizureCreate = z.object({
  date_time: flexibleDateTime,
  type: z
    .enum(['focal', 'generalized', 'absence', 'tonic_clonic', 'myoclonic', 'other'])
    .optional()
    .nullable(),
  duration_minutes: z.number().nonnegative().optional().nullable(),
  severity: severity.optional().nullable(),
  triggers: z.array(z.string()).optional(),
  notes: z.string().max(2000).optional().nullable(),
});

// ---------- SideEffect ----------
const sideEffectCreate = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  medication_id: z.string().optional().nullable(),
  medication_name: z.string().optional().nullable(),
  description: z.string().trim().min(1).max(2000),
  severity: severity.optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

// ---------- SleepRecord ----------
const sleepCreate = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hours: z.number().min(0).max(24),
  quality: z.enum(['poor', 'fair', 'good', 'excellent']).optional().nullable(),
  bedtime: z.string().optional().nullable(),
  wake_time: z.string().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const RESOURCES: Record<string, ResourceConfig> = {
  medications: {
    model: 'medication',
    fieldMap: {
      id: 'id',
      name: 'name',
      dosage: 'dosage',
      frequency: 'frequency',
      times: 'times',
      color: 'color',
      notes: 'notes',
      active: 'active',
      created_by_id: 'userId',
      created_date: 'createdAt',
    },
    defaultSort: { field: 'createdAt', dir: 'desc' },
    serialize: serializeMedication,
    createSchema: medicationCreate,
    updateSchema: medicationCreate.partial(),
  },
  'dose-logs': {
    model: 'doseLog',
    fieldMap: {
      id: 'id',
      medication_id: 'medicationId',
      medication_name: 'medicationName',
      scheduled_date: 'scheduledDate',
      scheduled_time: 'scheduledTime',
      status: 'status',
      taken_at: 'takenAt',
      notes: 'notes',
      created_by_id: 'userId',
      created_date: 'createdAt',
    },
    defaultSort: { field: 'createdAt', dir: 'desc' },
    serialize: serializeDoseLog,
    createSchema: doseCreate,
    updateSchema: doseCreate.partial(),
    coerce: (d) => {
      if (typeof d.taken_at === 'string') d.taken_at = new Date(d.taken_at);
      return d;
    },
  },
  seizures: {
    model: 'seizure',
    fieldMap: {
      id: 'id',
      date_time: 'dateTime',
      type: 'type',
      duration_minutes: 'durationMinutes',
      severity: 'severity',
      triggers: 'triggers',
      notes: 'notes',
      created_by_id: 'userId',
      created_date: 'createdAt',
    },
    defaultSort: { field: 'dateTime', dir: 'desc' },
    serialize: serializeSeizure,
    createSchema: seizureCreate,
    updateSchema: seizureCreate.partial(),
    coerce: (d) => {
      if (typeof d.date_time === 'string') d.date_time = new Date(d.date_time);
      return d;
    },
  },
  'side-effects': {
    model: 'sideEffect',
    fieldMap: {
      id: 'id',
      date: 'date',
      medication_id: 'medicationId',
      medication_name: 'medicationName',
      description: 'description',
      severity: 'severity',
      notes: 'notes',
      created_by_id: 'userId',
      created_date: 'createdAt',
    },
    defaultSort: { field: 'date', dir: 'desc' },
    serialize: serializeSideEffect,
    createSchema: sideEffectCreate,
    updateSchema: sideEffectCreate.partial(),
  },
  'sleep-records': {
    model: 'sleepRecord',
    fieldMap: {
      id: 'id',
      date: 'date',
      hours: 'hours',
      quality: 'quality',
      bedtime: 'bedtime',
      wake_time: 'wakeTime',
      notes: 'notes',
      created_by_id: 'userId',
      created_date: 'createdAt',
    },
    defaultSort: { field: 'date', dir: 'desc' },
    serialize: serializeSleepRecord,
    createSchema: sleepCreate,
    updateSchema: sleepCreate.partial(),
  },
};

export function getModelDelegate(model: ResourceConfig['model']): any {
  return (prisma as any)[model];
}
