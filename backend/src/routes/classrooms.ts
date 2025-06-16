// backend/src/routes/classrooms.ts

import express from 'express';
import { pool } from '../index';
import { authenticateToken, requireRole, requireAnyRole, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Get all classrooms for a specific branch (admin/staff only)
router.get('/branch/:branchId', authenticateToken, requireAnyRole('admin', 'staff'), async (req: AuthRequest, res) => {
  try {
    const { branchId } = req.params;
    const userRole = req.user!.role;
    
    // For admins, show all classrooms (active and inactive)
    // For staff, show only active classrooms
    const activeFilter = userRole === 'admin' ? '' : 'AND c.active = TRUE';
    
    const result = await pool.query(`
      SELECT 
        c.id,
        c.room_name,
        c.description,
        c.room_capacity,
        c.branch_id,
        c.active,
        c.created_at,
        c.updated_at,
        b.name as branch_name,
        COUNT(cl.id) as active_classes_count
      FROM "Classroom" c
      JOIN "Branch" b ON c.branch_id = b.id
      LEFT JOIN "Class" cl ON c.id = cl.classroom_id AND cl.active = TRUE
      WHERE c.branch_id = $1 ${activeFilter}
      GROUP BY c.id, b.name
      ORDER BY c.active DESC, c.room_name
    `, [branchId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Get classrooms by branch error:', error);
    res.status(500).json({ error: 'Failed to fetch classrooms' });
  }
});

// Get all classrooms across all branches (admin only)
router.get('/all', authenticateToken, requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        c.id,
        c.room_name,
        c.description,
        c.room_capacity,
        c.branch_id,
        c.active,
        c.created_at,
        c.updated_at,
        b.name as branch_name,
        COUNT(cl.id) as active_classes_count
      FROM "Classroom" c
      JOIN "Branch" b ON c.branch_id = b.id
      LEFT JOIN "Class" cl ON c.id = cl.classroom_id AND cl.active = TRUE
      GROUP BY c.id, b.name
      ORDER BY b.name, c.room_name
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Get all classrooms error:', error);
    res.status(500).json({ error: 'Failed to fetch all classrooms' });
  }
});

// Get a specific classroom (admin/staff only)
router.get('/:id', authenticateToken, requireAnyRole('admin', 'staff'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT 
        c.id,
        c.room_name,
        c.description,
        c.room_capacity,
        c.branch_id,
        c.active,
        c.created_at,
        c.updated_at,
        b.name as branch_name
      FROM "Classroom" c
      JOIN "Branch" b ON c.branch_id = b.id
      WHERE c.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Classroom not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get classroom error:', error);
    res.status(500).json({ error: 'Failed to fetch classroom' });
  }
});

// Get classroom availability for scheduling (admin/staff only)
router.get('/:id/availability', authenticateToken, requireAnyRole('admin', 'staff'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { date, exclude_class_id } = req.query;

    if (!date) {
      res.status(400).json({ error: 'Date parameter is required' });
      return;
    }

    // Get classroom details
    const classroomResult = await pool.query(`
      SELECT room_name, room_capacity, branch_id
      FROM "Classroom"
      WHERE id = $1 AND active = TRUE
    `, [id]);

    if (classroomResult.rows.length === 0) {
      res.status(404).json({ error: 'Classroom not found' });
      return;
    }

    const classroom = classroomResult.rows[0];

    // Get existing classes for that date with level information
    let query = `
      SELECT 
        c.id,
        c.subject,
        c.level,
        c.start_time,
        c.end_time,
        c.capacity,
        CONCAT(u.first_name, ' ', u.last_name) as tutor_name
      FROM "Class" c
      LEFT JOIN "User" u ON c.tutor_id = u.id
      WHERE c.classroom_id = $1 
        AND DATE(c.start_time) = DATE($2)
        AND c.active = TRUE
    `;
    
    const params = [id, date];
    
    if (exclude_class_id) {
      query += ' AND c.id != $3';
      params.push(exclude_class_id as string);
    }
    
    query += ' ORDER BY c.start_time';

    const classesResult = await pool.query(query, params);

    res.json({
      classroom,
      occupied_slots: classesResult.rows
    });
  } catch (error) {
    console.error('Get classroom availability error:', error);
    res.status(500).json({ error: 'Failed to fetch classroom availability' });
  }
});

// Create a new classroom (admin only)
router.post('/', authenticateToken, requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const { room_name, description, room_capacity, branch_id } = req.body;

    // Validation
    if (!room_name || room_name.trim().length < 1) {
      res.status(400).json({ error: 'Room name is required' });
      return;
    }

    if (!room_capacity || room_capacity < 1) {
      res.status(400).json({ error: 'Room capacity must be at least 1' });
      return;
    }

    if (!branch_id) {
      res.status(400).json({ error: 'Branch ID is required' });
      return;
    }

    // Check if branch exists and is active
    const branchCheck = await pool.query(
      'SELECT id, name FROM "Branch" WHERE id = $1 AND active = TRUE',
      [branch_id]
    );

    if (branchCheck.rows.length === 0) {
      res.status(404).json({ error: 'Branch not found or inactive' });
      return;
    }

    // Check for duplicate room name in the same branch
    const duplicateCheck = await pool.query(
      'SELECT id FROM "Classroom" WHERE LOWER(room_name) = LOWER($1) AND branch_id = $2',
      [room_name.trim(), branch_id]
    );

    if (duplicateCheck.rows.length > 0) {
      res.status(409).json({ error: 'A classroom with this name already exists in this branch' });
      return;
    }

    const result = await pool.query(`
      INSERT INTO "Classroom" (room_name, description, room_capacity, branch_id)
      VALUES ($1, $2, $3, $4)
      RETURNING id, room_name, description, room_capacity, branch_id, active, created_at, updated_at
    `, [room_name.trim(), description?.trim() || null, room_capacity, branch_id]);

    res.status(201).json({
      message: 'Classroom created successfully',
      classroom: {
        ...result.rows[0],
        branch_name: branchCheck.rows[0].name
      }
    });

  } catch (error) {
    console.error('Create classroom error:', error);
    res.status(500).json({ error: 'Failed to create classroom' });
  }
});

// Update a classroom (admin only)
router.put('/:id', authenticateToken, requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { room_name, description, room_capacity, active } = req.body;

    // Check if classroom exists
    const classroomCheck = await pool.query(`
      SELECT c.id, c.branch_id, c.room_capacity, b.name as branch_name
      FROM "Classroom" c
      JOIN "Branch" b ON c.branch_id = b.id
      WHERE c.id = $1
    `, [id]);

    if (classroomCheck.rows.length === 0) {
      res.status(404).json({ error: 'Classroom not found' });
      return;
    }

    const existingClassroom = classroomCheck.rows[0];

    // Validation
    if (room_name && room_name.trim().length < 1) {
      res.status(400).json({ error: 'Room name cannot be empty' });
      return;
    }

    if (room_capacity && room_capacity < 1) {
      res.status(400).json({ error: 'Room capacity must be at least 1' });
      return;
    }

    // If reducing capacity, check if it would violate existing class capacities
    if (room_capacity && room_capacity < existingClassroom.room_capacity) {
      const classesCheck = await pool.query(`
        SELECT COUNT(*) as count, MAX(capacity) as max_capacity
        FROM "Class"
        WHERE classroom_id = $1 AND capacity > $2 AND active = TRUE
      `, [id, room_capacity]);

      if (parseInt(classesCheck.rows[0].count) > 0) {
        res.status(400).json({ 
          error: `Cannot reduce room capacity below ${classesCheck.rows[0].max_capacity}. There are existing classes with higher capacity limits.` 
        });
        return;
      }
    }

    // Check for duplicate room name if name is being updated
    if (room_name && room_name.trim() !== '') {
      const duplicateCheck = await pool.query(
        'SELECT id FROM "Classroom" WHERE LOWER(room_name) = LOWER($1) AND branch_id = $2 AND id != $3',
        [room_name.trim(), existingClassroom.branch_id, id]
      );

      if (duplicateCheck.rows.length > 0) {
        res.status(409).json({ error: 'A classroom with this name already exists in this branch' });
        return;
      }
    }

    const result = await pool.query(`
      UPDATE "Classroom" 
      SET room_name = COALESCE($1, room_name),
          description = COALESCE($2, description),
          room_capacity = COALESCE($3, room_capacity),
          active = COALESCE($4, active),
          updated_at = NOW()
      WHERE id = $5
      RETURNING id, room_name, description, room_capacity, branch_id, active, created_at, updated_at
    `, [room_name?.trim(), description?.trim(), room_capacity, active, id]);

    res.json({
      message: 'Classroom updated successfully',
      classroom: {
        ...result.rows[0],
        branch_name: existingClassroom.branch_name
      }
    });

  } catch (error) {
    console.error('Update classroom error:', error);
    res.status(500).json({ error: 'Failed to update classroom' });
  }
});

// Check classroom deletion impact (admin only)
router.get('/:id/deletion-impact', authenticateToken, requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    // Get classroom info
    const classroomResult = await pool.query(`
      SELECT c.room_name, c.description, c.room_capacity, b.name as branch_name
      FROM "Classroom" c
      JOIN "Branch" b ON c.branch_id = b.id
      WHERE c.id = $1
    `, [id]);

    if (classroomResult.rows.length === 0) {
      res.status(404).json({ error: 'Classroom not found' });
      return;
    }

    const classroom = classroomResult.rows[0];

    // Get impact data
    const [classesResult, enrollmentsResult, attendanceResult] = await Promise.all([
      // Classes using this classroom
      pool.query(`
        SELECT COUNT(*) as total_count,
               COUNT(CASE WHEN start_time > NOW() THEN 1 END) as future_count,
               COUNT(CASE WHEN start_time <= NOW() THEN 1 END) as past_count
        FROM "Class" 
        WHERE classroom_id = $1 AND active = TRUE
      `, [id]),
      
      // Enrollments affected
      pool.query(`
        SELECT COUNT(DISTINCT e.id) as count
        FROM "Enrollment" e
        JOIN "Class" c ON e.class_id = c.id
        WHERE c.classroom_id = $1 AND c.active = TRUE AND e.status = 'enrolled'
      `, [id]),
      
      // Attendance records affected
      pool.query(`
        SELECT COUNT(*) as count
        FROM "Attendance" a
        JOIN "Class" c ON a.class_id = c.id
        WHERE c.classroom_id = $1 AND c.active = TRUE
      `, [id])
    ]);

    const totalClasses = parseInt(classesResult.rows[0].total_count);
    const futureClasses = parseInt(classesResult.rows[0].future_count);
    const pastClasses = parseInt(classesResult.rows[0].past_count);
    const enrollmentsCount = parseInt(enrollmentsResult.rows[0].count);
    const attendanceCount = parseInt(attendanceResult.rows[0].count);

    const warningParts = [];
    if (totalClasses > 0) {
      warningParts.push(`${totalClasses} classes will have their classroom assignment removed`);
    }
    if (enrollmentsCount > 0) {
      warningParts.push(`${enrollmentsCount} student enrollments affected`);
    }
    if (attendanceCount > 0) {
      warningParts.push(`${attendanceCount} attendance records affected`);
    }

    const warning = warningParts.length > 0 
      ? `IMPACT: ${warningParts.join(', ')}.`
      : null;

    res.json({
      classroom,
      impact: {
        totalClasses,
        futureClasses,
        pastClasses,
        enrollmentsAffected: enrollmentsCount,
        attendanceRecordsAffected: attendanceCount,
        warning
      }
    });

  } catch (error) {
    console.error('Check classroom deletion impact error:', error);
    res.status(500).json({ error: 'Failed to check deletion impact' });
  }
});

// Delete a classroom (admin only)
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
    
    // Get classroom info for logging
    const classroomResult = await client.query(`
      SELECT c.room_name, c.description, b.name as branch_name
      FROM "Classroom" c
      JOIN "Branch" b ON c.branch_id = b.id
      WHERE c.id = $1
    `, [id]);
    
    if (classroomResult.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Classroom not found' });
      return;
    }
    
    const classroom = classroomResult.rows[0];
    
    // Delete the classroom - classes will automatically have classroom_id set to NULL due to foreign key constraint
    await client.query('DELETE FROM "Classroom" WHERE id = $1', [id]);
    
    await client.query('COMMIT');
    
    res.json({
      message: 'Classroom deleted successfully',
      deleted: {
        room_name: classroom.room_name,
        branch_name: classroom.branch_name
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete classroom error:', error);
    res.status(500).json({ error: 'Failed to delete classroom' });
  } finally {
    client.release();
  }
});

export default router;