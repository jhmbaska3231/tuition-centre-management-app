// backend/src/routes/admin.ts

import express from 'express';
import bcrypt from 'bcrypt';
import { pool } from '../index';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';
import { validateParentRegistration } from '../middleware/validation';

const router = express.Router();

// Get all staff members (admin only)
router.get('/staff', authenticateToken, requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(`
      SELECT id, email, first_name, last_name, phone, active, created_at, updated_at
      FROM "User" 
      WHERE role = 'staff'
      ORDER BY first_name, last_name
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Get staff error:', error);
    res.status(500).json({ error: 'Failed to fetch staff members' });
  }
});

// Get staff member details with class count (admin only)
router.get('/staff/:id', authenticateToken, requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.active, u.created_at, u.updated_at,
             COUNT(c.id) as class_count,
             COUNT(CASE WHEN c.start_time > NOW() THEN 1 END) as future_class_count
      FROM "User" u
      LEFT JOIN "Class" c ON u.id = c.tutor_id AND c.active = TRUE
      WHERE u.id = $1 AND u.role = 'staff'
      GROUP BY u.id, u.email, u.first_name, u.last_name, u.phone, u.active, u.created_at, u.updated_at
    `, [id]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Staff member not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get staff member error:', error);
    res.status(500).json({ error: 'Failed to fetch staff member' });
  }
});

// Create new staff account (admin only)
router.post('/staff', authenticateToken, requireRole('admin'), validateParentRegistration, async (req: AuthRequest, res) => {
  try {
    const { firstName, lastName, email, phone, password } = req.body;

    // Trim and normalize email
    const trimmedEmail = email.trim().toLowerCase();

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM "User" WHERE email = $1',
      [trimmedEmail]
    );

    if (existingUser.rows.length > 0) {
      res.status(409).json({ error: 'An account with this email already exists' });
      return;
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create staff user
    const result = await pool.query(
      `INSERT INTO "User" (email, password, role, first_name, last_name, phone) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING id, email, role, first_name, last_name, phone, active, created_at`,
      [trimmedEmail, hashedPassword, 'staff', firstName.trim(), lastName.trim(), phone?.trim() || null]
    );

    const user = result.rows[0];

    res.status(201).json({
      message: 'Staff account created successfully',
      staff: user
    });

  } catch (error) {
    console.error('Create staff error:', error);
    res.status(500).json({ error: 'Failed to create staff account' });
  }
});

// Update staff account (admin only)
router.put('/staff/:id', authenticateToken, requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, phone, active } = req.body;

    // Verify staff member exists
    const staffCheck = await pool.query(
      'SELECT id FROM "User" WHERE id = $1 AND role = $2',
      [id, 'staff']
    );

    if (staffCheck.rows.length === 0) {
      res.status(404).json({ error: 'Staff member not found' });
      return;
    }

    const result = await pool.query(`
      UPDATE "User" 
      SET first_name = COALESCE($1, first_name),
          last_name = COALESCE($2, last_name),
          phone = COALESCE($3, phone),
          active = COALESCE($4, active),
          updated_at = NOW()
      WHERE id = $5 AND role = 'staff'
      RETURNING id, email, role, first_name, last_name, phone, active, created_at, updated_at
    `, [firstName?.trim(), lastName?.trim(), phone?.trim(), active, id]);

    res.json({
      message: 'Staff account updated successfully',
      staff: result.rows[0]
    });

  } catch (error) {
    console.error('Update staff error:', error);
    res.status(500).json({ error: 'Failed to update staff account' });
  }
});

// Check staff deletion impact (admin only)
router.get('/staff/:id/deletion-impact', authenticateToken, requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    // Get staff info and their classes
    const staffResult = await pool.query(`
      SELECT first_name, last_name, email
      FROM "User"
      WHERE id = $1 AND role = 'staff'
    `, [id]);

    if (staffResult.rows.length === 0) {
      res.status(404).json({ error: 'Staff member not found' });
      return;
    }

    // Get classes that will be affected
    const classesResult = await pool.query(`
      SELECT c.id, c.subject, c.start_time, c.duration_minutes, 
             b.name as branch_name,
             cr.room_name as classroom_name,
             COUNT(e.id) as enrolled_count
      FROM "Class" c
      LEFT JOIN "Branch" b ON c.branch_id = b.id
      LEFT JOIN "Classroom" cr ON c.classroom_id = cr.id
      LEFT JOIN "Enrollment" e ON c.id = e.class_id AND e.status = 'enrolled'
      WHERE c.tutor_id = $1 AND c.active = TRUE
      GROUP BY c.id, c.subject, c.start_time, c.duration_minutes, b.name, cr.room_name
      ORDER BY c.start_time
    `, [id]);

    const staff = staffResult.rows[0];
    const affectedClasses = classesResult.rows;
    const futureClasses = affectedClasses.filter(cls => new Date(cls.start_time) > new Date());

    res.json({
      staff,
      impact: {
        totalClasses: affectedClasses.length,
        futureClasses: futureClasses.length,
        affectedClasses,
        warning: affectedClasses.length > 0 ? 
          `This staff member is assigned to ${affectedClasses.length} class(es). Their deletion will set these classes to have no tutor.` :
          null
      }
    });

  } catch (error) {
    console.error('Check deletion impact error:', error);
    res.status(500).json({ error: 'Failed to check deletion impact' });
  }
});

// Delete staff account (admin only)
router.delete('/staff/:id', authenticateToken, requireRole('admin'), async (req: AuthRequest, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { acknowledged } = req.body; // Admin must acknowledge the impact

    if (!acknowledged) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'Deletion impact must be acknowledged' });
      return;
    }
    
    // Get staff info for logging
    const staffResult = await client.query(
      'SELECT first_name, last_name, email FROM "User" WHERE id = $1 AND role = $2',
      [id, 'staff']
    );
    
    if (staffResult.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Staff member not found' });
      return;
    }
    
    const staff = staffResult.rows[0];
    
    // Get affected classes count for logging
    const classesCount = await client.query(
      'SELECT COUNT(*) as count FROM "Class" WHERE tutor_id = $1 AND active = TRUE',
      [id]
    );
    
    // Delete staff member - classes will automatically have tutor_id set to NULL due to ON DELETE SET NULL
    await client.query(
      'DELETE FROM "User" WHERE id = $1 AND role = $2',
      [id, 'staff']
    );
    
    await client.query('COMMIT');
    
    res.json({
      message: 'Staff account deleted successfully',
      affectedClasses: parseInt(classesCount.rows[0].count)
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete staff error:', error);
    res.status(500).json({ error: 'Failed to delete staff account' });
  } finally {
    client.release();
  }
});

// Get classes without tutor for reassignment (admin only)
router.get('/classes/unassigned', authenticateToken, requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(`
      SELECT c.id, c.subject, c.description, c.level, c.start_time, c.duration_minutes, c.capacity,
             b.name as branch_name, b.address as branch_address,
             cr.room_name as classroom_name,
             COUNT(e.id) as enrolled_count
      FROM "Class" c
      LEFT JOIN "Branch" b ON c.branch_id = b.id
      LEFT JOIN "Classroom" cr ON c.classroom_id = cr.id
      LEFT JOIN "Enrollment" e ON c.id = e.class_id AND e.status = 'enrolled'
      WHERE c.tutor_id IS NULL AND c.active = TRUE
      GROUP BY c.id, c.subject, c.description, c.level, c.start_time, c.duration_minutes, c.capacity, b.name, b.address, cr.room_name
      ORDER BY c.start_time
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Get unassigned classes error:', error);
    res.status(500).json({ error: 'Failed to fetch unassigned classes' });
  }
});

// Reassign tutor to class (admin only)
router.put('/classes/:classId/assign-tutor', authenticateToken, requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const { classId } = req.params;
    const { tutorId } = req.body;

    if (!tutorId) {
      res.status(400).json({ error: 'Tutor ID is required' });
      return;
    }

    // Verify tutor exists and is staff
    const tutorCheck = await pool.query(
      'SELECT first_name, last_name FROM "User" WHERE id = $1 AND role = $2 AND active = TRUE',
      [tutorId, 'staff']
    );

    if (tutorCheck.rows.length === 0) {
      res.status(404).json({ error: 'Staff member not found or inactive' });
      return;
    }

    // Verify class exists
    const classCheck = await pool.query(
      'SELECT subject, start_time FROM "Class" WHERE id = $1 AND active = TRUE',
      [classId]
    );

    if (classCheck.rows.length === 0) {
      res.status(404).json({ error: 'Class not found or inactive' });
      return;
    }

    // Assign tutor to class
    await pool.query(
      'UPDATE "Class" SET tutor_id = $1, updated_at = NOW() WHERE id = $2',
      [tutorId, classId]
    );

    const tutor = tutorCheck.rows[0];
    const classInfo = classCheck.rows[0];

    res.json({
      message: `${tutor.first_name} ${tutor.last_name} assigned to ${classInfo.subject} class successfully`
    });

  } catch (error) {
    console.error('Assign tutor error:', error);
    res.status(500).json({ error: 'Failed to assign tutor to class' });
  }
});

// Get all users for overview (admin only)
router.get('/users/overview', authenticateToken, requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        role,
        COUNT(*) as total_count,
        COUNT(CASE WHEN active = TRUE THEN 1 END) as active_count
      FROM "User"
      GROUP BY role
      ORDER BY role
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Get users overview error:', error);
    res.status(500).json({ error: 'Failed to fetch users overview' });
  }
});

export default router;