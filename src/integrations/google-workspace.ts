// src/integrations/google-workspace.ts

import { GoogleAuth } from 'google-auth-library';
import { google } from 'googleapis';

interface GoogleWorkspaceEnv {
  GOOGLE_SERVICE_ACCOUNT_KEY: string;
  GOOGLE_SHEET_ID: string;
  GOOGLE_DRIVE_FOLDER_ID: string;
}

class GoogleWorkspaceIntegration {
  private auth: GoogleAuth;
  private sheets: any;
  private drive: any;
  private gmail: any;

  constructor(private env: GoogleWorkspaceEnv) {
    const serviceAccount = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_KEY);
    
    this.auth = new GoogleAuth({
      credentials: serviceAccount,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/chat',
      ],
    });

    this.sheets = google.sheets({ version: 'v4', auth: this.auth });
    this.drive = google.drive({ version: 'v3', auth: this.auth });
    this.gmail = google.gmail({ version: 'v1', auth: this.auth });
  }

  // ==================== GOOGLE SHEETS INTEGRATION ====================

  /**
   * Sync Master Data from Google Sheets to KV
   * Sheets structure:
   * - Sheet1: Products (ID, Name, Specs, HACCP Points)
   * - Sheet2: Materials (ID, Name, Suppliers, Tests Required)
   * - Sheet3: Suppliers (ID, Name, Category, GHPs Status)
   */
  async syncMasterDataFromSheets(sheetId: string, kv: KVNamespace) {
    try {
      const response = await this.sheets.spreadsheets.values.batchGet({
        spreadsheetId: sheetId,
        ranges: [
          'Products!A:Z',
          'Materials!A:Z',
          'Suppliers!A:Z',
          'HACCP_CCPs!A:Z',
        ],
      });

      for (const valueRange of response.data.valueRanges || []) {
        const sheetName = valueRange.range?.split('!')[0];
        const values = valueRange.values || [];

        if (values.length < 2) continue; // Skip header

        const headers = values[0];
        const dataRows = values.slice(1);

        switch (sheetName) {
          case 'Products':
            await this.syncProducts(dataRows, headers, kv);
            break;
          case 'Materials':
            await this.syncMaterials(dataRows, headers, kv);
            break;
          case 'Suppliers':
            await this.syncSuppliers(dataRows, headers, kv);
            break;
          case 'HACCP_CCPs':
            await this.syncHACCPPoints(dataRows, headers, kv);
            break;
        }
      }

      return { success: true, message: 'Master data synced successfully' };
    } catch (error) {
      console.error('Error syncing master data:', error);
      throw error;
    }
  }

  private async syncProducts(
    rows: any[][],
    headers: string[],
    kv: KVNamespace
  ) {
    for (const row of rows) {
      const product = {
        id: row[0],
        name: row[1],
        category: row[2],
        physical_specs: {
          weight: { min: parseFloat(row[3]), max: parseFloat(row[4]), unit: 'g' },
          moisture: { min: parseFloat(row[5]), max: parseFloat(row[6]), unit: '%' },
        },
        haccp_points: row[7] ? JSON.parse(row[7]) : [],
      };
      await kv.put(`product:${product.id}`, JSON.stringify(product));
    }
  }

  private async syncMaterials(
    rows: any[][],
    headers: string[],
    kv: KVNamespace
  ) {
    for (const row of rows) {
      const material = {
        id: row[0],
        name: row[1],
        supplier_ids: row[2]?.split(',').map((s: string) => s.trim()) || [],
        tests_required: row[3] ? JSON.parse(row[3]) : [],
        ghp_requirements: row[4]?.split(',').map((s: string) => s.trim()) || [],
      };
      await kv.put(`material:${material.id}`, JSON.stringify(material));
    }
  }

  private async syncSuppliers(
    rows: any[][],
    headers: string[],
    kv: KVNamespace
  ) {
    for (const row of rows) {
      const supplier = {
        id: row[0],
        name: row[1],
        contact: row[2],
        ghp_audit_date: row[3],
        ghp_status: row[4],
        compliance_level: row[5],
      };
      await kv.put(`supplier:${supplier.id}`, JSON.stringify(supplier));
    }
  }

  private async syncHACCPPoints(
    rows: any[][],
    headers: string[],
    kv: KVNamespace
  ) {
    for (const row of rows) {
      const ccp = {
        id: row[0],
        process_step: row[1],
        hazard: row[2],
        parameter: row[3],
        critical_limit_min: parseFloat(row[4]),
        critical_limit_max: parseFloat(row[5]),
        monitoring_frequency: row[6],
        corrective_action: row[7],
      };
      await kv.put(`haccp:${ccp.id}`, JSON.stringify(ccp));
    }
  }

  /**
   * Write QA Records to Google Sheets
   * Real-time sync of inspection results
   */
  async appendInspectionResult(
    sheetId: string,
    record: {
      date: string;
      type: string;
      status: string;
      batch_id: string;
      lot_number: string;
      result: string;
      inspector: string;
    }
  ) {
    try {
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: 'Inspection_Records!A:H',
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [
            [
              record.date,
              record.type,
              record.status,
              record.batch_id,
              record.lot_number,
              record.result,
              record.inspector,
              `=IF(F${row}="PASS","✓","✗")`, // Formula for visual status
            ],
          ],
        },
      });

      return { success: true };
    } catch (error) {
      console.error('Error appending inspection record:', error);
      throw error;
    }
  }

  /**
   * Generate Report from Database to Google Sheets
   */
  async generateDailyQAReport(
    sheetId: string,
    reportData: {
      date: string;
      total_inspections: number;
      passed: number;
      failed: number;
      deviations: number;
      capas: number;
    }
  ) {
    try {
      // Create new sheet for report
      const sheetName = `QA_Report_${reportData.date.replace(/-/g, '')}`;

      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        resource: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: sheetName,
                },
              },
            },
          ],
        },
      });

      // Append report data
      const reportRange = `${sheetName}!A1`;
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: reportRange,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [
            ['Daily QA Report'],
            ['Date', reportData.date],
            [''],
            ['Metric', 'Count', 'Status'],
            ['Total Inspections', reportData.total_inspections],
            ['Passed', reportData.passed, `=B5/B4`],
            ['Failed', reportData.failed, `=B6/B4`],
            ['Open Deviations', reportData.deviations],
            ['In Progress CAPA', reportData.capas],
            [''],
            ['Pass Rate %', `=B5/B4*100`, '%'],
            ['Failure Rate %', `=B6/B4*100`, '%'],
          ],
        },
      });

      return { success: true, sheet: sheetName };
    } catch (error) {
      console.error('Error generating report:', error);
      throw error;
    }
  }

  // ==================== GOOGLE DRIVE INTEGRATION ====================

  /**
   * Upload Quality Documents (QP, WI, FM, SD)
   */
  async uploadQADocument(
    fileName: string,
    fileContent: Buffer,
    mimeType: string = 'application/pdf',
    folderId: string = this.env.GOOGLE_DRIVE_FOLDER_ID
  ) {
    try {
      const fileMetadata = {
        name: fileName,
        parents: [folderId],
        properties: {
          category: 'QA_Documents',
          timestamp: new Date().toISOString(),
        },
      };

      const media = {
        mimeType: mimeType,
        body: fileContent,
      };

      const response = await this.drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id, webViewLink, createdTime',
      });

      return {
        success: true,
        fileId: response.data.id,
        link: response.data.webViewLink,
      };
    } catch (error) {
      console.error('Error uploading document:', error);
      throw error;
    }
  }

  /**
   * Create Shared Folder Structure for QA Documents
   */
  async createQADocumentStructure(parentFolderId: string) {
    try {
      const folders = [
        'Quality_Procedures_QP',
        'Work_Instructions_WI',
        'Forms_FM',
        'Specifications_SD',
        'Inspection_Records',
        'CAPA_Documents',
        'Audit_Reports',
        'Training_Materials',
      ];

      const folderIds: Record<string, string> = {};

      for (const folderName of folders) {
        const fileMetadata = {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentFolderId],
        };

        const response = await this.drive.files.create({
          resource: fileMetadata,
          fields: 'id',
        });

        folderIds[folderName] = response.data.id;
      }

      // Set sharing permissions
      for (const [folderName, folderId] of Object.entries(folderIds)) {
        await this.drive.permissions.create({
          fileId: folderId,
          resource: {
            role: 'editor',
            type: 'group',
            emailAddress: 'qa-team@company.com',
          },
        });
      }

      return { success: true, folders: folderIds };
    } catch (error) {
      console.error('Error creating document structure:', error);
      throw error;
    }
  }

  // ==================== GOOGLE FORMS INTEGRATION ====================

  /**
   * Create Inspection Form (GHP Checklist)
   */
  async createGHPChecklistForm(title: string, checkpoints: string[]) {
    try {
      const form = await google.forms({ version: 'v1', auth: this.auth })
        .projects.create({
          resource: {
            info: {
              title: title,
              documentTitle: `${title} - ${new Date().toLocaleDateString()}`,
            },
          },
        });

      const formId = form.data.formId;

      // Add questions
      const requests = [
        {
          createItem: {
            item: {
              title: 'Inspection Date',
              questionItem: {
                question: {
                  required: true,
                  dateQuestion: {},
                },
              },
            },
            location: { index: 0 },
          },
        },
        {
          createItem: {
            item: {
              title: 'Inspector Name',
              questionItem: {
                question: {
                  required: true,
                  textQuestion: {
                    paragraph: false,
                  },
                },
              },
            },
            location: { index: 1 },
          },
        },
      ];

      // Add checkpoint questions
      checkpoints.forEach((checkpoint, index) => {
        requests.push({
          createItem: {
            item: {
              title: checkpoint,
              questionItem: {
                question: {
                  required: true,
                  choiceQuestion: {
                    type: 'RADIO',
                    options: [
                      { value: 'PASS' },
                      { value: 'FAIL' },
                      { value: 'N/A' },
                    ],
                  },
                },
              },
            },
            location: { index: index + 2 },
          },
        });
      });

      // Add notes field
      requests.push({
        createItem: {
          item: {
            title: 'Notes / Comments',
            questionItem: {
              question: {
                required: false,
                textQuestion: {
                  paragraph: true,
                },
              },
            },
          },
          location: { index: checkpoints.length + 2 },
        },
      });

      await google.forms({ version: 'v1', auth: this.auth })
        .projects.batchUpdate({
          formId: formId,
          resource: { requests },
        });

      return {
        success: true,
        formId: formId,
        formLink: `https://docs.google.com/forms/d/${formId}/edit`,
      };
    } catch (error) {
      console.error('Error creating form:', error);
      throw error;
    }
  }

  // ==================== GOOGLE CHAT INTEGRATION ====================

  /**
   * Send Alerts to Google Chat
   */
  async sendChatMessage(
    webhookUrl: string,
    message: {
      title: string;
      severity: 'info' | 'warning' | 'critical';
      description: string;
      batch_id?: string;
      lot_id?: string;
      action_required?: string;
    }
  ) {
    try {
      const color = {
        info: '#4285F4',
        warning: '#FBBC04',
        critical: '#EA4335',
      }[message.severity];

      const payload = {
        cards: [
          {
            header: {
              title: message.title,
              subtitle: `Severity: ${message.severity.toUpperCase()}`,
            },
            sections: [
              {
                widgets: [
                  {
                    textParagraph: {
                      text: message.description,
                    },
                  },
                  ...(message.batch_id
                    ? [
                        {
                          keyValue: {
                            topLabel: 'Batch ID',
                            content: message.batch_id,
                          },
                        },
                      ]
                    : []),
                  ...(message.lot_id
                    ? [
                        {
                          keyValue: {
                            topLabel: 'Lot ID',
                            content: message.lot_id,
                          },
                        },
                      ]
                    : []),
                  ...(message.action_required
                    ? [
                        {
                          textParagraph: {
                            text: `<b>Action Required:</b> ${message.action_required}`,
                          },
                        },
                      ]
                    : []),
                ],
              },
            ],
            sections: [
              {
                header: 'Details',
                widgets: [
                  {
                    divider: {},
                  },
                ],
              },
            ],
          },
        ],
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      return { success: response.ok };
    } catch (error) {
      console.error('Error sending chat message:', error);
      throw error;
    }
  }

  /**
   * Send Notification to Google Chat Space
   */
  async notifyCAPA(
    spaceId: string,
    capaData: {
      capa_id: string;
      deviation_type: string;
      assigned_to: string;
      deadline: string;
    }
  ) {
    try {
      const chatService = google.chat({ version: 'v1', auth: this.auth });

      const message = {
        text: `🔔 New CAPA Assignment\n\n` +
              `CAPA ID: ${capaData.capa_id}\n` +
              `Deviation Type: ${capaData.deviation_type}\n` +
              `Assigned To: ${capaData.assigned_to}\n` +
              `Deadline: ${capaData.deadline}`,
      };

      await chatService.spaces.messages.create({
        parent: spaceId,
        resource: message,
      });

      return { success: true };
    } catch (error) {
      console.error('Error notifying CAPA:', error);
      throw error;
    }
  }
}

export default GoogleWorkspaceIntegration;
