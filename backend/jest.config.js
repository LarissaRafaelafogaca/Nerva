/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 30000,
  clearMocks: true,
  // O Prisma é um singleton compartilhado entre suítes; encerramos o processo ao
  // final para liberar a conexão sem desconectar por suíte.
  forceExit: true,
  // Suítes compartilham o mesmo banco de teste; rode uma de cada vez.
  maxWorkers: 1,
};
