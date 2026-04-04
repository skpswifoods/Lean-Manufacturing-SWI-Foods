# 1. Sync Master Data from Google Sheets
curl -X POST https://api.yourdomain.com/api/sync/master-data \
  -H "Authorization: Bearer YOUR_TOKEN"

# 2. Record Inspection and Sync to Google Sheets
curl -X POST https://api.yourdomain.com/api/inspection/record-and-sync \
  -H "Content-Type: application/json" \
  -d '{
    "batch_id": "batch-001",
    "lot_number": "LOT-2025-001",
    "inspection_type": "GHP_Receiving",
    "result": "PASS",
    "inspector": "john.doe@company.com",
    "notes": "All checkpoints passed"
  }'

# 3. Send Deviation Alert to Slack
curl -X POST https://api.yourdomain.com/api/notify/deviation \
  -H "Content-Type: application/json" \
  -d '{
    "deviation_id": "dev-001",
    "type": "HACCP_Deviation",
    "severity": "critical",
    "description": "Temperature exceeded critical limit",
    "batch_id": "batch-001",
    "assigned_to": "qa-supervisor@company.com",
    "platform": "slack"
  }'

# 4. Create Daily QA Report
curl -X POST https://api.yourdomain.com/api/reports/daily-qa \
  -H "Authorization: Bearer YOUR_TOKEN"

# 5. Upload QA Document to Google Drive
curl -X POST https://api.yourdomain.com/api/documents/upload \
  -F "file=@/path/to/document.pdf" \
  -F "docType=QP" \
  -F "fileName=Quality_Procedure_v2.pdf"

# 6. Create GHP Inspection Form
curl -X POST https://api.yourdomain.com/api/forms/create-ghp-form \
  -H "Content-Type: application/json" \
  -d '{
    "form_title": "Daily GHP Receiving Inspection - April 2025",
    "checkpoints": [
      "Container Cleanliness",
      "Label Integrity",
      "Expiry Date Verification",
      "Temperature Maintenance",
      "Pest Evidence Check"
    ]
  }'

# 7. Notify CAPA Assignment via Teams
curl -X POST https://api.yourdomain.com/api/notify/capa \
  -H "Content-Type: application/json" \
  -d '{
    "capa_id": "capa-001",
    "deviation_type": "HACCP_Deviation",
    "assigned_to": "qa-supervisor@company.com",
    "deadline": "2025-04-11",
    "platform": "teams"
  }'
