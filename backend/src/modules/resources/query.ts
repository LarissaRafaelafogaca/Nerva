import { ResourceConfig } from './resource.registry';
import { BadRequest } from '../../utils/errors';

// Traduz uma query de filtro no estilo Base44 (nomes FE, operador $gte, etc.)
// para um `where` do Prisma (nomes de campo do modelo).
//
// Suporta:
//   { campo: valor }                  -> igualdade
//   { campo: { $gte: v } }            -> gte (também $gt, $lte, $lt, $ne, $in)
//
// Sempre é combinado com o escopo de dono/admin no service (nunca sozinho).
export function buildWhere(
  filter: Record<string, any> | undefined,
  cfg: ResourceConfig,
): Record<string, any> {
  const where: Record<string, any> = {};
  if (!filter || typeof filter !== 'object') return where;

  for (const [feField, rawValue] of Object.entries(filter)) {
    const prismaField = cfg.fieldMap[feField];
    if (!prismaField) {
      // Ignora campos desconhecidos em vez de vazar erro de esquema.
      continue;
    }
    where[prismaField] = translateValue(prismaField, rawValue, cfg);
  }
  return where;
}

function translateValue(prismaField: string, value: any, cfg: ResourceConfig): any {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const out: Record<string, any> = {};
    for (const [op, opVal] of Object.entries(value)) {
      switch (op) {
        case '$gte':
          out.gte = coerceScalar(prismaField, opVal, cfg);
          break;
        case '$gt':
          out.gt = coerceScalar(prismaField, opVal, cfg);
          break;
        case '$lte':
          out.lte = coerceScalar(prismaField, opVal, cfg);
          break;
        case '$lt':
          out.lt = coerceScalar(prismaField, opVal, cfg);
          break;
        case '$ne':
          out.not = coerceScalar(prismaField, opVal, cfg);
          break;
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

// Campos de data-hora armazenados como DateTime precisam ser convertidos.
const DATETIME_FIELDS = new Set(['dateTime', 'takenAt', 'createdAt', 'updatedAt']);

function coerceScalar(prismaField: string, value: any, _cfg: ResourceConfig): any {
  if (typeof value === 'string' && DATETIME_FIELDS.has(prismaField)) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return value;
}

// Converte a string de ordenação do SDK (ex.: '-date_time') em orderBy do Prisma.
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
