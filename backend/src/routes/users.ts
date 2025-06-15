// backend/src/routes/users.ts

import express from 'express';
import { pool } from '../index';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { validateProfileUpdate } from '../middleware/validation';

const router = express.Router();

// Get user profile
router.get('/profile', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, role, first_name, last_name, phone, created_at, updated_at FROM "User" WHERE id = $1',
      [req.user!.userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const user = result.rows[0];
    res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      first_name: user.first_name,
      last_name: user.last_name,
      phone: user.phone,
      created_at: user.created_at,
      updated_at: user.updated_at
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, validateProfileUpdate, async (req: AuthRequest, res) => {
  try {
    const { firstName, lastName, phone } = req.body;

    const result = await pool.query(`
      UPDATE "User" 
      SET first_name = COALESCE($1, first_name),
          last_name = COALESCE($2, last_name),
          phone = COALESCE($3, phone),
          updated_at = NOW()
      WHERE id = $4
      RETURNING id, email, role, first_name, last_name, phone, created_at, updated_at
    `, [firstName, lastName, phone, req.user!.userId]);

    const user = result.rows[0];
    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone,
        created_at: user.created_at,
        updated_at: user.updated_at
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Delete user account (and all related data via CASCADE)
router.delete('/account', authenticateToken, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const userId = req.user!.userId;
    
    // Get user info for confirmation
    const userResult = await client.query(
      'SELECT first_name, last_name, email, role FROM "User" WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'User not found' });
      return;
    }
    
    const user = userResult.rows[0];
    
    // Only allow parents to delete their own accounts
    if (user.role !== 'parent') {
      await client.query('ROLLBACK');
      res.status(403).json({ error: 'Only parent accounts can be self-deleted' });
      return;
    }
    
    // Get count of affected records for confirmation
    const [studentsResult, enrollmentsResult, paymentsResult] = await Promise.all([
      client.query('SELECT COUNT(*) as count FROM "Student" WHERE parent_id = $1 AND active = TRUE', [userId]),
      client.query(`
        SELECT COUNT(DISTINCT e.id) as count 
        FROM "Enrollment" e 
        JOIN "Student" s ON e.student_id = s.id 
        WHERE s.parent_id = $1 AND s.active = TRUE AND e.status = 'enrolled'
      `, [userId]),
      client.query(`
        SELECT COUNT(*) as count 
        FROM "Payment" p 
        JOIN "Student" s ON p.student_id = s.id 
        WHERE s.parent_id = $1 AND s.active = TRUE
      `, [userId])
    ]);
    
    const studentsCount = parseInt(studentsResult.rows[0].count);
    const enrollmentsCount = parseInt(enrollmentsResult.rows[0].count);
    const paymentsCount = parseInt(paymentsResult.rows[0].count);
    
    // Cancel all active enrollments for this parent's students
    await client.query(`
      UPDATE "Enrollment" 
      SET status = 'cancelled', cancelled_at = NOW()
      WHERE student_id IN (
        SELECT id FROM "Student" WHERE parent_id = $1 AND active = TRUE
      ) AND status = 'enrolled'
    `, [userId]);
    
    // Soft delete all students
    await client.query('UPDATE "Student" SET active = FALSE WHERE parent_id = $1', [userId]);
    
    // Soft delete user account
    await client.query('UPDATE "User" SET active = FALSE WHERE id = $1', [userId]);
    
    await client.query('COMMIT');
    
    res.json({
      message: `Account for ${user.first_name} ${user.last_name} has been deleted successfully`,
      deletedData: {
        students: studentsCount,
        enrollments: enrollmentsCount,
        payments: paymentsCount
      }
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Account deletion error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  } finally {
    client.release();
  }
});

export default router;