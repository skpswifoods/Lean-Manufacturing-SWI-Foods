// src/routes/integrated-operations.ts

import { Hono } from 'hono';
import GoogleWorkspaceIntegration from '../integrations/google-workspace';
import HubConnectionManager from '../integrations/hub-connection';

interface IntegratedEnv {
  DB: D1Database;
  MASTER_DATA: KVNamespace;
  GOOGLE_SERVICE_ACCOUNT_KEY: string;
  GOOGLE_SHEET_ID: string;
  SLACK_WEBHOOK_URL: string;
  TEAMS_WEBHOOK_URL: string;
  GOOGLE_CHAT_WEBHOOK_URL: string;
}

export function createIntegratedRoutes(app: Hono) {
  // Initialize integrations
  const createGoogle = (env: IntegratedEnv) =>
    new GoogleWorkspaceIntegration({
      GOOGLE_SERVICE_ACCOUNT_KEY: env.GOOGLE_SERVICE_ACCOUNT_KEY,
      GOOGLE_SHEET_ID: env.GOOGLE_SHEET_ID,
      GOOGLE_DRIVE_FOLDER_ID: 'YOUR_FOLDER_ID',
    });

  // ==================== SYNC OPERATIONS ====================

  /**
   * Sync Master Data from Google Sheets
   * POST /api/sync/master-data
   */
  app.post('/api/sync/master-data', async (c) => {
    try {
      const env = c.env as IntegratedEnv;
      const google = createGoogle(env);

      const result = await google.syncMasterDataFromSheets(
        env.GOOGLE_SHEET_ID,
        env.MASTER_DATA
      );

      return c.json(result);
    } catch (error) {
      console.error('Error syncing master data:', error);
      return c.json({ error: 'Sync failed' }, 500);
    }
  });

  /**
   * Record Inspection and Sync to Google Sheets
   * POST /api/inspection/record-and-sync
   */
  app.post('/api/inspection/record-and-sync', async (c) => {
    try {
      const env = c.env as IntegratedEnv;
      const payload = await c.req.json<{
        batch_id: string;
        lot_number: string;
        inspection_type: string;
        result: string;
        inspector: string;
        notes?: string;
      }>();

      // Record in database
      await env.DB.prepare(`
        INSERT INTO inspections 
        (id, batch_id, lot_number, type, result, inspector, notes, recorded_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        payload.batch_id,
        payload.lot_number,
        payload.inspection_type,
        payload.result,
        payload.inspector,
        payload.notes || null,
        new Date().toISOString()
      ).run();

      // Sync to Google Sheets
      const google = createGoogle(env);
      await google.appendInspectionResult(env.GOOGLE_SHEET_ID, {
        date: new Date().toLocaleDateString(),
        type: payload.inspection_type,
        status: payload.result,
        batch_id: payload.batch_id,
        lot_number: payload.lot_number,
        result: payload.result,
        inspector: payload.inspector,
      });

      return c.json({
        success: true,
        message: 'Inspection recorded and synced',
      });
    } catch (error) {
      console.error('Error recording inspection:', error);
      return c.json({ error: 'Recording failed' }, 500);
    }
  });

  /**
   * Create Daily QA Report
   * POST /api/reports/daily-qa
   */
  app.post('/api/reports/daily-qa', async (c) => {
    try {
      const env = c.env as IntegratedEnv;

      // Get stats from database
      const stats = await env.DB.prepare(`
        SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN result = 'PASS' THEN 1 END) as passed,
          COUNT(CASE WHEN result = 'FAIL' THEN 1 END) as failed
        FROM inspections
        WHERE DATE(recorded_at) = DATE('now')
      `).first();

      const deviations = await env.DB.prepare(`
        SELECT COUNT(*) as count FROM deviations
        WHERE DATE(deviation_date) = DATE('now')
      `).first();

      const capas = await env.DB.prepare(`
        SELECT COUNT(*) as count FROM capa_records
        WHERE DATE(created_at) = DATE('now')
      `).first();

      // Generate report in Google Sheets
      const google = createGoogle(env);
      const result = await google.generateDailyQAReport(env.GOOGLE_SHEET_ID, {
        date: new Date().toISOString().split('T')[0],
        total_inspections: stats?.total || 0,
        passed: stats?.passed || 0,
        failed: stats?.failed || 0,
        deviations: deviations?.count || 0,
        capas: capas?.count || 0,
      });

      return c.json(result);
    } catch (error) {
      console.error('Error generating report:', error);
      return c.json({ error: 'Report generation failed' }, 500);
    }
  });

  // ==================== NOTIFICATION OPERATIONS ====================

  /**
   * Send Deviation Alert to Slack/Teams/Google Chat
   * POST /api/notify/deviation
   */
  app.post('/api/notify/deviation', async (c) => {
    try {
      const env = c.env as IntegratedEnv;
      const payload = await c.req.json<{
        deviation_id: string;
        type: string;
        severity: string;
        description: string;
        batch_id: string;
        assigned_to: string;
        platform: 'slack' | 'teams' | 'google_chat';
      }>();

      const manager = new HubConnectionManager({
        type: payload.platform,
        webhook_url:
          payload.platform === 'slack'
            ? env.SLACK_WEBHOOK_URL
            : payload.platform === 'teams'
              ? env.TEAMS_WEBHOOK_URL
              : env.GOOGLE_CHAT_WEBHOOK_URL,
      });

      let result;

      if (payload.platform === 'slack') {
        result = await manager.sendSlackDeviationCard('#qa-alerts', {
          id: payload.deviation_id,
          type: payload.type,
          severity: payload.severity,
          description: payload.description,
          batch_id: payload.batch_id,
          assigned_to: payload.assigned_to,
        });
      } else if (payload.platform === 'teams') {
        result = await manager.sendTeamsAlert({
          title: `Quality Deviation: ${payload.type}`,
          severity: payload.severity as 'info' | 'warning' | 'critical',
          message: payload.description,
          batch_id: payload.batch_id,
        });
      }

      return c.json(result);
    } catch (error) {
      console.error('Error sending notification:', error);
      return c.json({ error: 'Notification failed' }, 500);
    }
  });

  /**
   * Send CAPA Assignment Notification
   * POST /api/notify/capa
   */
  app.post('/api/notify/capa', async (c) => {
    try {
      const env = c.env as IntegratedEnv;
      const payload = await c.req.json<{
        capa_id: string;
        deviation_type: string;
        assigned_to: string;
        deadline: string;
        platform: 'slack' | 'teams' | 'google_chat';
      }>();

      const google = createGoogle(env);

      if (payload.platform === 'google_chat') {
        // Use Google Chat API
        const chatSpaceId = 'spaces/YOUR_SPACE_ID'; // Should be in env
        await google.notifyCAPA(chatSpaceId, {
          capa_id: payload.capa_id,
          deviation_type: payload.deviation_type,
          assigned_to: payload.assigned_to,
          deadline: payload.deadline,
        });
      } else {
        const manager = new HubConnectionManager({
          type: payload.platform,
          webhook_url:
            payload.platform === 'slack'
              ? env.SLACK_WEBHOOK_URL
              : env.TEAMS_WEBHOOK_URL,
        });

        await manager.sendSlackAlert({
          channel: '#qa-alerts',
          title: `📋 New CAPA Assignment`,
          severity: 'warning',
          message: `${payload.deviation_type} - Assigned to ${payload.assigned_to}`,
          actions: [
            {
              text: 'Open CAPA',
              url: `https://qas.company.com/capa/${payload.capa_id}`,
            },
          ],
        });
      }

      return c.json({ success: true, message: 'Notification sent' });
    } catch (error) {
      console.error('Error notifying CAPA:', error);
      return c.json({ error: 'Notification failed' }, 500);
    }
  });

  // ==================== DOCUMENT MANAGEMENT ====================

  /**
   * Upload QA Document to Google Drive
   * POST /api/documents/upload
   */
  app.post('/api/documents/upload', async (c) => {
    try {
      const env = c.env as IntegratedEnv;
      const formData = await c.req.formData();

      const file = formData.get('file') as File;
      const docType = formData.get('docType') as string; // QP, WI, FM, SD
      const fileName = formData.get('fileName') as string;

      if (!file || !docType || !fileName) {
        return c.json({ error: 'Missing required fields' }, 400);
      }

      const buffer = await file.arrayBuffer();
      const google = createGoogle(env);

      const result = await google.uploadQADocument(
        `${docType}/${fileName}`,
        Buffer.from(buffer),
        file.type
      );

      return c.json(result);
    } catch (error) {
      console.error('Error uploading document:', error);
      return c.json({ error: 'Upload failed' }, 500);
    }
  });

  /**
   * Create GHP Inspection Form
   * POST /api/forms/create-ghp-form
   */
  app.post('/api/forms/create-ghp-form', async (c) => {
    try {
      const env = c.env as IntegratedEnv;
      const payload = await c.req.json<{
        form_title: string;
        checkpoints: string[];
      }>();

      const google = createGoogle(env);

      const result = await google.createGHPChecklistForm(
        payload.form_title,
        payload.checkpoints
      );

      return c.json(result);
    } catch (error) {
      console.error('Error creating form:', error);
      return c.json({ error: 'Form creation failed' }, 500);
    }
  });
}

export default createIntegratedRoutes;
