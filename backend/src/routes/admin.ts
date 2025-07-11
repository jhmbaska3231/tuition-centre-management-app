// backend/src/routes/admin.ts

import express from 'express';
import bcrypt from 'bcrypt';
import { pool } from '../index';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';
import { validateParentRegistration } from '../middleware/validation';

const router = express.Router();

// Helper function to check for comprehensive teacher schedule conflicts (including travel time)
const checkComprehensiveTeacherScheduleConflict = async (
  tutorId: string, 
  classId: string
): Promise<{ hasConflict: boolean; conflicts: { direct: any[], travel: any[] } }> => {
  try {
    // Get the class details we're trying to assign
    const classResult = await pool.query(`
      SELECT c.id, c.subject, c.level, c.start_time, c.duration_minutes, c.branch_id,
             b.name as branch_name
      FROM "Class" c
      LEFT JOIN "Branch" b ON c.branch_id = b.id
      WHERE c.id = $1 AND c.active = TRUE
    `, [classId]);

    if (classResult.rows.length === 0) {
      throw new Error('Class not found');
    }

    const targetClass = classResult.rows[0];
    const classStartTime = new Date(targetClass.start_time);
    const classEndTime = new Date(classStartTime.getTime() + (targetClass.duration_minutes * 60 * 1000));

    // Get all existing classes for this tutor on the same date
    const dateStart = new Date(classStartTime);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(classStartTime);
    dateEnd.setHours(23, 59, 59, 999);

    const tutorClassesResult = await pool.query(`
      SELECT c.id, c.subject, c.level, c.start_time, c.duration_minutes, c.branch_id,
             b.name as branch_name
      FROM "Class" c
      LEFT JOIN "Branch" b ON c.branch_id = b.id
      WHERE c.tutor_id = $1 
        AND c.active = TRUE 
        AND c.start_time >= $2
        AND c.start_time <= $3
        AND c.id != $4
      ORDER BY c.start_time
    `, [tutorId, dateStart.toISOString(), dateEnd.toISOString(), classId]);

    const directConflicts = [];
    const travelConflicts = [];

    for (const existingClass of tutorClassesResult.rows) {
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
      if (targetClass.branch_id !== existingClass.branch_id) {
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
const formatComprehensiveConflictErrorMessage = (conflicts: { direct: any[], travel: any[] }, tutorName: string): string => {
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
    
    message += `${tutorName} already has ${conflictCount} ${conflictWord} scheduled at the same time:\n\n${conflictDetails}`;
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
    
    message += `${tutorName} has ${conflictCount} ${conflictWord} at different branch(es) that require at least 1 hour buffer time:\n\n${travelDetails}`;
  }
  
  return message;
};

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
             c.branch_id, b.name as branch_name, b.address as branch_address,
             cr.room_name as classroom_name,
             COUNT(e.id) as enrolled_count
      FROM "Class" c
      LEFT JOIN "Branch" b ON c.branch_id = b.id
      LEFT JOIN "Classroom" cr ON c.classroom_id = cr.id
      LEFT JOIN "Enrollment" e ON c.id = e.class_id AND e.status = 'enrolled'
      WHERE c.tutor_id IS NULL AND c.active = TRUE
      GROUP BY c.id, c.subject, c.description, c.level, c.start_time, c.duration_minutes, c.capacity, c.branch_id, b.name, b.address, cr.room_name
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

    // Check for schedule conflicts
    const conflictCheck = await checkComprehensiveTeacherScheduleConflict(tutorId, classId);
    
    if (conflictCheck.hasConflict) {
      const tutor = tutorCheck.rows[0];
      const tutorName = `${tutor.first_name} ${tutor.last_name}`;
      const errorMessage = formatComprehensiveConflictErrorMessage(conflictCheck.conflicts, tutorName);
      res.status(409).json({ error: errorMessage });
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