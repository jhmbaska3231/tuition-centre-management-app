// backend/src/routes/classes.ts

import express from 'express';
import { pool } from '../index';
import { authenticateToken, requireRole, requireAnyRole, AuthRequest } from '../middleware/auth';
import { validateClass } from '../middleware/validation';

const router = express.Router();

// Get all active classes (available to parents, staff, and admin with different permissions)
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { branchId, startDate, endDate } = req.query;
    const userRole = req.user!.role;
    const userId = req.user!.userId;

    let query = `
      SELECT c.id, c.subject, c.description, c.level, c.start_time, c.duration_minutes, c.capacity, 
             c.active, c.created_at, c.updated_at,
             c.end_time, c.tutor_id, c.branch_id,
             b.name as branch_name, b.address as branch_address,
             u.first_name as tutor_first_name, u.last_name as tutor_last_name,
             COALESCE(enrolled_count.count, 0) as enrolled_count
      FROM "Class" c
      LEFT JOIN "Branch" b ON c.branch_id = b.id
      LEFT JOIN "User" u ON c.tutor_id = u.id
      LEFT JOIN (
        SELECT 
          e.class_id,
          COUNT(e.id) as count
        FROM "Enrollment" e
        INNER JOIN "Student" s ON e.student_id = s.id AND s.active = TRUE
        WHERE e.status = 'enrolled'
        GROUP BY e.class_id
      ) enrolled_count ON c.id = enrolled_count.class_id
      WHERE c.active = TRUE
    `;

    const queryParams: any[] = [];
    let paramIndex = 1;

    // For staff, only show classes in the future OR classes assigned to them
    if (userRole === 'staff') {
      query += ` AND (c.start_time > NOW() OR c.tutor_id = $${paramIndex})`;
      queryParams.push(userId);
      paramIndex++;
    } else if (userRole === 'parent') {
      // For parents, show future classes only
      query += ` AND c.start_time > NOW()`;
      
      // Get parent's children's grades for filtering (separate query with its own parameters)
      const childrenGrades = await pool.query(`
        SELECT DISTINCT grade 
        FROM "Student" 
        WHERE parent_id = $1 AND active = TRUE AND grade IS NOT NULL
      `, [userId]);
      
      if (childrenGrades.rows.length > 0) {
        const grades = childrenGrades.rows.map(row => row.grade);
        // Show classes that either have "Mixed Levels" specified OR match one of the children's grades
        const placeholders = grades.map((_, i) => `$${paramIndex + i}`).join(', ');
        query += ` AND (c.level = 'Mixed Levels' OR c.level IN (${placeholders}))`;
        queryParams.push(...grades);
        paramIndex += grades.length;
      }
    } else {
      // For admin, show future classes only
      query += ` AND c.start_time > NOW()`;
    }

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

    query += ` ORDER BY c.start_time ASC`;

    const result = await pool.query(query, queryParams);
    
    // Add permission flags for frontend
    const classesWithPermissions = result.rows.map(classItem => ({
      ...classItem,
      enrolled_count: parseInt(classItem.enrolled_count) || 0, // Ensure it's a number
      can_edit: userRole === 'admin' || (userRole === 'staff' && classItem.tutor_id === userId),
      can_delete: userRole === 'admin' || (userRole === 'staff' && classItem.tutor_id === userId)
    }));

    res.json(classesWithPermissions);

  } catch (error) {
    console.error('Get classes error:', error);
    res.status(500).json({ error: 'Failed to fetch classes' });
  }
});

// Get a specific class (public)
router.get('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userRole = req.user!.role;
    const userId = req.user!.userId;

    const result = await pool.query(`
      SELECT c.id, c.subject, c.description, c.level, c.start_time, c.duration_minutes, c.capacity, 
             c.active, c.created_at, c.updated_at, c.end_time, c.tutor_id, c.branch_id,
             b.name as branch_name, b.address as branch_address,
             u.first_name as tutor_first_name, u.last_name as tutor_last_name,
             COALESCE(enrolled_count.count, 0) as enrolled_count
      FROM "Class" c
      LEFT JOIN "Branch" b ON c.branch_id = b.id
      LEFT JOIN "User" u ON c.tutor_id = u.id
      LEFT JOIN (
        SELECT 
          e.class_id,
          COUNT(e.id) as count
        FROM "Enrollment" e
        INNER JOIN "Student" s ON e.student_id = s.id AND s.active = TRUE
        WHERE e.status = 'enrolled'
        GROUP BY e.class_id
      ) enrolled_count ON c.id = enrolled_count.class_id
      WHERE c.id = $1 AND c.active = TRUE
    `, [id]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Class not found' });
      return;
    }

    const classItem = result.rows[0];
    
    // Add permission flags
    const classWithPermissions = {
      ...classItem,
      enrolled_count: parseInt(classItem.enrolled_count) || 0, // Ensure it's a number
      can_edit: userRole === 'admin' || (userRole === 'staff' && classItem.tutor_id === userId),
      can_delete: userRole === 'admin' || (userRole === 'staff' && classItem.tutor_id === userId)
    };

    res.json(classWithPermissions);

  } catch (error) {
    console.error('Get class error:', error);
    res.status(500).json({ error: 'Failed to fetch class' });
  }
});

// Create a new class (staff and admin only)
router.post('/', authenticateToken, requireAnyRole('staff', 'admin'), validateClass, async (req: AuthRequest, res) => {
  try {
    const { subject, description, level, startTime, durationMinutes, capacity, branchId } = req.body;
    const userId = req.user!.userId;

    // Ensure level is provided (validation middleware should catch this, but double-check)
    if (!level || level.trim().length === 0) {
      res.status(400).json({ error: 'Level/Grade is required for all classes' });
      return;
    }

    const result = await pool.query(`
      INSERT INTO "Class" (subject, description, level, tutor_id, start_time, duration_minutes, capacity, branch_id, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, subject, description, level, start_time, duration_minutes, capacity, active, created_at, updated_at
    `, [subject, description || null, level.trim(), userId, startTime, durationMinutes, capacity, branchId, userId]);

    const newClass = result.rows[0];

    // Get branch info and tutor info
    const [branchResult, tutorResult] = await Promise.all([
      pool.query('SELECT name as branch_name, address as branch_address FROM "Branch" WHERE id = $1', [branchId]),
      pool.query('SELECT first_name as tutor_first_name, last_name as tutor_last_name FROM "User" WHERE id = $1', [userId])
    ]);

    const classWithDetails = {
      ...newClass,
      ...branchResult.rows[0],
      ...tutorResult.rows[0],
      tutor_id: userId,
      branch_id: branchId,
      enrolled_count: 0,
      can_edit: true,
      can_delete: true
    };

    res.status(201).json({
      message: 'Class created successfully',
      class: classWithDetails
    });

  } catch (error) {
    console.error('Create class error:', error);
    res.status(500).json({ error: 'Failed to create class' });
  }
});

// Update a class (staff can only update their own, admin can update any)
router.put('/:id', authenticateToken, requireAnyRole('staff', 'admin'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { subject, description, level, startTime, durationMinutes, capacity, branchId } = req.body;
    const userRole = req.user!.role;
    const userId = req.user!.userId;

    // Check if class exists and is in the future
    const classCheck = await pool.query(
      'SELECT id, start_time, tutor_id FROM "Class" WHERE id = $1 AND active = TRUE AND start_time > NOW()',
      [id]
    );

    if (classCheck.rows.length === 0) {
      res.status(404).json({ error: 'Class not found or cannot be modified (past class)' });
      return;
    }

    const classItem = classCheck.rows[0];

    // Check permissions: staff can only edit their own classes
    if (userRole === 'staff' && classItem.tutor_id !== userId) {
      res.status(403).json({ error: 'You can only edit classes assigned to you' });
      return;
    }

    // Validate required fields for updates
    if (level !== undefined && (!level || level.trim().length === 0)) {
      res.status(400).json({ error: 'Level/Grade is required and cannot be empty' });
      return;
    }

    const result = await pool.query(`
      UPDATE "Class" 
      SET subject = COALESCE($1, subject),
          description = COALESCE($2, description),
          level = COALESCE($3, level),
          start_time = COALESCE($4, start_time),
          duration_minutes = COALESCE($5, duration_minutes),
          capacity = COALESCE($6, capacity),
          branch_id = COALESCE($7, branch_id),
          updated_at = NOW()
      WHERE id = $8
      RETURNING id, subject, description, level, start_time, duration_minutes, capacity, active, created_at, updated_at
    `, [subject, description, level?.trim(), startTime, durationMinutes, capacity, branchId, id]);

    res.json({
      message: 'Class updated successfully',
      class: result.rows[0]
    });

  } catch (error) {
    console.error('Update class error:', error);
    res.status(500).json({ error: 'Failed to update class' });
  }
});

// Delete a class (staff can only delete their own, admin can delete any)
router.delete('/:id', authenticateToken, requireAnyRole('staff', 'admin'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userRole = req.user!.role;
    const userId = req.user!.userId;

    // Check if class exists and is in the future
    const classCheck = await pool.query(
      'SELECT id, subject, start_time, tutor_id FROM "Class" WHERE id = $1 AND active = TRUE AND start_time > NOW()',
      [id]
    );

    if (classCheck.rows.length === 0) {
      res.status(404).json({ error: 'Class not found or cannot be deleted (past class)' });
      return;
    }

    const classItem = classCheck.rows[0];

    // Check permissions: staff can only delete their own classes
    if (userRole === 'staff' && classItem.tutor_id !== userId) {
      res.status(403).json({ error: 'You can only delete classes assigned to you' });
      return;
    }

    // Soft delete by setting active = false
    await pool.query(
      'UPDATE "Class" SET active = FALSE, updated_at = NOW() WHERE id = $1',
      [id]
    );

    res.json({
      message: `Class "${classItem.subject}" deleted successfully`
    });

  } catch (error) {
    console.error('Delete class error:', error);
    res.status(500).json({ error: 'Failed to delete class' });
  }
});

export default router;