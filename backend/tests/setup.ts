// Configuração global dos testes. Usa um banco PostgreSQL de teste real
// (defina DATABASE_URL de teste no ambiente antes de rodar `npm test`).
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'test-access-secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret';
process.env.ACCESS_TOKEN_EXPIRES_IN = '15m';
// E-mail admin autorizado usado pelos testes de RBAC.
process.env.ADMIN_EMAILS = 'admin@nerva.test';
