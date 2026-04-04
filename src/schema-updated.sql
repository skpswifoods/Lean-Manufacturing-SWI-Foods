-- src/schema-updated.sql

-- Supplier Master
CREATE TABLE IF NOT EXISTS supplier_master (
  supplier_id TEXT PRIMARY KEY,
  supplier_name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  ghp_certification TEXT,
  last_audit_date TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Material Master (Raw Materials)
CREATE TABLE IF NOT EXISTS material_master (
  material_code TEXT PRIMARY KEY,
  material_name TEXT NOT NULL,
  unit TEXT,
  risk_level TEXT CHECK(risk_level IN ('Low', 'Medium', 'High')),
  supplier_id TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(supplier_id) REFERENCES supplier_master(supplier_id)
);

-- Ingredient Master
CREATE TABLE IF NOT EXISTS ingredient_master (
  material_code TEXT PRIMARY KEY,
  material_name TEXT NOT NULL,
  storage_temp TEXT,
  risk_level TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Packaging Master
CREATE TABLE IF NOT EXISTS packaging_master (
  material_code TEXT PRIMARY KEY,
  material_name TEXT NOT NULL,
  unit TEXT,
  risk_level TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Chemical Master (Cleaning & Sanitation)
CREATE TABLE IF NOT EXISTS chemical_master (
  material_code TEXT PRIMARY KEY,
  material_name TEXT NOT NULL,
  unit TEXT,
  risk_level TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Finished Goods Master
CREATE TABLE IF NOT EXISTS finished_goods_master (
  fg_code TEXT PRIMARY KEY,
  fg_name TEXT NOT NULL,
  product_type TEXT,
  storage_temp TEXT,
  shelf_life_days INTEGER,
  min_weight REAL,
  max_weight REAL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Process Master
CREATE TABLE IF NOT EXISTS process_master (
  process_id TEXT PRIMARY KEY,
  process_name TEXT NOT NULL,
  details TEXT,
  work_area TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Parameter Master (Monitoring Parameters)
CREATE TABLE IF NOT EXISTS parameter_master (
  parameter_id TEXT PRIMARY KEY,
  parameter_name TEXT NOT NULL,
  category TEXT,
  specification TEXT,
  unit TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Equipment Master
CREATE TABLE IF NOT EXISTS equipment_master (
  equipment_id TEXT PRIMARY KEY,
  equipment_name TEXT NOT NULL,
  equipment_type TEXT,
  usage_description TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- CCP (Critical Control Points) Master
CREATE TABLE IF NOT EXISTS ccp_master (
  ccp_id TEXT PRIMARY KEY,
  process_id TEXT NOT NULL,
  ccp_name TEXT NOT NULL,
  critical_limit TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(process_id) REFERENCES process_master(process_id)
);

-- Machine Master
CREATE TABLE IF NOT EXISTS machine_master (
  machine_id TEXT PRIMARY KEY,
  machine_name TEXT NOT NULL,
  process_id TEXT NOT NULL,
  machine_type TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(process_id) REFERENCES process_master(process_id)
);

-- Process Parameter Mapping
CREATE TABLE IF NOT EXISTS process_parameter_map (
  id TEXT PRIMARY KEY,
  process_id TEXT NOT NULL,
  parameter_id TEXT NOT NULL,
  equipment_id TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(process_id) REFERENCES process_master(process_id),
  FOREIGN KEY(parameter_id) REFERENCES parameter_master(parameter_id),
  FOREIGN KEY(equipment_id) REFERENCES equipment_master(equipment_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_material_supplier ON material_master(supplier_id);
CREATE INDEX IF NOT EXISTS idx_ccp_process ON ccp_master(process_id);
CREATE INDEX IF NOT EXISTS idx_machine_process ON machine_master(process_id);
CREATE INDEX IF NOT EXISTS idx_fg_type ON finished_goods_master(product_type);
