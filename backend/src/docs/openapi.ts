// Especificação OpenAPI da API do NERVA (servida em /api/docs).
export const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'NERVA API',
    version: '1.0.0',
    description:
      'API REST própria do NERVA (acompanhamento de adesão terapêutica em epilepsia). ' +
      'Substitui a plataforma Base44. Dados de saúde são sensíveis (LGPD).',
  },
  servers: [{ url: '/api' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: { code: { type: 'string' }, message: { type: 'string' } },
          },
        },
      },
      AuthTokens: {
        type: 'object',
        properties: {
          access_token: { type: 'string' },
          refresh_token: { type: 'string' },
          user: { $ref: '#/components/schemas/User' },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          email: { type: 'string' },
          full_name: { type: 'string', nullable: true },
          role: { type: 'string', enum: ['user', 'admin'] },
          profile: { type: 'string', enum: ['patient', 'admin'] },
          language: { type: 'string' },
          theme: { type: 'string', enum: ['light', 'dark'] },
          preferences: { type: 'object', nullable: true },
          email_verified: { type: 'boolean' },
          created_date: { type: 'string', format: 'date-time' },
        },
      },
      Medication: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          dosage: { type: 'string', nullable: true },
          frequency: { type: 'string', nullable: true },
          times: { type: 'array', items: { type: 'string' } },
          color: { type: 'string' },
          notes: { type: 'string', nullable: true },
          active: { type: 'boolean' },
          created_by_id: { type: 'string' },
          created_date: { type: 'string', format: 'date-time' },
        },
      },
      DoseLog: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          medication_id: { type: 'string' },
          medication_name: { type: 'string', nullable: true },
          scheduled_date: { type: 'string', example: '2026-09-12' },
          scheduled_time: { type: 'string', example: '08:00', nullable: true },
          status: { type: 'string', enum: ['pending', 'taken', 'missed', 'skipped'] },
          taken_at: { type: 'string', format: 'date-time', nullable: true },
          created_by_id: { type: 'string' },
        },
      },
      Adherence: {
        type: 'object',
        properties: {
          rate: { type: 'number' },
          taken: { type: 'number' },
          missed: { type: 'number' },
          skipped: { type: 'number' },
          pending: { type: 'number' },
          total: { type: 'number' },
          from: { type: 'string' },
          to: { type: 'string' },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/app/public-settings': {
      get: { summary: 'Configurações públicas do app', security: [], responses: { 200: { description: 'OK' } } },
    },
    '/auth/register': {
      post: {
        summary: 'Cadastro tradicional (envia OTP por e-mail)',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string' },
                  password: { type: 'string' },
                  full_name: { type: 'string' },
                  profile: { type: 'string', enum: ['patient', 'admin'] },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Criado' }, 409: { description: 'E-mail já registrado' } },
      },
    },
    '/auth/verify-otp': {
      post: {
        summary: 'Verifica o código OTP e retorna tokens',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'otpCode'],
                properties: { email: { type: 'string' }, otpCode: { type: 'string' } },
              },
            },
          },
        },
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthTokens' } } } },
          400: { description: 'Código inválido' },
        },
      },
    },
    '/auth/resend-otp': {
      post: { summary: 'Reenvia OTP', security: [], responses: { 200: { description: 'OK' } } },
    },
    '/auth/login': {
      post: {
        summary: 'Login tradicional',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: { email: { type: 'string' }, password: { type: 'string' } },
              },
            },
          },
        },
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthTokens' } } } },
          401: { description: 'Credenciais inválidas' },
        },
      },
    },
    '/auth/google': {
      get: { summary: 'Inicia login Google (redirect)', security: [] },
      post: {
        summary: 'Login Google via ID token (One Tap)',
        security: [],
        responses: { 200: { description: 'OK' } },
      },
    },
    '/auth/refresh': {
      post: { summary: 'Renova o access token', security: [], responses: { 200: { description: 'OK' } } },
    },
    '/auth/logout': {
      post: { summary: 'Logout (revoga refresh token)', security: [], responses: { 200: { description: 'OK' } } },
    },
    '/auth/forgot-password': {
      post: { summary: 'Solicita redefinição de senha', security: [], responses: { 200: { description: 'OK' } } },
    },
    '/auth/reset-password': {
      post: { summary: 'Redefine a senha com token', security: [], responses: { 200: { description: 'OK' } } },
    },
    '/auth/me': {
      get: { summary: 'Usuário autenticado', responses: { 200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } } } },
      patch: { summary: 'Atualiza o próprio usuário (nome, tema, idioma, preferências)', responses: { 200: { description: 'OK' } } },
    },
    '/{resource}': {
      parameters: [
        {
          name: 'resource',
          in: 'path',
          required: true,
          schema: { type: 'string', enum: ['medications', 'dose-logs', 'seizures', 'side-effects', 'sleep-records'] },
        },
      ],
      get: {
        summary: 'Lista registros do usuário (sort, limit, filter JSON com $gte)',
        parameters: [
          { name: 'sort', in: 'query', schema: { type: 'string', example: '-created_date' } },
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
          { name: 'filter', in: 'query', schema: { type: 'string', example: '{"scheduled_date":{"$gte":"2026-08-01"}}' } },
        ],
        responses: { 200: { description: 'OK' } },
      },
      post: { summary: 'Cria um registro', responses: { 201: { description: 'Criado' } } },
    },
    '/{resource}/{id}': {
      parameters: [
        { name: 'resource', in: 'path', required: true, schema: { type: 'string' } },
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
      ],
      patch: { summary: 'Atualiza um registro', responses: { 200: { description: 'OK' }, 404: { description: 'Não encontrado' } } },
      delete: { summary: 'Exclui um registro', responses: { 200: { description: 'OK' } } },
    },
    '/{resource}/bulk': {
      parameters: [{ name: 'resource', in: 'path', required: true, schema: { type: 'string' } }],
      post: { summary: 'Cria vários registros', responses: { 201: { description: 'Criado' } } },
      patch: { summary: 'Atualiza vários registros (cada item com id)', responses: { 200: { description: 'OK' } } },
    },
    '/{resource}/delete-many': {
      parameters: [{ name: 'resource', in: 'path', required: true, schema: { type: 'string' } }],
      post: { summary: 'Exclui vários por filtro (sempre no escopo do usuário)', responses: { 200: { description: 'OK' } } },
    },
    '/doses': {
      get: {
        summary: 'Gera/retorna as doses de um dia',
        parameters: [{ name: 'date', in: 'query', schema: { type: 'string', example: '2026-09-12' } }],
        responses: { 200: { description: 'OK' } },
      },
    },
    '/doses/adherence': {
      get: {
        summary: 'Adesão terapêutica (janela ou período)',
        parameters: [
          { name: 'days', in: 'query', schema: { type: 'integer', example: 30 } },
          { name: 'from', in: 'query', schema: { type: 'string' } },
          { name: 'to', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/Adherence' } } } } },
      },
    },
    '/doses/{id}/take': {
      post: { summary: 'Registra dose tomada', responses: { 200: { description: 'OK' } } },
    },
    '/doses/{id}/skip': {
      post: { summary: 'Registra dose pulada', responses: { 200: { description: 'OK' } } },
    },
    '/users': {
      get: { summary: 'Lista usuários (admin)', responses: { 200: { description: 'OK' }, 403: { description: 'Proibido' } } },
    },
    '/admin/patients': {
      get: { summary: 'Lista pacientes com estatísticas (admin)', responses: { 200: { description: 'OK' } } },
    },
    '/admin/patients/{id}': {
      get: { summary: 'Detalhe de um paciente (admin)', responses: { 200: { description: 'OK' } } },
    },
    '/admin/epidemiology': {
      get: { summary: 'Visão epidemiológica agregada (admin)', responses: { 200: { description: 'OK' } } },
    },
    '/push/public-key': {
      get: { summary: 'Chave pública VAPID para inscrição de push', security: [], responses: { 200: { description: 'OK' } } },
    },
    '/push/subscribe': {
      post: { summary: 'Registra a inscrição de push do dispositivo', responses: { 201: { description: 'Criado' } } },
    },
    '/push/unsubscribe': {
      post: { summary: 'Remove a inscrição de push', responses: { 200: { description: 'OK' } } },
    },
    '/push/test': {
      post: { summary: 'Envia uma notificação de teste imediata (demo)', responses: { 200: { description: 'OK' } } },
    },
  },
};
