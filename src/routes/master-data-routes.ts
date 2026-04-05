// src/routes/master-data-routes.ts

import { Hono } from 'hono';
import { handleMasterDataUpload } from '../master-data-init';
import GoogleWorkspaceIntegration from '../integrations/google-workspace-v2';

export function createMasterDataRoutes(app: Hono) {
  /**
   * Upload Master Data from Excel
   * POST /api/master-data/upload
   */
  app.post('/api/master-data/upload', async (c) => {
    try {
      const env = c.env as any;
      return await handleMasterDataUpload(c.req.raw, env);
    } catch (error) {
      console.error('Error in upload route:', error);
      return c.json({ error: 'Upload failed' }, 500);
    }
  });

  /**
   * Get Supplier by ID
   * GET /api/master-data/supplier/:supplierId
   */
  app.get('/api/master-data/supplier/:supplierId', async (c) => {
    try {
      const { supplierId } = c.req.param();
      const env = c.env as any;

      const supplier = await env.MASTER_DATA.get(`supplier:${supplierId}`, 'json');

      if (!supplier) {
        return c.json({ error: 'Supplier not found' }, 404);
      }

      return c.json({ success: true, data: supplier });
    } catch (error) {
      return c.json({ error: 'Error fetching supplier' }, 500);
    }
  });

  /**
   * Get Material by Code
   * GET /api/master-data/material/:materialCode
   */
  app.get('/api/master-data/material/:materialCode', async (c) => {
    try {
      const { materialCode } = c.req.param();
      const env = c.env as any;

      const material = await env.MASTER_DATA.get(`material:${materialCode}`, 'json');

      if (!material) {
        return c.json({ error: 'Material not found' }, 404);
      }

      return c.json({ success: true, data: material });
    } catch (error) {
      return c.json({ error: 'Error fetching material' }, 500);
    }
  });

  /**
   * Get Process by ID
   * GET /api/master-data/process/:processId
   */
  app.get('/api/master-data/process/:processId', async (c) => {
    try {
      const { processId } = c.req.param();
      const env = c.env as any;

      const process = await env.MASTER_DATA.get(`process:${processId}`, 'json');

      if (!process) {
        return c.json({ error: 'Process not found' }, 404);
      }

      return c.json({ success: true, data: process });
    } catch (error) {
      return c.json({ error: 'Error fetching process' }, 500);
    }
  });

  /**
   * Get CCP by ID
   * GET /api/master-data/ccp/:ccpId
   */
  app.get('/api/master-data/ccp/:ccpId', async (c) => {
    try {
      const { ccpId } = c.req.param();
      const env = c.env as any;

      const ccp = await env.MASTER_DATA.get(`ccp:${ccpId}`, 'json');

      if (!ccp) {
        return c.json({ error: 'CCP not found' }, 404);
      }

      return c.json({ success: true, data: ccp });
    } catch (error) {
      return c.json({ error: 'Error fetching CCP' }, 500);
    }
  });

  /**
   * Get Finished Good by Code
   * GET /api/master-data/finished-good/:fgCode
   */
  app.get('/api/master-data/finished-good/:fgCode', async (c) => {
    try {
      const { fgCode } = c.req.param();
      const env = c.env as any;

      const fg = await env.MASTER_DATA.get(`finished_good:${fgCode}`, 'json');

      if (!fg) {
        return c.json({ error: 'Finished good not found' }, 404);
      }

      return c.json({ success: true, data: fg });
    } catch (error) {
      return c.json({ error: 'Error fetching finished good' }, 500);
    }
  });

  /**
   * Get Parameter by ID
   * GET /api/master-data/parameter/:parameterId
   */
  app.get('/api/master-data/parameter/:parameterId', async (c) => {
    try {
      const { parameterId } = c.req.param();
      const env = c.env as any;

      const param = await env.MASTER_DATA.get(
        `parameter:${parameterId}`,
        'json'
      );

      if (!param) {
        return c.json({ error: 'Parameter not found' }, 404);
      }

      return c.json({ success: true, data: param });
    } catch (error) {
      return c.json({ error: 'Error fetching parameter' }, 500);
    }
  });

  /**
   * Get All Processes
   * GET /api/master-data/processes
   */
  app.get('/api/master-data/processes', async (c) => {
    try {
      const env = c.env as any;

      const results = await env.DB.prepare(`
        SELECT * FROM process_master ORDER BY process_id
      `).all();

      return c.json({ success: true, data: results.results });
    } catch (error) {
      return c.json({ error: 'Error fetching processes' }, 500);
    }
  });

  /**
   * Get All CCPs for a Process
   * GET /api/master-data/process/:processId/ccps
   */
  app.get('/api/master-data/process/:processId/ccps', async (c) => {
    try {
      const { processId } = c.req.param();
      const env = c.env as any;

      const results = await env.DB.prepare(`
        SELECT * FROM ccp_master WHERE process_id = ?
      `).bind(processId).all();

      return c.json({ success: true, data: results.results });
    } catch (error) {
      return c.json({ error: 'Error fetching CCPs' }, 500);
    }
  });

  /**
   * Sync Master Data with Google Sheets
   * POST /api/master-data/sync-sheets
   */
  app.post('/api/master-data/sync-sheets', async (c) => {
    try {
      const env = c.env as any;
      const google = new GoogleWorkspaceIntegration({
        GOOGLE_SERVICE_ACCOUNT_KEY: env.GOOGLE_SERVICE_ACCOUNT_KEY,
        GOOGLE_SHEET_ID: env.GOOGLE_SHEET_ID,
        GOOGLE_DRIVE_FOLDER_ID: 'YOUR_FOLDER_ID',
      });

      await google.syncMasterDataFromSheets(
        env.GOOGLE_SHEET_ID,
        env.MASTER_DATA
      );

      return c.json({
        success: true,
        message: 'Master data synced with Google Sheets',
      });
    } catch (error) {
      return c.json({ error: 'Sync failed' }, 500);
    }
  });
}

export default createMasterDataRoutes;
