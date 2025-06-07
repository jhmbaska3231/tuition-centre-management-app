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
      'SELECT id, email, role, first_name, last_name, phone FROM "User" WHERE id = $1',
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
      phone: user.phone
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
      RETURNING id, email, role, first_name, last_name, phone
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
        phone: user.phone
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Delete user account (and all related data)
router.delete('/account', authenticateToken, async (req: AuthRequest, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const userId = req.user!.userId;
    
    // Get user info for confirmation
    const userResult = await client.query(
      'SELECT first_name, last_name, email FROM "User" WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'User not found' });
      return;
    }
    
    const user = userResult.rows[0];
    
    // Get count of related data for logging
    const studentCount = await client.query(
      'SELECT COUNT(*) as count FROM "Student" WHERE parent_id = $1',
      [userId]
    );
    
    const enrollmentCount = await client.query(
      `SELECT COUNT(*) as count FROM "Enrollment" e 
       JOIN "Student" s ON e.student_id = s.id 
       WHERE s.parent_id = $1`,
      [userId]
    );
    
    const paymentCount = await client.query(
      `SELECT COUNT(*) as count FROM "Payment" p 
       JOIN "Student" s ON p.student_id = s.id 
       WHERE s.parent_id = $1`,
      [userId]
    );
    
    console.log(`Deleting user account: ${user.email}`);
    console.log(`- Students: ${studentCount.rows[0].count}`);
    console.log(`- Enrollments: ${enrollmentCount.rows[0].count}`);
    console.log(`- Payments: ${paymentCount.rows[0].count}`);
    
    // Delete user (this will cascade to all related records due to foreign key constraints)
    // The database schema has proper CASCADE deletes set up:
    // - Students -> Enrollments (CASCADE)
    // - Students -> Payments (CASCADE)
    // - Students -> Attendance (CASCADE)
    await client.query(
      'DELETE FROM "User" WHERE id = $1',
      [userId]
    );
    
    await client.query('COMMIT');
    
    console.log(`Successfully deleted account for: ${user.email}`);
    
    res.json({
      message: 'Account successfully deleted. All your data has been permanently removed.',
      deletedData: {
        students: parseInt(studentCount.rows[0].count),
        enrollments: parseInt(enrollmentCount.rows[0].count),
        payments: parseInt(paymentCount.rows[0].count)
      }
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Account deletion error:', error);
    res.status(500).json({ error: 'Failed to delete account. Please try again or contact support.' });
  } finally {
    client.release();
  }
});

export default router;