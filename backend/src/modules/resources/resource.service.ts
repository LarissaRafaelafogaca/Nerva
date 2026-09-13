import { getModelDelegate, ResourceConfig } from './resource.registry';
import { buildOrderBy, buildWhere } from './query';
import { AuthUser } from '../../middleware/auth';
import { isAdminUser } from '../../middleware/rbac';
import { Forbidden, NotFound } from '../../utils/errors';

// Escopo de segurança (RLS): não-admin só enxerga os próprios registros.
// Admin não recebe filtro de dono. NUNCA confia em user_id vindo do cliente.
function ownershipWhere(user: AuthUser): Record<string, any> {
  return isAdminUser(user) ? {} : { userId: user.id };
}

// Converte um objeto FE (snake) em dados Prisma (camel), ignorando campos de
// sistema que o cliente não deve definir.
function toPrismaData(feData: Record<string, any>, cfg: ResourceConfig): Record<string, any> {
  const coerced = cfg.coerce ? cfg.coerce({ ...feData }) : { ...feData };
  const data: Record<string, any> = {};
  for (const [feField, value] of Object.entries(coerced)) {
    if (feField === 'id' || feField === 'created_by_id' || feField === 'created_date') continue;
    const prismaField = cfg.fieldMap[feField];
    if (prismaField) data[prismaField] = value;
  }
  return data;
}

export async function list(
  cfg: ResourceConfig,
  user: AuthUser,
  opts: { sort?: string; limit?: number; filter?: Record<string, any> },
): Promise<any[]> {
  const model = getModelDelegate(cfg.model);
  const where = { ...ownershipWhere(user), ...buildWhere(opts.filter, cfg) };
  const rows = await model.findMany({
    where,
    orderBy: buildOrderBy(opts.sort, cfg),
    take: opts.limit && opts.limit > 0 ? Math.min(opts.limit, 2000) : undefined,
  });
  return rows.map(cfg.serialize);
}

export async function create(
  cfg: ResourceConfig,
  user: AuthUser,
  feData: Record<string, any>,
): Promise<any> {
  const model = getModelDelegate(cfg.model);
  const data = { ...toPrismaData(feData, cfg), userId: user.id };
  const row = await model.create({ data });
  return cfg.serialize(row);
}

export async function bulkCreate(
  cfg: ResourceConfig,
  user: AuthUser,
  items: Record<string, any>[],
): Promise<any[]> {
  const model = getModelDelegate(cfg.model);
  const created = await Promise.all(
    items.map((item) => model.create({ data: { ...toPrismaData(item, cfg), userId: user.id } })),
  );
  return created.map(cfg.serialize);
}

// Garante que o registro pertence ao usuário (ou que ele é admin).
async function assertOwnership(cfg: ResourceConfig, user: AuthUser, id: string): Promise<any> {
  const model = getModelDelegate(cfg.model);
  const row = await model.findUnique({ where: { id } });
  if (!row) throw NotFound('Resource not found');
  if (!isAdminUser(user) && row.userId !== user.id) {
    // Não revela existência de recurso de outro usuário.
    throw NotFound('Resource not found');
  }
  return row;
}

export async function update(
  cfg: ResourceConfig,
  user: AuthUser,
  id: string,
  feData: Record<string, any>,
): Promise<any> {
  await assertOwnership(cfg, user, id);
  const model = getModelDelegate(cfg.model);
  const row = await model.update({ where: { id }, data: toPrismaData(feData, cfg) });
  return cfg.serialize(row);
}

export async function bulkUpdate(
  cfg: ResourceConfig,
  user: AuthUser,
  items: Array<Record<string, any> & { id: string }>,
): Promise<any[]> {
  const results = [];
  for (const item of items) {
    const { id, ...rest } = item;
    results.push(await update(cfg, user, id, rest));
  }
  return results;
}

export async function remove(cfg: ResourceConfig, user: AuthUser, id: string): Promise<void> {
  await assertOwnership(cfg, user, id);
  const model = getModelDelegate(cfg.model);
  await model.delete({ where: { id } });
}

export async function deleteMany(
  cfg: ResourceConfig,
  user: AuthUser,
  filter: Record<string, any>,
): Promise<{ count: number }> {
  const model = getModelDelegate(cfg.model);
  // Exclusão em massa é destrutiva: SEMPRE restringimos ao usuário autenticado,
  // INCLUSIVE para admin. "Apagar meus dados" jamais deve tocar dados de outra
  // pessoa. Ignoramos qualquer created_by_id/userId vindo do filtro do cliente.
  const clientFilter = buildWhere(filter, cfg);
  delete clientFilter.userId; // nunca aceita dono vindo do cliente
  const where = { ...clientFilter, userId: user.id };
  const result = await model.deleteMany({ where });
  return { count: result.count };
}
