// backend/src/routes/students.ts

import express from 'express';
import { pool } from '../index';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';
import { validateStudent } from '../middleware/validation';

const router = express.Router();

// Get all students for a parent (parents only)
router.get('/my-students', authenticateToken, requireRole('parent'), async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(`
      SELECT s.id, s.first_name, s.last_name, s.grade, s.date_of_birth, s.home_branch_id, s.active,
             s.created_at, s.updated_at,
             b.name as home_branch_name, b.address as home_branch_address
      FROM "Student" s
      LEFT JOIN "Branch" b ON s.home_branch_id = b.id
      WHERE s.parent_id = $1 AND s.active = TRUE
      ORDER BY s.first_name, s.last_name
    `, [req.user!.userId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// Get all students (staff only) 
router.get('/all', authenticateToken, requireRole('staff'), async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(`
      SELECT s.id, s.first_name, s.last_name, s.grade, s.date_of_birth, s.home_branch_id, s.active,
             s.created_at, s.updated_at,
             b.name as home_branch_name,
             u.first_name as parent_first_name, u.last_name as parent_last_name,
             u.email as parent_email, u.phone as parent_phone
      FROM "Student" s
      LEFT JOIN "Branch" b ON s.home_branch_id = b.id
      LEFT JOIN "User" u ON s.parent_id = u.id
      WHERE s.active = TRUE
      ORDER BY s.first_name, s.last_name
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Get all students error:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// Create a new student (parents only)
router.post('/', authenticateToken, requireRole('parent'), validateStudent, async (req: AuthRequest, res) => {
  try {
    const { firstName, lastName, grade, dateOfBirth, homeBranchId } = req.body;

    // Verify the branch exists and is active
    if (homeBranchId) {
      const branchCheck = await pool.query(
        'SELECT id FROM "Branch" WHERE id = $1 AND active = TRUE',
        [homeBranchId]
      );
      
      if (branchCheck.rows.length === 0) {
        res.status(400).json({ error: 'Invalid branch selected' });
        return;
      }
    }

    const result = await pool.query(`
      INSERT INTO "Student" (first_name, last_name, grade, date_of_birth, parent_id, home_branch_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, first_name, last_name, grade, date_of_birth, home_branch_id, active, created_at, updated_at
    `, [firstName.trim(), lastName.trim(), grade.trim(), dateOfBirth || null, req.user!.userId, homeBranchId || null]);

    const student = result.rows[0];

    // Get branch info if available
    let studentWithBranch = student;
    if (student.home_branch_id) {
      const branchResult = await pool.query(
        'SELECT name as home_branch_name, address as home_branch_address FROM "Branch" WHERE id = $1',
        [student.home_branch_id]
      );
      if (branchResult.rows.length > 0) {
        studentWithBranch = { ...student, ...branchResult.rows[0] };
      }
    }

    res.status(201).json({
      message: 'Student created successfully',
      student: studentWithBranch
    });

  } catch (error) {
    console.error('Create student error:', error);
    res.status(500).json({ error: 'Failed to create student' });
  }
});

// Update a student (parents can only update their own children)
router.put('/:id', authenticateToken, requireRole('parent'), validateStudent, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, grade, dateOfBirth, homeBranchId } = req.body;

    // Verify student belongs to this parent
    const studentCheck = await pool.query(
      'SELECT id FROM "Student" WHERE id = $1 AND parent_id = $2 AND active = TRUE',
      [id, req.user!.userId]
    );

    if (studentCheck.rows.length === 0) {
      res.status(404).json({ error: 'Student not found or access denied' });
      return;
    }

    // Verify branch if provided
    if (homeBranchId) {
      const branchCheck = await pool.query(
        'SELECT id FROM "Branch" WHERE id = $1 AND active = TRUE',
        [homeBranchId]
      );
      
      if (branchCheck.rows.length === 0) {
        res.status(400).json({ error: 'Invalid branch selected' });
        return;
      }
    }

    const result = await pool.query(`
      UPDATE "Student" 
      SET first_name = COALESCE($1, first_name),
          last_name = COALESCE($2, last_name),
          grade = COALESCE($3, grade),
          date_of_birth = COALESCE($4, date_of_birth),
          home_branch_id = COALESCE($5, home_branch_id),
          updated_at = NOW()
      WHERE id = $6 AND parent_id = $7
      RETURNING id, first_name, last_name, grade, date_of_birth, home_branch_id, active, created_at, updated_at
    `, [firstName?.trim(), lastName?.trim(), grade?.trim(), dateOfBirth, homeBranchId, id, req.user!.userId]);

    const student = result.rows[0];

    // Get branch info if available
    let studentWithBranch = student;
    if (student.home_branch_id) {
      const branchResult = await pool.query(
        'SELECT name as home_branch_name, address as home_branch_address FROM "Branch" WHERE id = $1',
        [student.home_branch_id]
      );
      if (branchResult.rows.length > 0) {
        studentWithBranch = { ...student, ...branchResult.rows[0] };
      }
    }

    res.json({
      message: 'Student updated successfully',
      student: studentWithBranch
    });

  } catch (error) {
    console.error('Update student error:', error);
    res.status(500).json({ error: 'Failed to update student' });
  }
});

// Soft delete a student (parents can only delete their own children)
router.delete('/:id', authenticateToken, requireRole('parent'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    // Verify student belongs to this parent
    const studentCheck = await pool.query(
      'SELECT id, first_name, last_name FROM "Student" WHERE id = $1 AND parent_id = $2 AND active = TRUE',
      [id, req.user!.userId]
    );

    if (studentCheck.rows.length === 0) {
      res.status(404).json({ error: 'Student not found or access denied' });
      return;
    }

    // Soft delete by setting active = false
    await pool.query(
      'UPDATE "Student" SET active = FALSE, updated_at = NOW() WHERE id = $1',
      [id]
    );

    const student = studentCheck.rows[0];
    res.json({
      message: `Student ${student.first_name} ${student.last_name} removed successfully`
    });

  } catch (error) {
    console.error('Delete student error:', error);
    res.status(500).json({ error: 'Failed to remove student' });
  }
});

// Get a specific student (parents can only view their own children, staff can view any)
router.get('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    let query = `
      SELECT s.id, s.first_name, s.last_name, s.grade, s.date_of_birth, s.home_branch_id, s.active,
             s.created_at, s.updated_at,
             b.name as home_branch_name, b.address as home_branch_address
      FROM "Student" s
      LEFT JOIN "Branch" b ON s.home_branch_id = b.id
      WHERE s.id = $1 AND s.active = TRUE
    `;
    
    let queryParams = [id];

    // If parent, add parent restriction
    if (req.user!.role === 'parent') {
      query += ' AND s.parent_id = $2';
      queryParams.push(req.user!.userId);
    }

    const result = await pool.query(query, queryParams);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error('Get student error:', error);
    res.status(500).json({ error: 'Failed to fetch student' });
  }
});

export default router;