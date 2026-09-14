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
      origin: env.corsOrigin,
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

  // Seed temporário — antes das rotas autenticadas
  // app.use('/api', seedRoute); // REMOVIDO após setup inicial
  app.use('/api', apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
