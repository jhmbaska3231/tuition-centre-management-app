// backend/src/routes/payments.ts

import express from 'express';
import { pool } from '../index';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Get payment history for my students (parents only)
router.get('/my-students', authenticateToken, requireRole('parent'), async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(`
      SELECT p.id, p.month, p.amount, p.paid, p.payment_date, p.payment_method,
             CONCAT(s.first_name, ' ', s.last_name) as student_name
      FROM "Payment" p
      JOIN "Student" s ON p.student_id = s.id
      WHERE s.parent_id = $1
      ORDER BY p.month DESC, s.first_name, s.last_name
    `, [req.user!.userId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Payments fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// Get payment history for a specific student (parents only)
router.get('/:student_id/history', authenticateToken, requireRole('parent'), async (req: AuthRequest, res) => {
  try {
    const { student_id } = req.params;

    // Verify student belongs to this parent
    const studentCheck = await pool.query(
      'SELECT id FROM "Student" WHERE id = $1 AND parent_id = $2',
      [student_id, req.user!.userId]
    );

    if (studentCheck.rows.length === 0) {
      res.status(403).json({ error: 'Student not found or access denied' });
      return;
    }

    const result = await pool.query(`
      SELECT id, month, amount, paid, payment_date, payment_method, notes
      FROM "Payment"
      WHERE student_id = $1
      ORDER BY month DESC
      LIMIT 3
    `, [student_id]);

    res.json(result.rows);
  } catch (error) {
    console.error('Payment history fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch payment history' });
  }
});

export default router;