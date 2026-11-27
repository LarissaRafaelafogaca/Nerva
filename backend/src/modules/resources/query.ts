import { ResourceConfig } from './resource.registry';
import { BadRequest } from '../../utils/errors';

export function buildWhere(
  filter: Record<string, any> | undefined,
  cfg: ResourceConfig,
): Record<string, any> {
  const where: Record<string, any> = {};
  if (!filter || typeof filter !== 'object') return where;

  for (const [feField, rawValue] of Object.entries(filter)) {
    const prismaField = cfg.fieldMap[feField];
    if (!prismaField) continue;
    where[prismaField] = translateValue(prismaField, rawValue, cfg);
  }
  return where;
}

function translateValue(prismaField: string, value: any, cfg: ResourceConfig): any {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const out: Record<string, any> = {};
    for (const [op, opVal] of Object.entries(value)) {
      switch (op) {
        case '$gte': out.gte = coerceScalar(prismaField, opVal, cfg); break;
        case '$gt':  out.gt  = coerceScalar(prismaField, opVal, cfg); break;
        case '$lte': out.lte = coerceScalar(prismaField, opVal, cfg); break;
        case '$lt':  out.lt  = coerceScalar(prismaField, opVal, cfg); break;
        case '$ne':  out.not = coerceScalar(prismaField, opVal, cfg); break;
        case '$in':
          out.in = Array.isArray(opVal) ? opVal.map((v) => coerceScalar(prismaField, v, cfg)) : [];
          break;
        default:
          throw BadRequest(`Unsupported filter operator: ${op}`);
      }
    }
    return out;
  }
  return coerceScalar(prismaField, value, cfg);
}

const DATETIME_FIELDS = new Set(['dateTime', 'takenAt', 'createdAt', 'updatedAt']);

function coerceScalar(prismaField: string, value: any, _cfg: ResourceConfig): any {
  if (typeof value === 'string' && DATETIME_FIELDS.has(prismaField)) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return value;
}

export function buildOrderBy(
  sort: string | undefined,
  cfg: ResourceConfig,
): Record<string, 'asc' | 'desc'> {
  if (!sort) return { [cfg.defaultSort.field]: cfg.defaultSort.dir };
  const dir: 'asc' | 'desc' = sort.startsWith('-') ? 'desc' : 'asc';
  const feField = sort.replace(/^-/, '');
  const prismaField = cfg.fieldMap[feField] ?? cfg.defaultSort.field;
  return { [prismaField]: dir };
}
