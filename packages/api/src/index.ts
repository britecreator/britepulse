/**
 * BritePulse API Server
 * Main entry point
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

import { config, validateConfig } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { errorHandler, requestContext } from './middleware/index.js';
import {
  healthRoutes,
  authRoutes,
  eventsRoutes,
  adminRoutes,
  issuesRoutes,
} from './routes/index.js';

// Validate configuration
const configErrors = validateConfig();
if (configErrors.length > 0) {
  console.error('Configuration errors:');
  configErrors.forEach((err) => console.error(`  - ${err}`));
  if (config.nodeEnv === 'production') {
    process.exit(1);
  }
}

// Create Express app
const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: config.nodeEnv === 'production' ? undefined : false, // Disable CSP in dev for test page
}));
app.use(
  cors({
    origin: config.nodeEnv === 'production' ? config.consoleBaseUrl : true,
    credentials: true,
  })
);

// Request parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Request context (ID, timing)
app.use(requestContext);

// Rate limiting (global)
const globalLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMaxRequests,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests, please try again later',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

// Serve SDK files
const sdkPath = path.resolve(__dirname, '../../sdk/dist');
app.get('/sdk.js', (_req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(path.join(sdkPath, 'britepulse.umd.js'));
});
app.get('/sdk.esm.js', (_req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(path.join(sdkPath, 'britepulse.es.js'));
});

// Serve test page
const rootPath = path.resolve(__dirname, '../../..');
app.get('/test', (_req, res) => {
  res.sendFile(path.join(rootPath, 'test-sdk.html'));
});

// Routes
app.use('/health', healthRoutes);
app.use('/auth', authRoutes);
app.use('/events', eventsRoutes);
app.use('/admin', adminRoutes);
app.use('/issues', issuesRoutes);

// Placeholder route (to be implemented)
app.use('/briefs', (_req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Coming soon' } });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found',
    },
  });
});

// Global error handler
app.use(errorHandler);

// Start server - bind to all interfaces
const server = app.listen(config.port, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║                   BritePulse API Server                  ║
╠══════════════════════════════════════════════════════════╣
║  Port:        ${config.port.toString().padEnd(42)}║
║  Environment: ${config.nodeEnv.padEnd(42)}║
║  Project:     ${(config.gcpProjectId || 'not configured').padEnd(42)}║
╚══════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
const shutdown = () => {
  console.log('\nShutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('Forced shutdown');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
