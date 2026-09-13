import { prisma } from '../src/config/database';

// Limpa todas as tabelas entre testes. Um único deleteMany em `user` já remove
// os dependentes via ON DELETE CASCADE, mas apagamos explicitamente para deixar
// claro e cobrir tabelas sem cascade lógico.
export async function resetDb(): Promise<void> {
  await prisma.doseLog.deleteMany();
  await prisma.sideEffect.deleteMany();
  await prisma.seizure.deleteMany();
  await prisma.sleepRecord.deleteMany();
  await prisma.medication.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.emailVerificationToken.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.user.deleteMany();
}

// NÃO desconecte o Prisma por suíte: o client é um singleton compartilhado entre
// as suítes na mesma execução. A desconexão fica no globalTeardown.
export async function closeDb(): Promise<void> {
  // no-op mantido por compatibilidade com testes existentes
}
