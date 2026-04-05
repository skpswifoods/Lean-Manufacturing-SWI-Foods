// src/integrations/google-workspace-v2.ts
// Uses fetch + Web Crypto API - compatible with Cloudflare Workers

interface GoogleWorkspaceEnv {
  GOOGLE_SERVICE_ACCOUNT_KEY: string;
  GOOGLE_SHEET_ID: string;
  GOOGLE_DRIVE_FOLDER_ID: string;
}

interface ServiceAccountKey {
  private_key: string;
  client_email: string;
  token_uri: string;
}

class GoogleWorkspaceIntegration {
  private serviceAccount: ServiceAccountKey;
  private cachedToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(private env: GoogleWorkspaceEnv) {
    this.serviceAccount = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_KEY);
  }

  // ==================== AUTH ====================

  private async getAccessToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.tokenExpiry) {
      return this.cachedToken;
    }

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: this.serviceAccount.client_email,
      scope: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/chat',
      ].join(' '),
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    };

    const jwt = await this.createJWT(payload);

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    const data = await res.json() as { access_token: string; expires_in: number };
    this.cachedToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
    return this.cachedToken;
  }

  private async createJWT(payload: object): Promise<string> {
    const encodeB64Url = (input: string | Uint8Array): string => {
      const str = typeof input === 'string' ? input : String.fromCharCode(...input);
      return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    };

    const header = encodeB64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const body = encodeB64Url(JSON.stringify(payload));
    const signingInput = `${header}.${body}`;

    const pemKey = this.serviceAccount.private_key
      .replace(/-----BEGIN PRIVATE KEY-----/g, '')
      .replace(/-----END PRIVATE KEY-----/g, '')
      .replace(/\s/g, '');

    const keyDer = Uint8Array.from(atob(pemKey), (c) => c.charCodeAt(0));

    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8',
      keyDer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      new TextEncoder().encode(signingInput)
    );

    const sigB64 = encodeB64Url(new Uint8Array(signature));
    return `${signingInput}.${sigB64}`;
  }

  private async authHeaders(): Promise<Record<string, string>> {
    return {
      Authorization: `Bearer ${await this.getAccessToken()}`,
      'Content-Type': 'application/json',
    };
  }

  // ==================== GOOGLE SHEETS ====================

  async syncMasterDataFromSheets(sheetId: string, kv: KVNamespace) {
    const headers = await this.authHeaders();
    const ranges = ['Products!A:Z', 'Materials!A:Z', 'Suppliers!A:Z', 'HACCP_CCPs!A:Z'];
    const rangeParam = ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join('&');

    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchGet?${rangeParam}`,
      { headers }
    );
    const data = await res.json() as { valueRanges: Array<{ range: string; values: string[][] }> };

    for (const valueRange of data.valueRanges || []) {
      const sheetName = valueRange.range?.split('!')[0];
      const values = valueRange.values || [];
      if (values.length < 2) continue;

      const headers2 = values[0];
      const dataRows = values.slice(1);

      switch (sheetName) {
        case 'Products':    await this.syncProducts(dataRows, headers2, kv); break;
        case 'Materials':   await this.syncMaterials(dataRows, headers2, kv); break;
        case 'Suppliers':   await this.syncSuppliers(dataRows, headers2, kv); break;
        case 'HACCP_CCPs':  await this.syncHACCPPoints(dataRows, headers2, kv); break;
      }
    }

    return { success: true, message: 'Master data synced successfully' };
  }

  private async syncProducts(rows: string[][], _headers: string[], kv: KVNamespace) {
    for (const row of rows) {
      const product = {
        id: row[0], name: row[1], category: row[2],
        physical_specs: {
          weight: { min: parseFloat(row[3]), max: parseFloat(row[4]), unit: 'g' },
          moisture: { min: parseFloat(row[5]), max: parseFloat(row[6]), unit: '%' },
        },
        haccp_points: row[7] ? JSON.parse(row[7]) : [],
      };
      await kv.put(`product:${product.id}`, JSON.stringify(product));
    }
  }

  private async syncMaterials(rows: string[][], _headers: string[], kv: KVNamespace) {
    for (const row of rows) {
      const material = {
        id: row[0], name: row[1],
        supplier_ids: row[2]?.split(',').map((s) => s.trim()) || [],
        tests_required: row[3] ? JSON.parse(row[3]) : [],
        ghp_requirements: row[4]?.split(',').map((s) => s.trim()) || [],
      };
      await kv.put(`material:${material.id}`, JSON.stringify(material));
    }
  }

  private async syncSuppliers(rows: string[][], _headers: string[], kv: KVNamespace) {
    for (const row of rows) {
      const supplier = {
        id: row[0], name: row[1], contact: row[2],
        ghp_audit_date: row[3], ghp_status: row[4], compliance_level: row[5],
      };
      await kv.put(`supplier:${supplier.id}`, JSON.stringify(supplier));
    }
  }

  private async syncHACCPPoints(rows: string[][], _headers: string[], kv: KVNamespace) {
    for (const row of rows) {
      const ccp = {
        id: row[0], process_step: row[1], hazard: row[2], parameter: row[3],
        critical_limit_min: parseFloat(row[4]), critical_limit_max: parseFloat(row[5]),
        monitoring_frequency: row[6], corrective_action: row[7],
      };
      await kv.put(`haccp:${ccp.id}`, JSON.stringify(ccp));
    }
  }

  async appendInspectionResult(
    sheetId: string,
    record: {
      date: string; type: string; status: string; batch_id: string;
      lot_number: string; result: string; inspector: string;
    }
  ) {
    const headers = await this.authHeaders();
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Inspection_Records!A:H:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          values: [[
            record.date, record.type, record.status, record.batch_id,
            record.lot_number, record.result, record.inspector,
            record.result === 'PASS' ? '\u2713' : '\u2717',
          ]],
        }),
      }
    );
    return { success: true };
  }

  async generateDailyQAReport(
    sheetId: string,
    reportData: {
      date: string; total_inspections: number; passed: number;
      failed: number; deviations: number; capas: number;
    }
  ) {
    const headers = await this.authHeaders();
    const sheetName = `QA_Report_${reportData.date.replace(/-/g, '')}`;

    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: sheetName } } }] }),
    });

    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${sheetName}!A1?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          values: [
            ['Daily QA Report'], ['Date', reportData.date], [''],
            ['Metric', 'Count'],
            ['Total Inspections', reportData.total_inspections],
            ['Passed', reportData.passed],
            ['Failed', reportData.failed],
            ['Open Deviations', reportData.deviations],
            ['In Progress CAPA', reportData.capas],
          ],
        }),
      }
    );

    return { success: true, sheet: sheetName };
  }

  // ==================== GOOGLE DRIVE ====================

  async uploadQADocument(fileName: string, fileContent: ArrayBuffer, mimeType = 'application/pdf') {
    const token = await this.getAccessToken();
    const folderId = this.env.GOOGLE_DRIVE_FOLDER_ID;

    const metadata = JSON.stringify({
      name: fileName,
      parents: [folderId],
      properties: { category: 'QA_Documents', timestamp: new Date().toISOString() },
    });

    const boundary = '-------boundary';
    const bodyStart = `--${boundary}\r\nContent-Type: application/json\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`;
    const bodyEnd = `\r\n--${boundary}--`;

    const startBytes = new TextEncoder().encode(bodyStart);
    const fileBytes = new Uint8Array(fileContent);
    const endBytes = new TextEncoder().encode(bodyEnd);

    const combined = new Uint8Array(startBytes.length + fileBytes.length + endBytes.length);
    combined.set(startBytes, 0);
    combined.set(fileBytes, startBytes.length);
    combined.set(endBytes, startBytes.length + fileBytes.length);

    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: combined,
      }
    );

    const data = await res.json() as { id: string; webViewLink: string };
    return { success: true, fileId: data.id, link: data.webViewLink };
  }

  // ==================== GOOGLE FORMS ====================

  async createGHPChecklistForm(title: string, checkpoints: string[]) {
    const headers = await this.authHeaders();

    const createRes = await fetch('https://forms.googleapis.com/v1/forms', {
      method: 'POST',
      headers,
      body: JSON.stringify({ info: { title, documentTitle: `${title} - ${new Date().toLocaleDateString()}` } }),
    });

    const form = await createRes.json() as { formId: string };
    const formId = form.formId;

    const requests = [
      { createItem: { item: { title: 'Inspection Date', questionItem: { question: { required: true, dateQuestion: {} } } }, location: { index: 0 } } },
      { createItem: { item: { title: 'Inspector Name', questionItem: { question: { required: true, textQuestion: { paragraph: false } } } }, location: { index: 1 } } },
      ...checkpoints.map((checkpoint, index) => ({
        createItem: {
          item: { title: checkpoint, questionItem: { question: { required: true, choiceQuestion: { type: 'RADIO', options: [{ value: 'PASS' }, { value: 'FAIL' }, { value: 'N/A' }] } } } },
          location: { index: index + 2 },
        },
      })),
      { createItem: { item: { title: 'Notes / Comments', questionItem: { question: { required: false, textQuestion: { paragraph: true } } } }, location: { index: checkpoints.length + 2 } } },
    ];

    await fetch(`https://forms.googleapis.com/v1/forms/${formId}:batchUpdate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ requests }),
    });

    return { success: true, formId, formLink: `https://docs.google.com/forms/d/${formId}/edit` };
  }

  // ==================== GOOGLE CHAT ====================

  async sendChatMessage(
    webhookUrl: string,
    message: { title: string; severity: 'info' | 'warning' | 'critical'; description: string; batch_id?: string; lot_id?: string; action_required?: string }
  ) {
    const payload = {
      cards: [{
        header: { title: message.title, subtitle: `Severity: ${message.severity.toUpperCase()}` },
        sections: [{
          widgets: [
            { textParagraph: { text: message.description } },
            ...(message.batch_id ? [{ keyValue: { topLabel: 'Batch ID', content: message.batch_id } }] : []),
            ...(message.lot_id ? [{ keyValue: { topLabel: 'Lot ID', content: message.lot_id } }] : []),
            ...(message.action_required ? [{ textParagraph: { text: `<b>Action Required:</b> ${message.action_required}` } }] : []),
          ],
        }],
      }],
    };

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return { success: res.ok };
  }

  async notifyCAPA(
    spaceId: string,
    capaData: { capa_id: string; deviation_type: string; assigned_to: string; deadline: string }
  ) {
    const headers = await this.authHeaders();
    await fetch(`https://chat.googleapis.com/v1/${spaceId}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        text: `New CAPA Assignment\n\nCAPA ID: ${capaData.capa_id}\nDeviation Type: ${capaData.deviation_type}\nAssigned To: ${capaData.assigned_to}\nDeadline: ${capaData.deadline}`,
      }),
    });
    return { success: true };
  }
}

export default GoogleWorkspaceIntegration;
