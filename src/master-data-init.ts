// src/master-data-init.ts

import * as XLSX from 'xlsx';

interface MasterDataEnv {
  MASTER_DATA: KVNamespace;
  DB: D1Database;
}

/**
 * Master Data Structure ที่สอดคล้องกับไฟล์ Excel
 */

interface SupplierMaster {
  supplier_id: string;
  supplier_name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  ghp_certification?: string;
  last_audit_date?: string;
}

interface MaterialMaster {
  material_code: string;
  material_name: string;
  unit: string;
  risk_level: 'Low' | 'Medium' | 'High';
  supplier_id: string;
}

interface IngredientMaster {
  material_code: string;
  material_name: string;
  storage_temp: string;
  risk_level: string;
}

interface PackagingMaster {
  material_code: string;
  material_name: string;
  unit: string;
  risk_level: string;
}

interface ChemicalMaster {
  material_code: string;
  material_name: string;
  unit: string;
  risk_level: string;
}

interface FinishedGoodsMaster {
  fg_code: string;
  fg_name: string;
  product_type: string;
  storage_temp: string;
  shelf_life_days: number;
  min_weight: number;
  max_weight: number;
}

interface ProcessMaster {
  process_id: string;
  process_name: string;
  details: string;
  work_area: string;
}

interface ParameterMaster {
  parameter_id: string;
  parameter_name: string;
  category: string;
  specification: string;
  unit: string;
}

interface EquipmentMaster {
  equipment_id: string;
  equipment_name: string;
  equipment_type: string;
  usage_description: string;
}

interface CCPMaster {
  ccp_id: string;
  process_id: string;
  ccp_name: string;
  critical_limit: string;
}

interface MachineMaster {
  machine_id: string;
  machine_name: string;
  process_id: string;
  machine_type: string;
}

/**
 * Master Data Initialization Class
 */
export class MasterDataInitializer {
  constructor(private env: MasterDataEnv) {}

  /**
   * Initialize Master Data จาก Excel File
   */
  async initializeFromExcelFile(excelBuffer: ArrayBuffer) {
    try {
      const workbook = XLSX.read(excelBuffer, { type: 'array' });

      // Initialize all sheets
      await this.initializeSuppliers(workbook);
      await this.initializeMaterials(workbook);
      await this.initializeIngredients(workbook);
      await this.initializePackaging(workbook);
      await this.initializeChemicals(workbook);
      await this.initializeFinishedGoods(workbook);
      await this.initializeProcess(workbook);
      await this.initializeParameters(workbook);
      await this.initializeEquipment(workbook);
      await this.initializeCCP(workbook);
      await this.initializeMachines(workbook);

      return {
        success: true,
        message: 'Master data initialized successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error initializing master data:', error);
      throw error;
    }
  }

  /**
   * Initialize Supplier Master Data
   */
  private async initializeSuppliers(workbook: XLSX.WorkBook) {
    const worksheet = workbook.Sheets['supplier_master'];
    const jsonData = XLSX.utils.sheet_to_json<SupplierMaster>(worksheet);

    for (const supplier of jsonData) {
      if (supplier.supplier_id) {
        const key = `supplier:${supplier.supplier_id}`;
        await this.env.MASTER_DATA.put(key, JSON.stringify(supplier));

        // Also insert into database
        await this.env.DB.prepare(`
          INSERT OR REPLACE INTO supplier_master 
          (supplier_id, supplier_name, contact_person, phone, email, address, ghp_certification, last_audit_date)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          supplier.supplier_id,
          supplier.supplier_name || '',
          supplier.contact_person || null,
          supplier.phone || null,
          supplier.email || null,
          supplier.address || null,
          supplier.ghp_certification || null,
          supplier.last_audit_date || null
        ).run();
      }
    }

    console.log(`Initialized ${jsonData.length} suppliers`);
  }

  /**
   * Initialize Material Master Data
   */
  private async initializeMaterials(workbook: XLSX.WorkBook) {
    const worksheet = workbook.Sheets['material_master'];
    const jsonData = XLSX.utils.sheet_to_json<MaterialMaster>(worksheet);

    for (const material of jsonData) {
      if (material.material_code) {
        const key = `material:${material.material_code}`;
        await this.env.MASTER_DATA.put(key, JSON.stringify(material));

        // Insert into database
        await this.env.DB.prepare(`
          INSERT OR REPLACE INTO material_master 
          (material_code, material_name, unit, risk_level, supplier_id)
          VALUES (?, ?, ?, ?, ?)
        `).bind(
          material.material_code,
          material.material_name || '',
          material.unit || '',
          material.risk_level || 'Medium',
          material.supplier_id || null
        ).run();
      }
    }

    console.log(`Initialized ${jsonData.length} materials`);
  }

  /**
   * Initialize Ingredient Master Data
   */
  private async initializeIngredients(workbook: XLSX.WorkBook) {
    const worksheet = workbook.Sheets['ingredient_master'];
    const jsonData = XLSX.utils.sheet_to_json<IngredientMaster>(worksheet);

    for (const ingredient of jsonData) {
      if (ingredient.material_code) {
        const key = `ingredient:${ingredient.material_code}`;
        await this.env.MASTER_DATA.put(key, JSON.stringify(ingredient));

        // Insert into database
        await this.env.DB.prepare(`
          INSERT OR REPLACE INTO ingredient_master 
          (material_code, material_name, storage_temp, risk_level)
          VALUES (?, ?, ?, ?)
        `).bind(
          ingredient.material_code,
          ingredient.material_name || '',
          ingredient.storage_temp || '',
          ingredient.risk_level || 'Medium'
        ).run();
      }
    }

    console.log(`Initialized ${jsonData.length} ingredients`);
  }

  /**
   * Initialize Packaging Master Data
   */
  private async initializePackaging(workbook: XLSX.WorkBook) {
    const worksheet = workbook.Sheets['packaging_master'];
    const jsonData = XLSX.utils.sheet_to_json<PackagingMaster>(worksheet);

    for (const packaging of jsonData) {
      if (packaging.material_code) {
        const key = `packaging:${packaging.material_code}`;
        await this.env.MASTER_DATA.put(key, JSON.stringify(packaging));

        // Insert into database
        await this.env.DB.prepare(`
          INSERT OR REPLACE INTO packaging_master 
          (material_code, material_name, unit, risk_level)
          VALUES (?, ?, ?, ?)
        `).bind(
          packaging.material_code,
          packaging.material_name || '',
          packaging.unit || '',
          packaging.risk_level || 'Low'
        ).run();
      }
    }

    console.log(`Initialized ${jsonData.length} packaging items`);
  }

  /**
   * Initialize Chemical Master Data
   */
  private async initializeChemicals(workbook: XLSX.WorkBook) {
    const worksheet = workbook.Sheets['chemical_master'];
    const jsonData = XLSX.utils.sheet_to_json<ChemicalMaster>(worksheet);

    for (const chemical of jsonData) {
      if (chemical.material_code) {
        const key = `chemical:${chemical.material_code}`;
        await this.env.MASTER_DATA.put(key, JSON.stringify(chemical));

        // Insert into database
        await this.env.DB.prepare(`
          INSERT OR REPLACE INTO chemical_master 
          (material_code, material_name, unit, risk_level)
          VALUES (?, ?, ?, ?)
        `).bind(
          chemical.material_code,
          chemical.material_name || '',
          chemical.unit || '',
          chemical.risk_level || 'Medium'
        ).run();
      }
    }

    console.log(`Initialized ${jsonData.length} chemicals`);
  }

  /**
   * Initialize Finished Goods Master Data
   */
  private async initializeFinishedGoods(workbook: XLSX.WorkBook) {
    const worksheet = workbook.Sheets['finished_goods_master'];
    const jsonData = XLSX.utils.sheet_to_json<FinishedGoodsMaster>(worksheet);

    for (const fg of jsonData) {
      if (fg.fg_code) {
        const key = `finished_good:${fg.fg_code}`;
        await this.env.MASTER_DATA.put(key, JSON.stringify(fg));

        // Insert into database
        await this.env.DB.prepare(`
          INSERT OR REPLACE INTO finished_goods_master 
          (fg_code, fg_name, product_type, storage_temp, shelf_life_days, min_weight, max_weight)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
          fg.fg_code,
          fg.fg_name || '',
          fg.product_type || '',
          fg.storage_temp || '',
          fg.shelf_life_days || null,
          fg.min_weight || null,
          fg.max_weight || null
        ).run();
      }
    }

    console.log(`Initialized ${jsonData.length} finished goods`);
  }

  /**
   * Initialize Process Master Data
   */
  private async initializeProcess(workbook: XLSX.WorkBook) {
    const worksheet = workbook.Sheets['process_master'];
    const jsonData = XLSX.utils.sheet_to_json<ProcessMaster>(worksheet);

    for (const process of jsonData) {
      if (process.process_id) {
        const key = `process:${process.process_id}`;
        await this.env.MASTER_DATA.put(key, JSON.stringify(process));

        // Insert into database
        await this.env.DB.prepare(`
          INSERT OR REPLACE INTO process_master 
          (process_id, process_name, details, work_area)
          VALUES (?, ?, ?, ?)
        `).bind(
          process.process_id,
          process.process_name || '',
          process.details || '',
          process.work_area || ''
        ).run();
      }
    }

    console.log(`Initialized ${jsonData.length} processes`);
  }

  /**
   * Initialize Parameter Master Data
   */
  private async initializeParameters(workbook: XLSX.WorkBook) {
    const worksheet = workbook.Sheets['parameter_master'];
    const jsonData = XLSX.utils.sheet_to_json<ParameterMaster>(worksheet);

    for (const param of jsonData) {
      if (param.parameter_id) {
        const key = `parameter:${param.parameter_id}`;
        await this.env.MASTER_DATA.put(key, JSON.stringify(param));

        // Insert into database
        await this.env.DB.prepare(`
          INSERT OR REPLACE INTO parameter_master 
          (parameter_id, parameter_name, category, specification, unit)
          VALUES (?, ?, ?, ?, ?)
        `).bind(
          param.parameter_id,
          param.parameter_name || '',
          param.category || '',
          param.specification || '',
          param.unit || ''
        ).run();
      }
    }

    console.log(`Initialized ${jsonData.length} parameters`);
  }

  /**
   * Initialize Equipment Master Data
   */
  private async initializeEquipment(workbook: XLSX.WorkBook) {
    const worksheet = workbook.Sheets['Equipment_master'];
    const jsonData = XLSX.utils.sheet_to_json<EquipmentMaster>(worksheet);

    for (const equipment of jsonData) {
      if (equipment.equipment_id) {
        const key = `equipment:${equipment.equipment_id}`;
        await this.env.MASTER_DATA.put(key, JSON.stringify(equipment));

        // Insert into database
        await this.env.DB.prepare(`
          INSERT OR REPLACE INTO equipment_master 
          (equipment_id, equipment_name, equipment_type, usage_description)
          VALUES (?, ?, ?, ?)
        `).bind(
          equipment.equipment_id,
          equipment.equipment_name || '',
          equipment.equipment_type || '',
          equipment.usage_description || ''
        ).run();
      }
    }

    console.log(`Initialized ${jsonData.length} equipment`);
  }

  /**
   * Initialize CCP (Critical Control Points) Master Data
   */
  private async initializeCCP(workbook: XLSX.WorkBook) {
    const worksheet = workbook.Sheets['ccp_master'];
    const jsonData = XLSX.utils.sheet_to_json<CCPMaster>(worksheet);

    for (const ccp of jsonData) {
      if (ccp.ccp_id) {
        const key = `ccp:${ccp.ccp_id}`;
        await this.env.MASTER_DATA.put(key, JSON.stringify(ccp));

        // Insert into database
        await this.env.DB.prepare(`
          INSERT OR REPLACE INTO ccp_master 
          (ccp_id, process_id, ccp_name, critical_limit)
          VALUES (?, ?, ?, ?)
        `).bind(
          ccp.ccp_id,
          ccp.process_id || '',
          ccp.ccp_name || '',
          ccp.critical_limit || ''
        ).run();
      }
    }

    console.log(`Initialized ${jsonData.length} CCPs`);
  }

  /**
   * Initialize Machine Master Data
   */
  private async initializeMachines(workbook: XLSX.WorkBook) {
    const worksheet = workbook.Sheets['machine_master'];
    const jsonData = XLSX.utils.sheet_to_json<MachineMaster>(worksheet);

    for (const machine of jsonData) {
      if (machine.machine_id) {
        const key = `machine:${machine.machine_id}`;
        await this.env.MASTER_DATA.put(key, JSON.stringify(machine));

        // Insert into database
        await this.env.DB.prepare(`
          INSERT OR REPLACE INTO machine_master 
          (machine_id, machine_name, process_id, machine_type)
          VALUES (?, ?, ?, ?)
        `).bind(
          machine.machine_id,
          machine.machine_name || '',
          machine.process_id || '',
          machine.machine_type || ''
        ).run();
      }
    }

    console.log(`Initialized ${jsonData.length} machines`);
  }
}

/**
 * API Endpoint Handler for Master Data Upload
 */
export async function handleMasterDataUpload(
  request: Request,
  env: any
): Promise<Response> {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return new Response(
        JSON.stringify({ error: 'No file provided' }),
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.name.endsWith('.xlsx')) {
      return new Response(
        JSON.stringify({ error: 'Only Excel files (.xlsx) are supported' }),
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    const initializer = new MasterDataInitializer(env);

    const result = await initializer.initializeFromExcelFile(buffer);

    return new Response(JSON.stringify(result), { status: 200 });
  } catch (error) {
    console.error('Error handling master data upload:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to upload master data',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500 }
    );
  }
}
