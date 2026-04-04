// src/integrations/hub-connection.ts

interface HubConnectionConfig {
  type: 'slack' | 'teams' | 'google_chat';
  webhook_url?: string;
  channel_id?: string;
  api_token?: string;
}

class HubConnectionManager {
  constructor(private config: HubConnectionConfig) {}

  // ==================== SLACK INTEGRATION ====================

  async sendSlackAlert(payload: {
    channel: string;
    title: string;
    severity: 'info' | 'warning' | 'critical';
    message: string;
    batch_id?: string;
    lot_id?: string;
    actions?: Array<{ text: string; url: string }>;
  }) {
    if (this.config.type !== 'slack') throw new Error('Not configured for Slack');

    const severityColor = {
      info: '#36a64f',
      warning: '#ffaa00',
      critical: '#ff0000',
    };

    const attachments = [
      {
        color: severityColor[payload.severity],
        title: payload.title,
        text: payload.message,
        fields: [
          ...(payload.batch_id
            ? [
                {
                  title: 'Batch ID',
                  value: payload.batch_id,
                  short: true,
                },
              ]
            : []),
          ...(payload.lot_id
            ? [
                {
                  title: 'Lot ID',
                  value: payload.lot_id,
                  short: true,
                },
              ]
            : []),
        ],
        footer: 'QA Factory System',
        ts: Math.floor(Date.now() / 1000),
      },
    ];

    try {
      const response = await fetch(this.config.webhook_url || '', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: payload.channel,
          attachments: attachments,
          actions: payload.actions?.map((action) => ({
            type: 'button',
            text: action.text,
            url: action.url,
          })),
        }),
      });

      return { success: response.ok };
    } catch (error) {
      console.error('Error sending Slack alert:', error);
      throw error;
    }
  }

  /**
   * Send Interactive Slack Message for Deviation
   */
  async sendSlackDeviationCard(
    channel: string,
    deviationData: {
      id: string;
      type: string;
      severity: string;
      description: string;
      batch_id: string;
      assigned_to: string;
    }
  ) {
    if (this.config.type !== 'slack') throw new Error('Not configured for Slack');

    const payload = {
      channel: channel,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '⚠️ Quality Deviation Reported',
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Deviation ID:*\n${deviationData.id}`,
            },
            {
              type: 'mrkdwn',
              text: `*Type:*\n${deviationData.type}`,
            },
            {
              type: 'mrkdwn',
              text: `*Severity:*\n${deviationData.severity}`,
            },
            {
              type: 'mrkdwn',
              text: `*Batch:*\n${deviationData.batch_id}`,
            },
          ],
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Description:*\n${deviationData.description}`,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Assigned To:*\n${deviationData.assigned_to}`,
          },
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'View Full Details',
              },
              style: 'primary',
              url: `https://qas.company.com/deviation/${deviationData.id}`,
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Create CAPA',
              },
              style: 'danger',
              url: `https://qas.company.com/capa/new?deviation_id=${deviationData.id}`,
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Acknowledge',
              },
              value: `ack_${deviationData.id}`,
            },
          ],
        },
      ],
    };

    try {
      const response = await fetch(this.config.webhook_url || '', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      return { success: response.ok };
    } catch (error) {
      console.error('Error sending Slack card:', error);
      throw error;
    }
  }

  // ==================== MICROSOFT TEAMS INTEGRATION ====================

  async sendTeamsAlert(payload: {
    title: string;
    severity: 'info' | 'warning' | 'critical';
    message: string;
    batch_id?: string;
    lot_id?: string;
  }) {
    if (this.config.type !== 'teams') throw new Error('Not configured for Teams');

    const themeColor = {
      info: '0078D4',
      warning: 'FFB900',
      critical: 'E81123',
    };

    const adaptiveCard = {
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      type: 'AdaptiveCard',
      version: '1.4',
      body: [
        {
          type: 'Container',
          style: 'emphasis',
          items: [
            {
              type: 'ColumnSet',
              columns: [
                {
                  width: 'stretch',
                  items: [
                    {
                      type: 'TextBlock',
                      text: payload.title,
                      weight: 'bolder',
                      size: 'large',
                      color: themeColor[payload.severity],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: 'Container',
          items: [
            {
              type: 'TextBlock',
              text: payload.message,
              wrap: true,
            },
            ...(payload.batch_id
              ? [
                  {
                    type: 'FactSet',
                    facts: [
                      {
                        name: 'Batch ID:',
                        value: payload.batch_id,
                      },
                    ],
                  },
                ]
              : []),
          ],
        },
        {
          type: 'ActionSet',
          actions: [
            {
              type: 'Action.OpenUrl',
              title: 'View Details',
              url: `https://qas.company.com/dashboard`,
            },
            {
              type: 'Action.OpenUrl',
              title: 'Create CAPA',
              url: `https://qas.company.com/capa/new`,
            },
          ],
        },
      ],
    };

    const payload_obj = {
      @type: 'MessageCard',
      @context: 'https://schema.org/extensions',
      summary: payload.title,
      themeColor: themeColor[payload.severity],
      sections: [
        {
          activityTitle: payload.title,
          activitySubtitle: `Severity: ${payload.severity}`,
          text: payload.message,
          facts: [
            ...(payload.batch_id
              ? [
                  {
                    name: 'Batch ID:',
                    value: payload.batch_id,
                  },
                ]
              : []),
            ...(payload.lot_id
              ? [
                  {
                    name: 'Lot ID:',
                    value: payload.lot_id,
                  },
                ]
              : []),
          ],
          potentialAction: [
            {
              @type: 'OpenUri',
              name: 'View Details',
              targets: [
                {
                  os: 'default',
                  uri: 'https://qas.company.com/dashboard',
                },
              ],
            },
          ],
        },
      ],
    };

    try {
      const response = await fetch(this.config.webhook_url || '', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload_obj),
      });

      return { success: response.ok };
    } catch (error) {
      console.error('Error sending Teams alert:', error);
      throw error;
    }
  }
}

export default HubConnectionManager;
