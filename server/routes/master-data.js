const express = require('express');
const { requireAuth, requireRole } = require('../middleware.js');

function createMasterDataRouter(db, options = {}) {
  const router = express.Router();
  const auth = options.requireAuth || requireAuth;
  const role = options.requireRole || requireRole;

  // Get master data (Super Admin only)
  router.get('/', auth, async (req, res) => {
    try {
      const divisions = db.prepare('SELECT id, name, code, is_active FROM divisions ORDER BY name').all();
      const principals = db.prepare('SELECT id, name, code, address, division_id, is_active FROM principals ORDER BY name').all();
      const brands = db.prepare('SELECT id, principal_id, name, is_active FROM brands ORDER BY name').all();
      const regions = db.prepare('SELECT id, name, is_active FROM regions ORDER BY name').all();
      const branches = db.prepare('SELECT id, name, code, address, city, region_id, is_active FROM branches ORDER BY name').all();
      
      // Fetch divisions for each branch
      const branchDivisions = db.prepare(`
        SELECT bd.branch_id, d.id, d.name, d.code, bd.is_primary
        FROM branch_divisions bd
        JOIN divisions d ON d.id = bd.division_id
      `).all();
      
      const divisionsByBranch = branchDivisions.reduce((acc, bd) => {
        if (!acc[bd.branch_id]) acc[bd.branch_id] = [];
        acc[bd.branch_id].push({ id: bd.id, name: bd.name, code: bd.code, is_primary: bd.is_primary });
        return acc;
      }, {});

      const branchRegions = db.prepare(`
        SELECT br.branch_id, r.id, r.name, r.is_active
        FROM branch_regions br
        JOIN regions r ON r.id = br.region_id
      `).all();

      const regionsByBranch = branchRegions.reduce((acc, br) => {
        if (!acc[br.branch_id]) acc[br.branch_id] = [];
        acc[br.branch_id].push({ id: br.id, name: br.name, is_active: br.is_active });
        return acc;
      }, {});

      const branchesWithDivisions = branches.map(b => ({
        ...b,
        divisions: divisionsByBranch[b.id] || [],
        regions: regionsByBranch[b.id] || []
      }));

      res.json({
        divisions,
        principals,
        brands,
        regions,
        branches: branchesWithDivisions
      });
    } catch (err) {
      console.error('GET /api/master-data error:', err);
      res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
    }
  });

// Create division (Super Admin only)
router.post('/divisions', auth, role('superadmin'), async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Division name required' } });
    }

    const existing = db.prepare('SELECT id FROM divisions WHERE name = ?').get(name);
    if (existing) {
      return res.status(409).json({ error: { code: 'CONFLICT', message: 'Division name already exists' } });
    }

    const info = db.prepare('INSERT INTO divisions (name) VALUES (?)').run(name);
    res.status(201).json({ message: 'Division created', division: { id: info.lastInsertRowid, name } });
  } catch (err) {
    console.error('POST /api/divisions error:', err);
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
  }
});

// Update division (Super Admin only)
router.patch('/divisions/:id', auth, role('superadmin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, is_active } = req.body;
    
    const division = db.prepare('SELECT id, name, is_active FROM divisions WHERE id = ?').get(id);
    if (!division) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Division not found' } });
    }

    const nextName = name === undefined ? division.name : name;
    const nextActive = is_active === undefined ? division.is_active : (is_active ? 1 : 0);
    if (typeof nextName !== 'string' || !nextName.trim()) {
      return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Division name required' } });
    }
    db.prepare('UPDATE divisions SET name = ?, is_active = ? WHERE id = ?').run(nextName.trim(), nextActive, id);

    res.json({ message: 'Division updated' });
  } catch (err) {
    console.error('PATCH /api/divisions/:id error:', err);
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
  }
});

// Delete division (Super Admin only)
router.delete('/divisions/:id', auth, role('superadmin'), async (req, res) => {
  try {
    const { id } = req.params;
    const division = db.prepare('SELECT id, name, is_active FROM divisions WHERE id = ?').get(id);
    if (!division) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Division not found' } });
    }

    db.prepare('DELETE FROM divisions WHERE id = ?').run(id);
    res.json({ message: 'Division deleted' });
  } catch (err) {
    console.error('DELETE /api/divisions/:id error:', err);
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
  }
});

// Create principal (Super Admin only)
router.post('/principals', auth, role('superadmin'), async (req, res) => {
  try {
    const { name, code, address, division_id } = req.body;
    if (!name) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Principal name required' } });
    }

    const existing = db.prepare('SELECT id FROM principals WHERE name = ?').get(name);
    if (existing) {
      return res.status(409).json({ error: { code: 'CONFLICT', message: 'Principal name already exists' } });
    }

    if (division_id) {
      const division = db.prepare('SELECT id FROM divisions WHERE id = ?').get(division_id);
      if (!division) {
        return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Division not found' } });
      }
    }

    const info = db.prepare('INSERT INTO principals (name, code, address, division_id) VALUES (?, ?, ?, ?)').run(name, code?.trim() || null, address?.trim() || null, division_id || null);
    res.status(201).json({ message: 'Principal created', principal: { id: info.lastInsertRowid, name } });
  } catch (err) {
    console.error('POST /api/principals error:', err);
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
  }
});

// Update principal (Super Admin only)
router.patch('/principals/:id', auth, role('superadmin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, address, division_id, is_active } = req.body;
    
    const principal = db.prepare('SELECT id, name, is_active, division_id FROM principals WHERE id = ?').get(id);
    if (!principal) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Principal not found' } });
    }

    const nextName = name === undefined ? principal.name : name;
    const nextCode = code === undefined ? principal.code : (code?.trim() || null);
    const nextAddress = address === undefined ? principal.address : (address?.trim() || null);
    const nextDivisionId = division_id === undefined ? principal.division_id : (division_id ? Number(division_id) : null);
    const nextActive = is_active === undefined ? principal.is_active : (is_active ? 1 : 0);
    
    if (typeof nextName !== 'string' || !nextName.trim()) {
      return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Principal name required' } });
    }
    const duplicate = db.prepare('SELECT id FROM principals WHERE name = ? AND id != ?').get(nextName.trim(), id);
    if (duplicate) {
      return res.status(409).json({ error: { code: 'CONFLICT', message: 'Principal name already exists' } });
    }

    if (nextDivisionId) {
      const division = db.prepare('SELECT id FROM divisions WHERE id = ?').get(nextDivisionId);
      if (!division) {
        return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Division not found' } });
      }
    }

    db.prepare('UPDATE principals SET name = ?, code = ?, address = ?, division_id = ?, is_active = ? WHERE id = ?').run(nextName.trim(), nextCode, nextAddress, nextDivisionId, nextActive, id);
    res.json({ message: 'Principal updated' });
  } catch (err) {
    console.error('PATCH /api/principals/:id error:', err);
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
  }
});

// Delete principal (Super Admin only)
router.delete('/principals/:id', auth, role('superadmin'), async (req, res) => {
  try {
    const { id } = req.params;
    const principal = db.prepare('SELECT id FROM principals WHERE id = ?').get(id);
    if (!principal) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Principal not found' } });
    }

    db.prepare('DELETE FROM principals WHERE id = ?').run(id);
    res.json({ message: 'Principal deleted' });
  } catch (err) {
    console.error('DELETE /api/principals/:id error:', err);
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
  }
});

// Create brand (Super Admin only)
router.post('/brands', auth, role('superadmin'), async (req, res) => {
  try {
    const { principal_id, name } = req.body;
    if (!principal_id || !name) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Principal ID and brand name required' } });
    }

    // Check if principal exists
    const principalExists = db.prepare('SELECT id FROM principals WHERE id = ?').get(principal_id);
    if (!principalExists) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Principal not found' } });
    }

    // Check if brand name already exists for this principal
    const existing = db.prepare('SELECT id FROM brands WHERE principal_id = ? AND name = ?').get(principal_id, name);
    if (existing) {
      return res.status(409).json({ error: { code: 'CONFLICT', message: 'Brand name already exists for this principal' } });
    }

    const info = db.prepare('INSERT INTO brands (principal_id, name) VALUES (?, ?)').run(principal_id, name);
    res.status(201).json({ message: 'Brand created', brand: { id: info.lastInsertRowid, principal_id, name } });
  } catch (err) {
    console.error('POST /api/brands error:', err);
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
  }
});

// Update brand (Super Admin only)
router.patch('/brands/:id', auth, role('superadmin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { principal_id, name } = req.body;
    
    if (principal_id !== undefined) {
      // Check if principal exists
      const principalExists = db.prepare('SELECT id FROM principals WHERE id = ?').get(principal_id);
      if (!principalExists) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Principal not found' } });
      }
    }

    // Check if brand name already exists for this principal (if principal_id is changing)
    if (principal_id !== undefined && name !== undefined) {
      const existing = db.prepare('SELECT id FROM brands WHERE principal_id = ? AND name = ? AND id != ?').get(principal_id, name, id);
      if (existing) {
        return res.status(409).json({ error: { code: 'CONFLICT', message: 'Brand name already exists for this principal' } });
      }
    }

    const brand = db.prepare('SELECT id, principal_id, name FROM brands WHERE id = ?').get(id);
    if (!brand) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Brand not found' } });
    }
    const nextPrincipalId = principal_id === undefined ? brand.principal_id : principal_id;
    const nextName = name === undefined ? brand.name : name;
    if (typeof nextName !== 'string' || !nextName.trim()) {
      return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Brand name required' } });
    }
    const existing = db.prepare('SELECT id FROM brands WHERE principal_id = ? AND name = ? AND id != ?').get(nextPrincipalId, nextName.trim(), id);
    if (existing) {
      return res.status(409).json({ error: { code: 'CONFLICT', message: 'Brand name already exists for this principal' } });
    }

    db.prepare('UPDATE brands SET principal_id = ?, name = ? WHERE id = ?').run(nextPrincipalId, nextName.trim(), id);
    res.json({ message: 'Brand updated' });
  } catch (err) {
    console.error('PATCH /api/brands/:id error:', err);
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
  }
});

// Delete brand (Super Admin only)
router.delete('/brands/:id', auth, role('superadmin'), async (req, res) => {
  try {
    const { id } = req.params;
    const brand = db.prepare('SELECT id, principal_id FROM brands WHERE id = ?').get(id);
    if (!brand) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Brand not found' } });
    }

    db.prepare('DELETE FROM brands WHERE id = ?').run(id);
    res.json({ message: 'Brand deleted' });
  } catch (err) {
    console.error('DELETE /api/brands/:id error:', err);
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
  }
});

// Regions CRUD
// Create region
router.post('/regions', auth, role('superadmin'), async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Region name required' } });
    }
    const existing = db.prepare('SELECT id FROM regions WHERE name = ?').get(name);
    if (existing) {
      return res.status(409).json({ error: { code: 'CONFLICT', message: 'Region name already exists' } });
    }
    const info = db.prepare('INSERT INTO regions (name) VALUES (?)').run(name);
    res.status(201).json({ message: 'Region created', region: { id: info.lastInsertRowid, name } });
  } catch (err) {
    console.error('POST /api/regions error:', err);
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
  }
});

// Update region
router.patch('/regions/:id', auth, role('superadmin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, active } = req.body;
    const region = db.prepare('SELECT id, name, is_active FROM regions WHERE id = ?').get(id);
    if (!region) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Region not found' } });
    }
    const nextName = name === undefined ? region.name : name;
    const nextActive = active === undefined ? region.is_active : (active ? 1 : 0);
    if (typeof nextName !== 'string' || !nextName.trim()) {
      return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Region name required' } });
    }
    const duplicate = db.prepare('SELECT id FROM regions WHERE name = ? AND id != ?').get(nextName.trim(), id);
    if (duplicate) {
      return res.status(409).json({ error: { code: 'CONFLICT', message: 'Region name already exists' } });
    }
    db.prepare('UPDATE regions SET name = ?, is_active = ? WHERE id = ?').run(nextName.trim(), nextActive, id);
    res.json({ message: 'Region updated' });
  } catch (err) {
    console.error('PATCH /api/regions/:id error:', err);
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
  }
});

// Delete region
router.delete('/regions/:id', auth, role('superadmin'), async (req, res) => {
  try {
    const { id } = req.params;
    const region = db.prepare('SELECT id FROM regions WHERE id = ?').get(id);
    if (!region) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Region not found' } });
    }
    db.prepare('DELETE FROM regions WHERE id = ?').run(id);
    res.json({ message: 'Region deleted' });
  } catch (err) {
    console.error('DELETE /api/regions/:id error:', err);
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
  }
});

// Branches CRUD
// Create branch
router.post('/branches', auth, role('superadmin'), async (req, res) => {
  try {
    const { name, code, address, city, region_id, region_ids, division_ids } = req.body;
    if (!name) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Branch name required' } });
    }
    const existing = db.prepare('SELECT id FROM branches WHERE name = ?').get(name);
    if (existing) {
      return res.status(409).json({ error: { code: 'CONFLICT', message: 'Branch name already exists' } });
    }
    if (region_id) {
      const regionExists = db.prepare('SELECT id FROM regions WHERE id = ?').get(region_id);
      if (!regionExists) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Region not found' } });
      }
    }
    const divisionIds = Array.isArray(division_ids) ? division_ids : (division_ids ? [division_ids] : []);
    const regionIds = Array.isArray(region_ids) ? region_ids : (region_ids ? [region_ids] : []);
    if (divisionIds.length > 0) {
      const placeholders = divisionIds.map(() => '?').join(',');
      const divisionsExist = db.prepare(`SELECT id FROM divisions WHERE id IN (${placeholders})`).all(...divisionIds);
      if (divisionsExist.length !== divisionIds.length) {
        return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'One or more divisions not found' } });
      }
    }
    if (regionIds.length > 0) {
      const placeholders = regionIds.map(() => '?').join(',');
      const regionsExist = db.prepare(`SELECT id FROM regions WHERE id IN (${placeholders})`).all(...regionIds);
      if (regionsExist.length !== regionIds.length) {
        return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'One or more regions not found' } });
      }
    }

    const info = db.prepare('INSERT INTO branches (name, code, address, city, region_id) VALUES (?, ?, ?, ?, ?)').run(name, code?.trim() || null, address?.trim() || null, city?.trim() || null, region_id || null);
    const branchId = info.lastInsertRowid;

    if (divisionIds.length > 0) {
      const stmt = db.prepare('INSERT INTO branch_divisions (branch_id, division_id, is_primary) VALUES (?, ?, ?)');
      divisionIds.forEach((divId, idx) => {
        stmt.run(branchId, divId, idx === 0 ? 1 : 0);
      });
    }
    if (regionIds.length > 0) {
      const stmt = db.prepare('INSERT INTO branch_regions (branch_id, region_id) VALUES (?, ?)');
      regionIds.forEach((regId) => {
        stmt.run(branchId, regId);
      });
    }

    const divisions = divisionIds.length > 0 
      ? db.prepare('SELECT id, name, code FROM divisions WHERE id IN (' + divisionIds.map(() => '?').join(',') + ')').all(...divisionIds)
      : [];
    const regions = regionIds.length > 0
      ? db.prepare('SELECT id, name FROM regions WHERE id IN (' + regionIds.map(() => '?').join(',') + ')').all(...regionIds)
      : [];
    
    res.status(201).json({ message: 'Branch created', branch: { id: branchId, name, code, address, city, region_id, divisions, regions } });
  } catch (err) {
    console.error('POST /api/branches error:', err);
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
  }
});

// Update branch
router.patch('/branches/:id', auth, role('superadmin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, address, city, region_id, region_ids, division_ids, active } = req.body;
    const branch = db.prepare('SELECT id, name, code, address, city, region_id, is_active FROM branches WHERE id = ?').get(id);
    if (!branch) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Branch not found' } });
    }
    const nextName = name === undefined ? branch.name : name;
    const nextCode = code === undefined ? branch.code : (code?.trim() || null);
    const nextAddress = address === undefined ? branch.address : (address?.trim() || null);
    const nextCity = city === undefined ? branch.city : (city?.trim() || null);
    const nextRegionId = region_id === undefined ? branch.region_id : (region_id || null);
    const nextActive = active === undefined ? branch.is_active : (active ? 1 : 0);
    
    if (typeof nextName !== 'string' || !nextName.trim()) {
      return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Branch name required' } });
    }
    if (nextRegionId) {
      const regionExists = db.prepare('SELECT id FROM regions WHERE id = ?').get(nextRegionId);
      if (!regionExists) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Region not found' } });
      }
    }
    const duplicate = db.prepare('SELECT id FROM branches WHERE name = ? AND id != ?').get(nextName.trim(), id);
    if (duplicate) {
      return res.status(409).json({ error: { code: 'CONFLICT', message: 'Branch name already exists' } });
    }

    db.prepare('UPDATE branches SET name = ?, code = ?, address = ?, city = ?, region_id = ?, is_active = ? WHERE id = ?')
      .run(nextName.trim(), nextCode, nextAddress, nextCity, nextRegionId, nextActive, id);

    // Handle divisions if provided
    let divisions = [];
    if (division_ids !== undefined) {
      const divisionIds = Array.isArray(division_ids) ? division_ids : (division_ids ? [division_ids] : []);
      if (divisionIds.length > 0) {
        const placeholders = divisionIds.map(() => '?').join(',');
        const divisionsExist = db.prepare(`SELECT id FROM divisions WHERE id IN (${placeholders})`).all(...divisionIds);
        if (divisionsExist.length !== divisionIds.length) {
          return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'One or more divisions not found' } });
        }
      }
      // Replace all divisions
      db.prepare('DELETE FROM branch_divisions WHERE branch_id = ?').run(id);
      if (divisionIds.length > 0) {
        const stmt = db.prepare('INSERT INTO branch_divisions (branch_id, division_id, is_primary) VALUES (?, ?, ?)');
        divisionIds.forEach((divId, idx) => {
          stmt.run(id, divId, idx === 0 ? 1 : 0);
        });
      }
      divisions = divisionIds.length > 0
        ? db.prepare('SELECT id, name, code FROM divisions WHERE id IN (' + divisionIds.map(() => '?').join(',') + ')').all(...divisionIds)
        : [];
    } else {
      // Keep existing divisions
      divisions = db.prepare(`
        SELECT d.id, d.name, d.code
        FROM branch_divisions bd
        JOIN divisions d ON d.id = bd.division_id
        WHERE bd.branch_id = ?
      `).all(id);
    }

    // Handle regions if provided
    let regions = [];
    if (region_ids !== undefined) {
      const regionIds = Array.isArray(region_ids) ? region_ids : (region_ids ? [region_ids] : []);
      if (regionIds.length > 0) {
        const placeholders = regionIds.map(() => '?').join(',');
        const regionsExist = db.prepare(`SELECT id FROM regions WHERE id IN (${placeholders})`).all(...regionIds);
        if (regionsExist.length !== regionIds.length) {
          return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'One or more regions not found' } });
        }
      }
      // Replace all regions
      db.prepare('DELETE FROM branch_regions WHERE branch_id = ?').run(id);
      if (regionIds.length > 0) {
        const stmt = db.prepare('INSERT INTO branch_regions (branch_id, region_id) VALUES (?, ?)');
        regionIds.forEach((regId) => {
          stmt.run(id, regId);
        });
      }
      regions = regionIds.length > 0
        ? db.prepare('SELECT id, name FROM regions WHERE id IN (' + regionIds.map(() => '?').join(',') + ')').all(...regionIds)
        : [];
    } else {
      // Keep existing regions
      regions = db.prepare(`
        SELECT r.id, r.name
        FROM branch_regions br
        JOIN regions r ON r.id = br.region_id
        WHERE br.branch_id = ?
      `).all(id);
    }

    res.json({ message: 'Branch updated', branch: { id, name: nextName, code: nextCode, address: nextAddress, city: nextCity, region_id: nextRegionId, divisions, regions } });
  } catch (err) {
    console.error('PATCH /api/branches/:id error:', err);
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
  }
});

// Delete branch
router.delete('/branches/:id', auth, role('superadmin'), async (req, res) => {
  try {
    const { id } = req.params;
    const branch = db.prepare('SELECT id FROM branches WHERE id = ?').get(id);
    if (!branch) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Branch not found' } });
    }
    db.prepare('DELETE FROM branches WHERE id = ?').run(id);
    res.json({ message: 'Branch deleted' });
  } catch (err) {
    console.error('DELETE /api/branches/:id error:', err);
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
  }
});

  return router;
}

module.exports = createMasterDataRouter;