// backend/src/routes/branches.ts

import express from 'express';
import { pool } from '../index';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Get all branches (public endpoint)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, address, phone, active, created_at, updated_at FROM "Branch" WHERE active = TRUE ORDER BY name'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Branches fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch branches' });
  }
});

// Get all branches including inactive ones (admin only)
router.get('/all', authenticateToken, requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, address, phone, active, created_at, updated_at FROM "Branch" ORDER BY name'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('All branches fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch all branches' });
  }
});

// Get a specific branch (admin only)
router.get('/:id', authenticateToken, requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT id, name, address, phone, active, created_at, updated_at FROM "Branch" WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Branch not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get branch error:', error);
    res.status(500).json({ error: 'Failed to fetch branch' });
  }
});

// Create a new branch (admin only)
router.post('/', authenticateToken, requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const { name, address, phone } = req.body;

    // Validation
    if (!name || name.trim().length < 2) {
      res.status(400).json({ error: 'Branch name must be at least 2 characters long' });
      return;
    }

    if (!address || address.trim().length < 5) {
      res.status(400).json({ error: 'Address must be at least 5 characters long' });
      return;
    }

    // Optional phone validation
    if (phone && !/^\d{8}$/.test(phone.trim())) {
      res.status(400).json({ error: 'Phone number must be exactly 8 digits if provided' });
      return;
    }

    // Check if branch name already exists
    const existingBranch = await pool.query(
      'SELECT id FROM "Branch" WHERE LOWER(name) = LOWER($1)',
      [name.trim()]
    );

    if (existingBranch.rows.length > 0) {
      res.status(409).json({ error: 'A branch with this name already exists' });
      return;
    }

    const result = await pool.query(
      'INSERT INTO "Branch" (name, address, phone) VALUES ($1, $2, $3) RETURNING id, name, address, phone, active, created_at, updated_at',
      [name.trim(), address.trim(), phone?.trim() || null]
    );

    res.status(201).json({
      message: 'Branch created successfully',
      branch: result.rows[0]
    });

  } catch (error) {
    console.error('Create branch error:', error);
    res.status(500).json({ error: 'Failed to create branch' });
  }
});

// Update a branch (admin only)
router.put('/:id', authenticateToken, requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { name, address, phone, active } = req.body;

    // Check if branch exists
    const branchCheck = await pool.query(
      'SELECT id FROM "Branch" WHERE id = $1',
      [id]
    );

    if (branchCheck.rows.length === 0) {
      res.status(404).json({ error: 'Branch not found' });
      return;
    }

    // Validation
    if (name && name.trim().length < 2) {
      res.status(400).json({ error: 'Branch name must be at least 2 characters long' });
      return;
    }

    if (address && address.trim().length < 5) {
      res.status(400).json({ error: 'Address must be at least 5 characters long' });
      return;
    }

    // Optional phone validation
    if (phone && phone.trim() && !/^\d{8}$/.test(phone.trim())) {
      res.status(400).json({ error: 'Phone number must be exactly 8 digits if provided' });
      return;
    }

    // Check for duplicate name if name is being updated
    if (name) {
      const duplicateCheck = await pool.query(
        'SELECT id FROM "Branch" WHERE LOWER(name) = LOWER($1) AND id != $2',
        [name.trim(), id]
      );

      if (duplicateCheck.rows.length > 0) {
        res.status(409).json({ error: 'A branch with this name already exists' });
        return;
      }
    }

    const result = await pool.query(`
      UPDATE "Branch" 
      SET name = COALESCE($1, name),
          address = COALESCE($2, address),
          phone = COALESCE($3, phone),
          active = COALESCE($4, active),
          updated_at = NOW()
      WHERE id = $5
      RETURNING id, name, address, phone, active, created_at, updated_at
    `, [name?.trim(), address?.trim(), phone?.trim() || null, active, id]);

    res.json({
      message: 'Branch updated successfully',
      branch: result.rows[0]
    });

  } catch (error) {
    console.error('Update branch error:', error);
    res.status(500).json({ error: 'Failed to update branch' });
  }
});

// Check branch deletion impact (admin only)
router.get('/:id/deletion-impact', authenticateToken, requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    // Get branch info
    const branchResult = await pool.query(
      'SELECT name, address FROM "Branch" WHERE id = $1',
      [id]
    );

    if (branchResult.rows.length === 0) {
      res.status(404).json({ error: 'Branch not found' });
      return;
    }

    // Get impact data
    const [studentsResult, classesResult] = await Promise.all([
      pool.query(`
        SELECT COUNT(*) as count
        FROM "Student" 
        WHERE home_branch_id = $1 AND active = TRUE
      `, [id]),
      pool.query(`
        SELECT COUNT(*) as count,
               COUNT(CASE WHEN start_time > NOW() THEN 1 END) as future_count
        FROM "Class" 
        WHERE branch_id = $1 AND active = TRUE
      `, [id])
    ]);

    const branch = branchResult.rows[0];
    const studentsCount = parseInt(studentsResult.rows[0].count);
    const totalClasses = parseInt(classesResult.rows[0].count);
    const futureClasses = parseInt(classesResult.rows[0].future_count);

    res.json({
      branch,
      impact: {
        studentsAffected: studentsCount,
        totalClasses,
        futureClasses,
        warning: studentsCount > 0 || totalClasses > 0 ? 
          `This branch has ${studentsCount} student(s) and ${totalClasses} class(es) associated with it. Deletion will set their home branch/class branch to null.` :
          null
      }
    });

  } catch (error) {
    console.error('Check deletion impact error:', error);
    res.status(500).json({ error: 'Failed to check deletion impact' });
  }
});

// Delete a branch (admin only)
router.delete('/:id', authenticateToken, requireRole('admin'), async (req: AuthRequest, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { acknowledged } = req.body;

    if (!acknowledged) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'Deletion impact must be acknowledged' });
      return;
    }
    
    // Get branch info for logging
    const branchResult = await client.query(
      'SELECT name, address FROM "Branch" WHERE id = $1',
      [id]
    );
    
    if (branchResult.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Branch not found' });
      return;
    }
    
    const branch = branchResult.rows[0];
    
    // Get counts for logging
    const [studentsCount, classesCount] = await Promise.all([
      client.query('SELECT COUNT(*) as count FROM "Student" WHERE home_branch_id = $1 AND active = TRUE', [id]),
      client.query('SELECT COUNT(*) as count FROM "Class" WHERE branch_id = $1 AND active = TRUE', [id])
    ]);
    
    // Soft delete the branch (set active = false)
    await client.query(
      'UPDATE "Branch" SET active = FALSE, updated_at = NOW() WHERE id = $1',
      [id]
    );
    
    await client.query('COMMIT');
    
    res.json({
      message: `Branch "${branch.name}" deactivated successfully`,
      affectedStudents: parseInt(studentsCount.rows[0].count),
      affectedClasses: parseInt(classesCount.rows[0].count)
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete branch error:', error);
    res.status(500).json({ error: 'Failed to delete branch' });
  } finally {
    client.release();
  }
});

export default router;