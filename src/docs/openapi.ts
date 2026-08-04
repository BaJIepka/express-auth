import { OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';

import { registry } from '@/docs/registry';

const generator = new OpenApiGeneratorV31(registry.definitions);

export const openApiDocument = generator.generateDocument({
  openapi: '3.1.0',
  info: {
    title: 'Express Auth API',
    version: '1.0.0',
    description: 'Документация REST API для сервиса аутентификации',
  },
  servers: [{ url: '/' }],
});
