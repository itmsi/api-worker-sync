import express, { Application, Request, Response, NextFunction } from 'express';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import retryRoutes from './routes/retry.routes';
import healthRoutes from './routes/health.routes';
import outboxRoutes from './routes/outbox.routes';
import { logger } from './utils/logger';

const app: Application = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info({ method: req.method, url: req.url, body: req.body }, '[HTTP] Incoming request');
  next();
});

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes
app.use('/health', healthRoutes);
app.use('/retry', retryRoutes);
app.use('/outbox', outboxRoutes);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err: err.message, stack: err.stack }, '[HTTP] Unhandled error');
  res.status(500).json({ success: false, message: err.message || 'Internal server error' });
});

export default app;
