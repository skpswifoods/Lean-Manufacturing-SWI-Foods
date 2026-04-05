// src/index.ts - Main entry point for Cloudflare Worker

import { Hono } from 'hono';
import { createMasterDataRoutes } from './routes/master-data-routes';
import { createIntegratedRoutes } from './routes/integrated-operations';

export interface Env {
  DB: D1Database;
  MASTER_DATA: KVNamespace;
  SESSION_STORE: KVNamespace;
  CACHE: KVNamespace;
  QA_EVENTS: AnalyticsEngineDataset;
  PRODUCTION_METRICS: AnalyticsEngineDataset;
  DEVIATION_TRACKING: AnalyticsEngineDataset;
  BATCH_STATE: DurableObjectNamespace;
  PRODUCTION_MONITOR: DurableObjectNamespace;

  // Secrets
  GOOGLE_SERVICE_ACCOUNT_KEY: string;
  GOOGLE_SERVICE_ACCOUNT_EMAIL: string;
  SLACK_WEBHOOK_URL: string;
  SLACK_BOT_TOKEN: string;
  TEAMS_WEBHOOK_URL: string;
  TEAMS_BOT_APP_ID: string;
  GOOGLE_CHAT_WEBHOOK_URL: string;
  JWT_SECRET: string;
  ENCRYPTION_KEY: string;
  DATABASE_ENCRYPTION_KEY: string;
  SENDGRID_API_KEY: string;

  // Vars
  ENVIRONMENT: string;
  LOG_LEVEL: string;
  API_VERSION: string;
  GOOGLE_SHEET_ID: string;
  SLACK_CHANNEL: string;
  TEAMS_SPACE_ID: string;
  ALERT_SEVERITY_THRESHOLD: string;
  BATCH_TIMEOUT_HOURS: string;
  INSPECTION_FORM_ID: string;
  QA_DASHBOARD_URL: string;
  CAPA_AUTO_ASSIGN: string;
  EMAIL_NOTIFICATION_ENABLED: string;
  ENABLE_RATE_LIMITING: string;
  RATE_LIMIT_REQUESTS_PER_MINUTE: string;
}

const app = new Hono<{ Bindings: Env }>();

// Health check
app.get('/', (c) => {
  return c.json({
    name: 'Lean Manufacturing QMS - SWI Foods',
    version: c.env.API_VERSION || 'v1',
    environment: c.env.ENVIRONMENT || 'production',
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Register routes
createMasterDataRoutes(app);
createIntegratedRoutes(app);

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not found', path: c.req.path }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

export default app;

// ==================== DURABLE OBJECTS ====================

export class BatchStateManager {
  state: DurableObjectState;
  constructor(state: DurableObjectState) {
    this.state = state;
  }
  async fetch(request: Request): Promise<Response> {
    return new Response('BatchStateManager', { status: 200 });
  }
}

export class ProductionMonitor {
  state: DurableObjectState;
  constructor(state: DurableObjectState) {
    this.state = state;
  }
  async fetch(request: Request): Promise<Response> {
    return new Response('ProductionMonitor', { status: 200 });
  }
}
