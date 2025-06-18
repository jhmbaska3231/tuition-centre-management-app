// backend/src/routes/classes.ts

import express from 'express';
import { pool } from '../index';
import { authenticateToken, requireRole, requireAnyRole, AuthRequest } from '../middleware/auth';
import { validateClass } from '../middleware/validation';

const router = express.Router();

// Helper function to check for comprehensive teacher schedule conflicts (including travel time)
const checkComprehensiveTeacherScheduleConflict = async (
  tutorId: string, 
  startTime: string, 
  durationMinutes: number, 
  branchId: string,
  excludeClassId?: string
): Promise<{ hasConflict: boolean; conflicts: { direct: any[], travel: any[] } }> => {
  try {
    const classStartTime = new Date(startTime);
    const classEndTime = new Date(classStartTime.getTime() + (durationMinutes * 60 * 1000));

    // Get all existing classes for this tutor on the same date
    const dateStart = new Date(classStartTime);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(classStartTime);
    dateEnd.setHours(23, 59, 59, 999);

    let query = `
      SELECT c.id, c.subject, c.level, c.start_time, c.duration_minutes, c.branch_id,
             b.name as branch_name
      FROM "Class" c
      LEFT JOIN "Branch" b ON c.branch_id = b.id
      WHERE c.tutor_id = $1 
        AND c.active = TRUE 
        AND c.start_time >= $2
        AND c.start_time <= $3
    `;
    
    const queryParams = [tutorId, dateStart.toISOString(), dateEnd.toISOString()];
    
    // If editing an existing class, exclude it from the conflict check
    if (excludeClassId) {
      query += ' AND c.id != $4';
      queryParams.push(excludeClassId);
    }
    
    query += ' ORDER BY c.start_time';

    const result = await pool.query(query, queryParams);

    const directConflicts = [];
    const travelConflicts = [];

    for (const existingClass of result.rows) {
      const existingStart = new Date(existingClass.start_time);
      const existingEnd = new Date(existingStart.getTime() + (existingClass.duration_minutes * 60 * 1000));

      // Check for direct time overlap
      const hasDirectOverlap = (classStartTime < existingEnd && classEndTime > existingStart);
      
      if (hasDirectOverlap) {
        directConflicts.push({
          ...existingClass,
          end_time: existingEnd.toISOString()
        });
        continue; // Don't check travel time if there's direct conflict
      }

      // Check for travel time conflicts (only if different branches)
      if (branchId !== existingClass.branch_id) {
        const oneHourBefore = new Date(classStartTime.getTime() - 60 * 60 * 1000); // 1 hour before new class
        const oneHourAfter = new Date(classEndTime.getTime() + 60 * 60 * 1000); // 1 hour after new class

        // Check if existing class ends too close to new class start (need 1 hour to travel)
        const existingEndsTooClose = existingEnd > oneHourBefore && existingEnd <= classStartTime;
        
        // Check if existing class starts too close to new class end (need 1 hour to travel)
        const existingStartsTooClose = existingStart >= classEndTime && existingStart < oneHourAfter;

        if (existingEndsTooClose || existingStartsTooClose) {
          travelConflicts.push({
            ...existingClass,
            end_time: existingEnd.toISOString()
          });
        }
      }
    }

    const hasConflict = directConflicts.length > 0 || travelConflicts.length > 0;
    
    return {
      hasConflict,
      conflicts: {
        direct: directConflicts,
        travel: travelConflicts
      }
    };
  } catch (error) {
    console.error('Error checking comprehensive teacher schedule conflict:', error);
    throw new Error('Failed to check teacher availability');
  }
};

// Helper function to format comprehensive conflict error message
const formatComprehensiveConflictErrorMessage = (conflicts: { direct: any[], travel: any[] }): string => {
  const formatTime = (timeString: string): string => {
    const date = new Date(timeString);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  let message = '';
  
  if (conflicts.direct.length > 0) {
    const conflictDetails = conflicts.direct.map(conflict => {
      const startTime = formatTime(conflict.start_time);
      const endTime = formatTime(conflict.end_time);
      const levelText = conflict.level ? ` (${conflict.level})` : '';
      const branchText = conflict.branch_name ? ` at ${conflict.branch_name}` : '';
      
      return `• "${conflict.subject}"${levelText} from ${startTime} to ${endTime}${branchText}`;
    }).join('\n');

    const conflictCount = conflicts.direct.length;
    const conflictWord = conflictCount === 1 ? 'class' : 'classes';
    
    message += `You already have ${conflictCount} ${conflictWord} scheduled at the same time:\n\n${conflictDetails}`;
  }
  
  if (conflicts.travel.length > 0) {
    if (message) message += '\n\n';
    
    const travelDetails = conflicts.travel.map(conflict => {
      const startTime = formatTime(conflict.start_time);
      const endTime = formatTime(conflict.end_time);
      const levelText = conflict.level ? ` (${conflict.level})` : '';
      const branchText = conflict.branch_name ? ` at ${conflict.branch_name}` : '';
      
      return `• "${conflict.subject}"${levelText} from ${startTime} to ${endTime}${branchText}`;
    }).join('\n');

    const conflictCount = conflicts.travel.length;
    const conflictWord = conflictCount === 1 ? 'class' : 'classes';
    
    message += `You have ${conflictCount} ${conflictWord} at different branch(es) that require at least 1 hour buffer time:\n\n${travelDetails}`;
  }
  
  return message;
};

// Get all active classes (available to parents, staff, and admin with different permissions)
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { branchId, startDate, endDate } = req.query;
    const userRole = req.user!.role;
    const userId = req.user!.userId;

    let query = `
      SELECT c.id, c.subject, c.description, c.level, c.start_time, c.duration_minutes, c.capacity, 
             c.active, c.created_at, c.updated_at,
             c.end_time, c.tutor_id, c.branch_id, c.classroom_id,
             b.name as branch_name, b.address as branch_address,
             cr.room_name as classroom_name,
             u.first_name as tutor_first_name, u.last_name as tutor_last_name,
             COALESCE(enrolled_count.count, 0) as enrolled_count
      FROM "Class" c
      LEFT JOIN "Branch" b ON c.branch_id = b.id
      LEFT JOIN "Classroom" cr ON c.classroom_id = cr.id
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
      const childrenGrades = await pool.query(
        'SELECT DISTINCT grade FROM "Student" WHERE parent_id = $1 AND active = TRUE',
        [userId]
      );
      
      // Only show classes that match children's grades or are Mixed Levels
      if (childrenGrades.rows.length > 0) {
        const grades = childrenGrades.rows.map(row => row.grade);
        // Create individual placeholders: $1, $2, $3, etc
        const placeholders = grades.map((_, i) => `$${paramIndex + i}`).join(', ');
        query += ` AND (c.level = 'Mixed Levels' OR c.level IN (${placeholders}))`;
        queryParams.push(...grades);  // Spreads individual grades
        paramIndex += grades.length;  // Increments by number of grades
      }
    }

    // Add branch filter if specified
    if (branchId) {
      query += ` AND c.branch_id = $${paramIndex}`;
      queryParams.push(branchId as string);
      paramIndex++;
    }

    // Add date range filters if specified
    if (startDate) {
      query += ` AND DATE(c.start_time) >= $${paramIndex}`;
      queryParams.push(startDate as string);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND DATE(c.start_time) <= $${paramIndex}`;
      queryParams.push(endDate as string);
      paramIndex++;
    }

    query += ' ORDER BY c.start_time';

    const result = await pool.query(query, queryParams);

    const classes = result.rows.map(row => ({
      ...row,
      enrolled_count: parseInt(row.enrolled_count) || 0,
      can_edit: userRole === 'admin' || (userRole === 'staff' && row.tutor_id === userId),
      can_delete: userRole === 'admin' || (userRole === 'staff' && row.tutor_id === userId)
    }));

    res.json(classes);

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
             c.active, c.created_at, c.updated_at, c.end_time, c.tutor_id, c.branch_id, c.classroom_id,
             b.name as branch_name, b.address as branch_address,
             cr.room_name as classroom_name,
             u.first_name as tutor_first_name, u.last_name as tutor_last_name,
             COALESCE(enrolled_count.count, 0) as enrolled_count
      FROM "Class" c
      LEFT JOIN "Branch" b ON c.branch_id = b.id
      LEFT JOIN "Classroom" cr ON c.classroom_id = cr.id
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
      enrolled_count: parseInt(classItem.enrolled_count) || 0,
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
    const { subject, description, level, startTime, durationMinutes, capacity, branchId, classroomId } = req.body;
    const userRole = req.user!.role;
    const userId = req.user!.userId;

    // Validate required fields
    if (!subject || subject.trim().length === 0) {
      res.status(400).json({ error: 'Subject is required' });
      return;
    }

    if (!level || level.trim().length === 0) {
      res.status(400).json({ error: 'Level/Grade is required' });
      return;
    }

    if (!startTime) {
      res.status(400).json({ error: 'Start time is required' });
      return;
    }

    if (!durationMinutes || durationMinutes < 15) {
      res.status(400).json({ error: 'Duration must be at least 15 minutes' });
      return;
    }

    if (!capacity || capacity < 1) {
      res.status(400).json({ error: 'Capacity must be at least 1' });
      return;
    }

    if (!branchId) {
      res.status(400).json({ error: 'Branch is required' });
      return;
    }

    // Validate branch exists and is active
    const branchCheck = await pool.query(
      'SELECT id FROM "Branch" WHERE id = $1 AND active = TRUE',
      [branchId]
    );

    if (branchCheck.rows.length === 0) {
      res.status(404).json({ error: 'Branch not found or inactive' });
      return;
    }

    // Validate classroom if provided
    if (classroomId) {
      const classroomCheck = await pool.query(`
        SELECT cr.id, cr.room_capacity, cr.branch_id, cr.active
        FROM "Classroom" cr
        WHERE cr.id = $1
      `, [classroomId]);

      if (classroomCheck.rows.length === 0) {
        res.status(404).json({ error: 'Classroom not found' });
        return;
      }

      const classroom = classroomCheck.rows[0];

      // Check if classroom is active (for non-admin users)
      if (!classroom.active && userRole !== 'admin') {
        res.status(400).json({ error: 'Selected classroom is currently inactive and unavailable for scheduling' });
        return;
      }

      // Check if classroom belongs to the selected branch
      if (classroom.branch_id !== branchId) {
        res.status(400).json({ error: 'Selected classroom does not belong to the selected branch' });
        return;
      }

      // Check if class capacity exceeds classroom capacity
      if (capacity > classroom.room_capacity) {
        res.status(400).json({ error: `Class capacity (${capacity}) cannot exceed classroom capacity (${classroom.room_capacity})` });
        return;
      }

      // Check for classroom time conflicts
      const conflictCheck = await pool.query(`
        SELECT c.id, c.subject, c.start_time, c.end_time
        FROM "Class" c
        WHERE c.classroom_id = $1
          AND c.active = TRUE
          AND DATE(c.start_time) = DATE($2::timestamp)
          AND c.start_time < ($2::timestamp + INTERVAL '1 minute' * $3)
          AND (c.start_time + INTERVAL '1 minute' * c.duration_minutes) > $2::timestamp
      `, [classroomId, startTime, durationMinutes]);

      if (conflictCheck.rows.length > 0) {
        const conflict = conflictCheck.rows[0];
        const conflictStart = new Date(conflict.start_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const conflictEnd = new Date(conflict.end_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        
        res.status(409).json({ 
          error: `Classroom is already booked from ${conflictStart} to ${conflictEnd} for "${conflict.subject}"` 
        });
        return;
      }
    }

    // Check for teacher schedule conflicts
    const conflictCheck = await checkComprehensiveTeacherScheduleConflict(userId, startTime, durationMinutes, branchId);    
    
    if (conflictCheck.hasConflict) {
      const errorMessage = formatComprehensiveConflictErrorMessage(conflictCheck.conflicts);
      res.status(409).json({ error: errorMessage });
      return;
    }

    const result = await pool.query(`
      INSERT INTO "Class" (subject, description, level, tutor_id, classroom_id, start_time, duration_minutes, capacity, branch_id, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, subject, description, level, start_time, duration_minutes, capacity, active, created_at, updated_at
    `, [subject, description || null, level.trim(), userId, classroomId || null, startTime, durationMinutes, capacity, branchId, userId]);

    const newClass = result.rows[0];

    // Get branch info, tutor info, and classroom info
    const [branchResult, tutorResult, classroomResult] = await Promise.all([
      pool.query('SELECT name as branch_name, address as branch_address FROM "Branch" WHERE id = $1', [branchId]),
      pool.query('SELECT first_name as tutor_first_name, last_name as tutor_last_name FROM "User" WHERE id = $1', [userId]),
      classroomId ? 
        pool.query('SELECT room_name as classroom_name FROM "Classroom" WHERE id = $1', [classroomId]) : 
        Promise.resolve({ rows: [{}] })
    ]);

    const classWithDetails = {
      ...newClass,
      ...branchResult.rows[0],
      ...tutorResult.rows[0],
      ...classroomResult.rows[0],
      tutor_id: userId,
      branch_id: branchId,
      classroom_id: classroomId || null,
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
    const { subject, description, level, startTime, durationMinutes, capacity, branchId, classroomId } = req.body;
    const userRole = req.user!.role;
    const userId = req.user!.userId;

    // Check if class exists and is in the future, and get current enrollment count
    const classCheck = await pool.query(`
      SELECT c.id, c.start_time, c.tutor_id, c.branch_id, c.classroom_id, c.capacity,
             COALESCE(enrolled_count.count, 0) as enrolled_count
      FROM "Class" c
      LEFT JOIN (
        SELECT 
          e.class_id,
          COUNT(e.id) as count
        FROM "Enrollment" e
        INNER JOIN "Student" s ON e.student_id = s.id AND s.active = TRUE
        WHERE e.status = 'enrolled'
        GROUP BY e.class_id
      ) enrolled_count ON c.id = enrolled_count.class_id
      WHERE c.id = $1 AND c.active = TRUE AND c.start_time > NOW()
    `, [id]);

    if (classCheck.rows.length === 0) {
      res.status(404).json({ error: 'Class not found or cannot be modified (past class)' });
      return;
    }

    const classItem = classCheck.rows[0];
    const currentEnrollment = parseInt(classItem.enrolled_count) || 0;

    // Check permissions: staff can only edit their own classes
    if (userRole === 'staff' && classItem.tutor_id !== userId) {
      res.status(403).json({ error: 'You can only edit classes assigned to you' });
      return;
    }

    // Validate required fields for updates
    if (level !== undefined && (!level || level.trim().length === 0)) {
      res.status(400).json({ error: 'Grade/Level is required and cannot be empty' });
      return;
    }

    // Validate capacity if being updated - check against current enrollment
    if (capacity !== undefined) {
      if (capacity < 1) {
        res.status(400).json({ error: 'Capacity must be at least 1 student' });
        return;
      }
      
      // Check if new capacity is less than current enrollment
      if (capacity < currentEnrollment) {
        res.status(400).json({ 
          error: `Capacity cannot be less than current enrollment (${currentEnrollment} students)` 
        });
        return;
      }
    }

    // Validate classroom if being updated
    if (classroomId !== undefined && classroomId !== null) {
      const classroomCheck = await pool.query(`
        SELECT cr.id, cr.room_capacity, cr.branch_id
        FROM "Classroom" cr
        WHERE cr.id = $1 AND cr.active = TRUE
      `, [classroomId]);

      if (classroomCheck.rows.length === 0) {
        res.status(404).json({ error: 'Classroom not found or inactive' });
        return;
      }

      const classroom = classroomCheck.rows[0];
      const targetBranchId = branchId || classItem.branch_id;

      // Check if classroom belongs to the target branch
      if (classroom.branch_id !== targetBranchId) {
        res.status(400).json({ error: 'Selected classroom does not belong to the selected branch' });
        return;
      }

      // Check if class capacity exceeds classroom capacity
      const targetCapacity = capacity || classItem.capacity;
      if (targetCapacity > classroom.room_capacity) {
        res.status(400).json({ error: `Class capacity (${targetCapacity}) cannot exceed classroom capacity (${classroom.room_capacity})` });
        return;
      }

      // Check for classroom time conflicts
      const newStartTime = startTime || classItem.start_time;
      const newDuration = durationMinutes || classItem.duration_minutes;
      
      const conflictCheck = await pool.query(`
        SELECT c.id, c.subject, c.start_time, c.end_time
        FROM "Class" c
        WHERE c.classroom_id = $1 
          AND c.active = TRUE
          AND c.id != $4
          AND DATE(c.start_time) = DATE($2::timestamp)
          AND c.start_time < ($2::timestamp + INTERVAL '1 minute' * $3)
          AND (c.start_time + INTERVAL '1 minute' * c.duration_minutes) > $2::timestamp
      `, [classroomId, newStartTime, newDuration, id]);

      if (conflictCheck.rows.length > 0) {
        const conflict = conflictCheck.rows[0];
        const conflictStart = new Date(conflict.start_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const conflictEnd = new Date(conflict.end_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        
        res.status(409).json({ 
          error: `Classroom is already booked from ${conflictStart} to ${conflictEnd} for "${conflict.subject}"` 
        });
        return;
      }
    }

    // Check for teacher schedule conflicts if start time or duration is being updated
    if (startTime || durationMinutes) {
      const newStartTime = startTime || classItem.start_time;
      const newDuration = durationMinutes || classItem.duration_minutes;
      const newBranchId = branchId || classItem.branch_id;
      
      const conflictCheck = await checkComprehensiveTeacherScheduleConflict(
        classItem.tutor_id, 
        newStartTime, 
        newDuration, 
        newBranchId,
        id // Exclude current class from conflict check
      );
      
      if (conflictCheck.hasConflict) {
        const errorMessage = formatComprehensiveConflictErrorMessage(conflictCheck.conflicts);
        res.status(409).json({ error: errorMessage });
        return;
      }
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
          classroom_id = COALESCE($8, classroom_id),
          updated_at = NOW()
      WHERE id = $9
      RETURNING id, subject, description, level, start_time, duration_minutes, capacity, active, created_at, updated_at
    `, [subject, description, level?.trim(), startTime, durationMinutes, capacity, branchId, classroomId, id]);

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