import express from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';

import { openApiDocument } from '@/docs/openapi';
import { errorHandler } from '@/middleware/errorHandler';
import { rateLimiter } from '@/middleware/rateLimiter';
import authRoutes from '@/routes/authRoutes';

export const app = express();

// Mounted before helmet/rateLimiter so the Swagger UI page (inline scripts, static
// assets) isn't blocked by the API's CSP and doesn't count against the API rate limit.
app.get('/api-docs.json', (_req, res) => res.json(openApiDocument));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));

app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(rateLimiter);

app.use('/api/auth', authRoutes);

app.use(errorHandler);
