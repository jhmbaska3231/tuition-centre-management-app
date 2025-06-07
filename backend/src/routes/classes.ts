// backend/src/routes/classes.ts

import express from 'express';
import { pool } from '../index';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';
import { validateClass } from '../middleware/validation';

const router = express.Router();

// Get all active classes (available to both parents and staff)
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { branchId, startDate, endDate } = req.query;

    let query = `
      SELECT c.id, c.subject, c.start_time, c.duration_minutes, c.capacity, 
             c.active, c.created_at,
             b.name as branch_name, b.address as branch_address,
             u.first_name as tutor_first_name, u.last_name as tutor_last_name,
             COUNT(e.id) as enrolled_count
      FROM "Class" c
      LEFT JOIN "Branch" b ON c.branch_id = b.id
      LEFT JOIN "User" u ON c.tutor_id = u.id
      LEFT JOIN "Enrollment" e ON c.id = e.class_id 
        AND e.status = 'enrolled'
        AND EXISTS (
          SELECT 1 FROM "Student" s 
          WHERE s.id = e.student_id AND s.active = TRUE
        )
      WHERE c.active = TRUE AND c.start_time > NOW()
    `;
    const queryParams: any[] = [];
    let paramIndex = 1;

    // Filter by branch if specified
    if (branchId) {
      query += ` AND c.branch_id = $${paramIndex}`;
      queryParams.push(branchId);
      paramIndex++;
    }

    // Filter by date range if specified
    if (startDate) {
      query += ` AND c.start_time >= $${paramIndex}`;
      queryParams.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND c.start_time <= $${paramIndex}`;
      queryParams.push(endDate);
      paramIndex++;
    }

    query += `
      GROUP BY c.id, c.subject, c.start_time, c.duration_minutes, c.capacity, 
               c.active, c.created_at, b.name, b.address, u.first_name, u.last_name
      ORDER BY c.start_time ASC
    `;

    const result = await pool.query(query, queryParams);
    res.json(result.rows);

  } catch (error) {
    console.error('Get classes error:', error);
    res.status(500).json({ error: 'Failed to fetch classes' });
  }
});

// Get a specific class (public)
router.get('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT c.id, c.subject, c.start_time, c.duration_minutes, c.capacity, 
             c.active, c.created_at,
             b.name as branch_name, b.address as branch_address,
             u.first_name as tutor_first_name, u.last_name as tutor_last_name,
             COUNT(e.id) as enrolled_count
      FROM "Class" c
      LEFT JOIN "Branch" b ON c.branch_id = b.id
      LEFT JOIN "User" u ON c.tutor_id = u.id
      LEFT JOIN "Enrollment" e ON c.id = e.class_id 
        AND e.status = 'enrolled'
        AND EXISTS (
          SELECT 1 FROM "Student" s 
          WHERE s.id = e.student_id AND s.active = TRUE
        )
      WHERE c.id = $1 AND c.active = TRUE
      GROUP BY c.id, c.subject, c.start_time, c.duration_minutes, c.capacity, 
               c.active, c.created_at, b.name, b.address, u.first_name, u.last_name
    `, [id]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Class not found' });
      return;
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error('Get class error:', error);
    res.status(500).json({ error: 'Failed to fetch class' });
  }
});

// Create a new class (staff only)
router.post('/', authenticateToken, requireRole('staff'), validateClass, async (req: AuthRequest, res) => {
  try {
    const { subject, startTime, durationMinutes, capacity, branchId } = req.body;

    const result = await pool.query(`
      INSERT INTO "Class" (subject, tutor_id, start_time, duration_minutes, capacity, branch_id, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, subject, start_time, duration_minutes, capacity, active, created_at
    `, [subject, req.user!.userId, startTime, durationMinutes, capacity, branchId, req.user!.userId]);

    const newClass = result.rows[0];

    // Get branch info
    const branchResult = await pool.query(
      'SELECT name as branch_name, address as branch_address FROM "Branch" WHERE id = $1',
      [branchId]
    );

    const classWithBranch = {
      ...newClass,
      ...branchResult.rows[0],
      tutor_first_name: req.user!.email.split('@')[0], // Simplified for now
      enrolled_count: 0
    };

    res.status(201).json({
      message: 'Class created successfully',
      class: classWithBranch
    });

  } catch (error) {
    console.error('Create class error:', error);
    res.status(500).json({ error: 'Failed to create class' });
  }
});

// Update a class (staff only, only future classes)
router.put('/:id', authenticateToken, requireRole('staff'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { subject, startTime, durationMinutes, capacity, branchId } = req.body;

    // Check if class exists and is in the future
    const classCheck = await pool.query(
      'SELECT id, start_time FROM "Class" WHERE id = $1 AND active = TRUE AND start_time > NOW()',
      [id]
    );

    if (classCheck.rows.length === 0) {
      res.status(404).json({ error: 'Class not found or cannot be modified (past class)' });
      return;
    }

    const result = await pool.query(`
      UPDATE "Class" 
      SET subject = COALESCE($1, subject),
          start_time = COALESCE($2, start_time),
          duration_minutes = COALESCE($3, duration_minutes),
          capacity = COALESCE($4, capacity),
          branch_id = COALESCE($5, branch_id),
          updated_at = NOW()
      WHERE id = $6
      RETURNING id, subject, start_time, duration_minutes, capacity, active, created_at
    `, [subject, startTime, durationMinutes, capacity, branchId, id]);

    res.json({
      message: 'Class updated successfully',
      class: result.rows[0]
    });

  } catch (error) {
    console.error('Update class error:', error);
    res.status(500).json({ error: 'Failed to update class' });
  }
});

// Delete a class (staff only, only future classes)
router.delete('/:id', authenticateToken, requireRole('staff'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    // Check if class exists and is in the future
    const classCheck = await pool.query(
      'SELECT id, subject, start_time FROM "Class" WHERE id = $1 AND active = TRUE AND start_time > NOW()',
      [id]
    );

    if (classCheck.rows.length === 0) {
      res.status(404).json({ error: 'Class not found or cannot be deleted (past class)' });
      return;
    }

    // Soft delete by setting active = false
    await pool.query(
      'UPDATE "Class" SET active = FALSE, updated_at = NOW() WHERE id = $1',
      [id]
    );

    res.json({
      message: `Class "${classCheck.rows[0].subject}" deleted successfully`
    });

  } catch (error) {
    console.error('Delete class error:', error);
    res.status(500).json({ error: 'Failed to delete class' });
  }
});

export default router;