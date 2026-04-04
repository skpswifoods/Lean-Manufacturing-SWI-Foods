# 1. Upload Master Data from Excel
curl -X POST https://api.yourdomain.com/api/master-data/upload \
  -F "file=@/path/to/smart_qa_factory_full_database_schema.xlsx"

# Response:
{
  "success": true,
  "message": "Master data initialized successfully",
  "timestamp": "2025-04-04T10:30:00Z"
}

# 2. Get Supplier Details
curl https://api.yourdomain.com/api/master-data/supplier/SP0001

# 3. Get Material Details
curl https://api.yourdomain.com/api/master-data/material/RM0001

# 4. Get Process Details
curl https://api.yourdomain.com/api/master-data/process/PC0010

# 5. Get CCPs for Process
curl https://api.yourdomain.com/api/master-data/process/PC0010/ccps

# 6. Get Finished Good
curl https://api.yourdomain.com/api/master-data/finished-good/FG-ม002

# 7. Get Parameter Specification
curl https://api.yourdomain.com/api/master-data/parameter/PR0003

# 8. Sync with Google Sheets
curl -X POST https://api.yourdomain.com/api/master-data/sync-sheets \
  -H "Authorization: Bearer YOUR_TOKEN"
