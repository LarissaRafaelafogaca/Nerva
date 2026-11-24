import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import apiRoutes from './routes';
import seedRoute from './routes/seed';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { openapiSpec } from './docs/openapi';

export function createApp(): Application {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      // Em produção aceita qualquer subdomínio do Vercel além das origens
      // explícitas no CORS_ORIGIN, para que o deploy automático do frontend
      // (que gera URLs únicas por commit) funcione sem precisar atualizar o env.
      origin: (origin, callback) => {
        if (!origin) return callback(null, true); // server-to-server / curl
        const allowed =
          env.corsOrigin.includes(origin) ||
          /^https:\/\/[\w-]+(\.vercel\.app)$/.test(origin) ||
          /^https:\/\/[\w-]+(\.up\.railway\.app)$/.test(origin);
        callback(allowed ? null : new Error('Not allowed by CORS'), allowed);
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  if (!env.isTest) {
    app.use(morgan(env.isProd ? 'combined' : 'dev'));
  }

  // Documentação da API
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));
  app.get('/api/openapi.json', (_req, res) => res.json(openapiSpec));

  // Seed temporário — reativado para corrigir papel admin
  app.use('/api', seedRoute);
  app.use('/api', apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
