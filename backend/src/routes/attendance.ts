// backend/src/routes/attendance.ts

import express from 'express';
import { pool } from '../index';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Get classes with enrolled students for a staff member (staff only)
router.get('/my-classes', authenticateToken, requireRole('staff'), async (req: AuthRequest, res) => {
  try {
    const staffId = req.user!.userId;
    
    const result = await pool.query(`
      SELECT DISTINCT c.id as class_id, c.subject, c.description, c.level, c.start_time, c.duration_minutes,
             b.name as branch_name, b.address as branch_address,
             COUNT(e.id) as enrolled_count
      FROM "Class" c
      LEFT JOIN "Branch" b ON c.branch_id = b.id
      LEFT JOIN "Enrollment" e ON c.id = e.class_id AND e.status = 'enrolled'
      LEFT JOIN "Student" s ON e.student_id = s.id AND s.active = TRUE
      WHERE c.tutor_id = $1 AND c.active = TRUE
      GROUP BY c.id, c.subject, c.description, c.level, c.start_time, c.duration_minutes, b.name, b.address
      ORDER BY c.start_time DESC
    `, [staffId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Get staff classes error:', error);
    res.status(500).json({ error: 'Failed to fetch classes' });
  }
});

// Get enrolled students for a specific class (staff only - must be assigned to the class)
router.get('/class/:classId/students', authenticateToken, requireRole('staff'), async (req: AuthRequest, res) => {
  try {
    const { classId } = req.params;
    const staffId = req.user!.userId;
    
    // Verify this staff member is assigned to this class
    const classCheck = await pool.query(
      'SELECT id FROM "Class" WHERE id = $1 AND tutor_id = $2 AND active = TRUE',
      [classId, staffId]
    );
    
    if (classCheck.rows.length === 0) {
      res.status(403).json({ error: 'Access denied or class not found' });
      return;
    }
    
    const result = await pool.query(`
      SELECT e.id as enrollment_id, e.student_id, e.enrolled_at,
             s.first_name, s.last_name, s.grade,
             u.first_name as parent_first_name, u.last_name as parent_last_name, u.email as parent_email
      FROM "Enrollment" e
      JOIN "Student" s ON e.student_id = s.id
      JOIN "User" u ON s.parent_id = u.id
      WHERE e.class_id = $1 AND e.status = 'enrolled' AND s.active = TRUE AND u.active = TRUE
      ORDER BY s.first_name, s.last_name
    `, [classId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Get class students error:', error);
    res.status(500).json({ error: 'Failed to fetch class students' });
  }
});

// Get attendance records for a specific class and date (staff only)
router.get('/class/:classId/date/:date', authenticateToken, requireRole('staff'), async (req: AuthRequest, res) => {
  try {
    const { classId, date } = req.params;
    const staffId = req.user!.userId;
    
    // Verify this staff member is assigned to this class
    const classCheck = await pool.query(
      'SELECT id FROM "Class" WHERE id = $1 AND tutor_id = $2 AND active = TRUE',
      [classId, staffId]
    );
    
    if (classCheck.rows.length === 0) {
      res.status(403).json({ error: 'Access denied or class not found' });
      return;
    }
    
    // Validate date format
    const attendanceDate = new Date(date);
    if (isNaN(attendanceDate.getTime())) {
      res.status(400).json({ error: 'Invalid date format' });
      return;
    }
    
    const result = await pool.query(`
      SELECT a.id, a.enrollment_id, a.student_id, a.status, a.time_in, a.time_out, a.notes, a.marked_at,
             s.first_name, s.last_name, s.grade,
             e.id as enrollment_id_check
      FROM "Attendance" a
      JOIN "Student" s ON a.student_id = s.id
      JOIN "Enrollment" e ON a.enrollment_id = e.id
      WHERE a.class_id = $1 AND a.date = $2 AND s.active = TRUE
      ORDER BY s.first_name, s.last_name
    `, [classId, date]);

    res.json(result.rows);
  } catch (error) {
    console.error('Get attendance records error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance records' });
  }
});

// Mark or update attendance for multiple students (staff only)
router.post('/class/:classId/date/:date/mark', authenticateToken, requireRole('staff'), async (req: AuthRequest, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { classId, date } = req.params;
    const { attendanceRecords } = req.body; // Array of { enrollmentId, studentId, status, timeIn?, timeOut?, notes? }
    const staffId = req.user!.userId;
    
    // Debug logging
    console.log('Attendance request received:', {
      classId,
      date,
      staffId,
      recordsCount: attendanceRecords?.length,
      records: attendanceRecords
    });
    
    // Verify this staff member is assigned to this class
    const classCheck = await client.query(
      'SELECT id, subject FROM "Class" WHERE id = $1 AND tutor_id = $2 AND active = TRUE',
      [classId, staffId]
    );
    
    if (classCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(403).json({ error: 'Access denied or class not found' });
      return;
    }
    
    // Validate date format
    const attendanceDate = new Date(date);
    if (isNaN(attendanceDate.getTime())) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'Invalid date format' });
      return;
    }
    
    // Validate input
    if (!attendanceRecords) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'Missing attendance records in request body' });
      return;
    }
    
    if (!Array.isArray(attendanceRecords)) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'Attendance records must be an array' });
      return;
    }
    
    if (attendanceRecords.length === 0) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'Attendance records array cannot be empty' });
      return;
    }
    
    const validStatuses = ['present', 'absent', 'late', 'excused'];
    for (let i = 0; i < attendanceRecords.length; i++) {
      const record = attendanceRecords[i];
      
      if (!record.enrollmentId) {
        await client.query('ROLLBACK');
        res.status(400).json({ 
          error: `Missing enrollmentId in record ${i + 1}`,
          record: record
        });
        return;
      }
      
      if (!record.studentId) {
        await client.query('ROLLBACK');
        res.status(400).json({ 
          error: `Missing studentId in record ${i + 1}`,
          record: record
        });
        return;
      }
      
      if (!record.status) {
        await client.query('ROLLBACK');
        res.status(400).json({ 
          error: `Missing status in record ${i + 1}`,
          record: record
        });
        return;
      }
      
      if (!validStatuses.includes(record.status)) {
        await client.query('ROLLBACK');
        res.status(400).json({ 
          error: `Invalid status "${record.status}" in record ${i + 1}. Valid statuses: ${validStatuses.join(', ')}`,
          record: record
        });
        return;
      }
    }
    
    const updatedRecords = [];
    
    for (const record of attendanceRecords) {
      // Upsert attendance record
      const result = await client.query(`
        INSERT INTO "Attendance" (student_id, class_id, enrollment_id, date, status, time_in, time_out, notes, marked_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (enrollment_id, date)
        DO UPDATE SET 
          status = EXCLUDED.status,
          time_in = EXCLUDED.time_in,
          time_out = EXCLUDED.time_out,
          notes = EXCLUDED.notes,
          marked_by = EXCLUDED.marked_by,
          marked_at = NOW()
        RETURNING id, status, time_in, time_out, notes, marked_at
      `, [
        record.studentId,
        classId,
        record.enrollmentId,
        date,
        record.status,
        record.timeIn || null,
        record.timeOut || null,
        record.notes || null,
        staffId
      ]);
      
      updatedRecords.push({
        enrollmentId: record.enrollmentId,
        studentId: record.studentId,
        ...result.rows[0]
      });
    }
    
    await client.query('COMMIT');
    
    res.json({
      message: `Attendance marked for ${attendanceRecords.length} student(s) in ${classCheck.rows[0].subject}`,
      records: updatedRecords
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Mark attendance error:', error);
    res.status(500).json({ error: 'Failed to mark attendance' });
  } finally {
    client.release();
  }
});

// Get attendance summary for a class (staff only)
router.get('/class/:classId/summary', authenticateToken, requireRole('staff'), async (req: AuthRequest, res) => {
  try {
    const { classId } = req.params;
    const { startDate, endDate } = req.query;
    const staffId = req.user!.userId;
    
    // Verify this staff member is assigned to this class
    const classCheck = await pool.query(
      'SELECT id, subject, start_time FROM "Class" WHERE id = $1 AND tutor_id = $2 AND active = TRUE',
      [classId, staffId]
    );
    
    if (classCheck.rows.length === 0) {
      res.status(403).json({ error: 'Access denied or class not found' });
      return;
    }
    
    let dateFilter = '';
    const queryParams = [classId];
    let paramIndex = 2;
    
    if (startDate) {
      dateFilter += ` AND a.date >= $${paramIndex}`;
      queryParams.push(startDate as string);
      paramIndex++;
    }
    
    if (endDate) {
      dateFilter += ` AND a.date <= $${paramIndex}`;
      queryParams.push(endDate as string);
      paramIndex++;
    }
    
    const result = await pool.query(`
      SELECT 
        COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_count,
        COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent_count,
        COUNT(CASE WHEN a.status = 'late' THEN 1 END) as late_count,
        COUNT(CASE WHEN a.status = 'excused' THEN 1 END) as excused_count,
        COUNT(a.id) as total_records,
        COUNT(DISTINCT a.date) as days_recorded,
        COUNT(DISTINCT a.student_id) as unique_students
      FROM "Attendance" a
      JOIN "Student" s ON a.student_id = s.id AND s.active = TRUE
      WHERE a.class_id = $1 ${dateFilter}
    `, queryParams);
    
    res.json({
      classInfo: classCheck.rows[0],
      summary: result.rows[0]
    });
    
  } catch (error) {
    console.error('Get attendance summary error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance summary' });
  }
});

export default router;