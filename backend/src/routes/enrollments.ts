// backend/src/routes/enrollments.ts

import express from 'express';
import { pool } from '../index';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Get enrollments for parent's students (parents only)
router.get('/my-students', authenticateToken, requireRole('parent'), async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(`
      SELECT e.id, e.student_id, e.class_id, e.enrolled_at, e.status, e.cancelled_at,
             CONCAT(s.first_name, ' ', s.last_name) as student_name,
             c.subject, c.start_time, c.duration_minutes,
             b.name as branch_name, b.address as branch_address,
             u.first_name as tutor_first_name, u.last_name as tutor_last_name
      FROM "Enrollment" e
      JOIN "Student" s ON e.student_id = s.id
      JOIN "Class" c ON e.class_id = c.id
      LEFT JOIN "Branch" b ON c.branch_id = b.id
      LEFT JOIN "User" u ON c.tutor_id = u.id
      WHERE s.parent_id = $1 AND s.active = TRUE AND c.active = TRUE
      ORDER BY c.start_time DESC
    `, [req.user!.userId]);

    res.json(result.rows);

  } catch (error) {
    console.error('Get enrollments error:', error);
    res.status(500).json({ error: 'Failed to fetch enrollments' });
  }
});

// Get all enrollments for a specific class (staff only)
router.get('/class/:classId', authenticateToken, requireRole('staff'), async (req: AuthRequest, res) => {
  try {
    const { classId } = req.params;

    const result = await pool.query(`
      SELECT e.id, e.student_id, e.enrolled_at, e.status, e.cancelled_at,
             CONCAT(s.first_name, ' ', s.last_name) as student_name, s.grade,
             u.first_name as parent_first_name, u.last_name as parent_last_name, u.email as parent_email
      FROM "Enrollment" e
      JOIN "Student" s ON e.student_id = s.id
      JOIN "User" u ON s.parent_id = u.id
      WHERE e.class_id = $1 AND s.active = TRUE AND u.active = TRUE
      ORDER BY e.enrolled_at ASC
    `, [classId]);

    res.json(result.rows);

  } catch (error) {
    console.error('Get class enrollments error:', error);
    res.status(500).json({ error: 'Failed to fetch class enrollments' });
  }
});

// Enroll a student in a class (parents only)
router.post('/', authenticateToken, requireRole('parent'), async (req: AuthRequest, res) => {
  try {
    const { studentId, classId } = req.body;

    if (!studentId || !classId) {
      res.status(400).json({ error: 'Student ID and Class ID are required' });
      return;
    }

    // Verify student belongs to this parent and get student details
    const studentCheck = await pool.query(
      'SELECT id, first_name, last_name, grade FROM "Student" WHERE id = $1 AND parent_id = $2 AND active = TRUE',
      [studentId, req.user!.userId]
    );

    if (studentCheck.rows.length === 0) {
      res.status(403).json({ error: 'Student not found or access denied' });
      return;
    }

    const student = studentCheck.rows[0];

    // Verify class exists and is in the future (within 1 month)
    const oneMonthFromNow = new Date();
    oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);

    const classCheck = await pool.query(`
      SELECT c.id, c.subject, c.level, c.start_time, c.capacity,
             COUNT(e.id) as enrolled_count
      FROM "Class" c
      LEFT JOIN "Enrollment" e ON c.id = e.class_id 
        AND e.status = 'enrolled'
        AND EXISTS (
          SELECT 1 FROM "Student" s 
          WHERE s.id = e.student_id AND s.active = TRUE
        )
      WHERE c.id = $1 AND c.active = TRUE 
        AND c.start_time > NOW() 
        AND c.start_time <= $2
      GROUP BY c.id, c.subject, c.level, c.start_time, c.capacity
    `, [classId, oneMonthFromNow]);

    if (classCheck.rows.length === 0) {
      res.status(400).json({ error: 'Class not found, has started, or is more than 1 month away' });
      return;
    }

    const classInfo = classCheck.rows[0];

    // Check if student's grade matches class level or class allows mixed levels
    const studentGrade = student.grade;
    const classLevel = classInfo.level;
    
    if (classLevel !== 'Mixed Levels' && studentGrade !== classLevel) {
      res.status(400).json({ 
        error: `Student grade (${studentGrade}) does not match class level (${classLevel}). Students can only enroll in classes for their grade level or Mixed Levels classes.` 
      });
      return;
    }

    // Check if class is full
    if (parseInt(classInfo.enrolled_count) >= classInfo.capacity) {
      res.status(400).json({ error: 'Class is full' });
      return;
    }

    // Check if student is already enrolled (only check active enrollments)
    const activeEnrollmentCheck = await pool.query(
      'SELECT id FROM "Enrollment" WHERE student_id = $1 AND class_id = $2 AND status = $3',
      [studentId, classId, 'enrolled']
    );

    if (activeEnrollmentCheck.rows.length > 0) {
      res.status(400).json({ error: 'Student is already enrolled in this class' });
      return;
    }

    // Create enrollment
    const result = await pool.query(`
      INSERT INTO "Enrollment" (student_id, class_id, enrolled_by, status)
      VALUES ($1, $2, $3, $4)
      RETURNING id, enrolled_at, status
    `, [studentId, classId, req.user!.userId, 'enrolled']);

    const studentFullName = `${student.first_name} ${student.last_name}`;

    res.status(201).json({
      message: `${studentFullName} enrolled in ${classInfo.subject} successfully`,
      enrollment: result.rows[0]
    });

  } catch (error) {
    console.error('Create enrollment error:', error);
    res.status(500).json({ error: 'Failed to enroll student' });
  }
});

// Cancel an enrollment (parents only, only future classes)
router.delete('/:enrollmentId', authenticateToken, requireRole('parent'), async (req: AuthRequest, res) => {
  try {
    const { enrollmentId } = req.params;

    // Verify enrollment belongs to this parent and class is in the future
    const enrollmentCheck = await pool.query(`
      SELECT e.id, e.student_id, e.class_id, e.status,
             CONCAT(s.first_name, ' ', s.last_name) as student_name,
             c.subject, c.start_time
      FROM "Enrollment" e
      JOIN "Student" s ON e.student_id = s.id
      JOIN "Class" c ON e.class_id = c.id
      WHERE e.id = $1 AND s.parent_id = $2 AND e.status = 'enrolled' AND c.start_time > NOW()
    `, [enrollmentId, req.user!.userId]);

    if (enrollmentCheck.rows.length === 0) {
      res.status(404).json({ error: 'Enrollment not found, access denied, or class has already started' });
      return;
    }

    const enrollment = enrollmentCheck.rows[0];

    // Update enrollment status to cancelled
    await pool.query(`
      UPDATE "Enrollment" 
      SET status = 'cancelled', cancelled_at = NOW()
      WHERE id = $1
    `, [enrollmentId]);

    res.json({
      message: `Enrollment cancelled: ${enrollment.student_name} removed from ${enrollment.subject}`
    });

  } catch (error) {
    console.error('Cancel enrollment error:', error);
    res.status(500).json({ error: 'Failed to cancel enrollment' });
  }
});

// Get enrollment details (for both parents and staff)
router.get('/:enrollmentId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { enrollmentId } = req.params;

    let query = `
      SELECT e.id, e.student_id, e.class_id, e.enrolled_at, e.status, e.cancelled_at,
             CONCAT(s.first_name, ' ', s.last_name) as student_name, s.grade,
             c.subject, c.start_time, c.duration_minutes,
             b.name as branch_name, b.address as branch_address,
             u.first_name as tutor_first_name, u.last_name as tutor_last_name
      FROM "Enrollment" e
      JOIN "Student" s ON e.student_id = s.id
      JOIN "Class" c ON e.class_id = c.id
      LEFT JOIN "Branch" b ON c.branch_id = b.id
      LEFT JOIN "User" u ON c.tutor_id = u.id
      WHERE e.id = $1 AND s.active = TRUE AND c.active = TRUE
    `;

    const queryParams = [enrollmentId];

    // If parent, restrict to their students only
    if (req.user!.role === 'parent') {
      query += ' AND s.parent_id = $2';
      queryParams.push(req.user!.userId);
    }

    const result = await pool.query(query, queryParams);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Enrollment not found' });
      return;
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error('Get enrollment error:', error);
    res.status(500).json({ error: 'Failed to fetch enrollment' });
  }
});

export default router;