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
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { firstName, lastName, grade, dateOfBirth, homeBranchId } = req.body;

    // Verify student belongs to this parent and get current student data
    const studentCheck = await client.query(
      'SELECT id, first_name, last_name, grade FROM "Student" WHERE id = $1 AND parent_id = $2 AND active = TRUE',
      [id, req.user!.userId]
    );

    if (studentCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Student not found or access denied' });
      return;
    }

    const currentStudent = studentCheck.rows[0];
    const currentGrade = currentStudent.grade;
    const newGrade = grade?.trim();

    // Verify branch if provided
    if (homeBranchId) {
      const branchCheck = await client.query(
        'SELECT id FROM "Branch" WHERE id = $1 AND active = TRUE',
        [homeBranchId]
      );
      
      if (branchCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: 'Invalid branch selected' });
        return;
      }
    }

    // Check if grade is being changed
    let cancelledEnrollments = [];
    if (newGrade && newGrade !== currentGrade) {
      console.log(`Grade change detected for student ${currentStudent.first_name} ${currentStudent.last_name}: ${currentGrade} -> ${newGrade}`);
      
      // Find active enrollments for this student in future classes
      const activeEnrollments = await client.query(`
        SELECT e.id, e.class_id, c.subject, c.level, c.start_time,
               b.name as branch_name
        FROM "Enrollment" e
        JOIN "Class" c ON e.class_id = c.id
        LEFT JOIN "Branch" b ON c.branch_id = b.id
        WHERE e.student_id = $1 
          AND e.status = 'enrolled' 
          AND c.active = TRUE
          AND c.start_time > NOW()
        ORDER BY c.start_time
      `, [id]);

      console.log(`Found ${activeEnrollments.rows.length} active future enrollments to check`);

      // Check each enrollment to see if it still matches the new grade
      for (const enrollment of activeEnrollments.rows) {
        const classLevel = enrollment.level;
        
        // If class level is not 'Mixed Levels' and doesn't match new grade, cancel the enrollment
        if (classLevel !== 'Mixed Levels' && classLevel !== newGrade) {
          console.log(`Cancelling enrollment: ${enrollment.subject} (${classLevel}) - no longer matches grade ${newGrade}`);
          
          // Cancel the enrollment
          await client.query(`
            UPDATE "Enrollment" 
            SET status = 'cancelled', cancelled_at = NOW()
            WHERE id = $1
          `, [enrollment.id]);

          cancelledEnrollments.push({
            subject: enrollment.subject,
            level: classLevel,
            start_time: enrollment.start_time,
            branch_name: enrollment.branch_name
          });
        } else if (classLevel === 'Mixed Levels') {
          console.log(`Keeping enrollment: ${enrollment.subject} (Mixed Levels) - compatible with all grades`);
        } else {
          console.log(`Keeping enrollment: ${enrollment.subject} (${classLevel}) - matches new grade ${newGrade}`);
        }
      }
    }

    // Update the student
    const result = await client.query(`
      UPDATE "Student" 
      SET first_name = COALESCE($1, first_name),
          last_name = COALESCE($2, last_name),
          grade = COALESCE($3, grade),
          date_of_birth = COALESCE($4, date_of_birth),
          home_branch_id = COALESCE($5, home_branch_id),
          updated_at = NOW()
      WHERE id = $6 AND parent_id = $7
      RETURNING id, first_name, last_name, grade, date_of_birth, home_branch_id, active, created_at, updated_at
    `, [firstName?.trim(), lastName?.trim(), newGrade, dateOfBirth, homeBranchId, id, req.user!.userId]);

    const student = result.rows[0];

    // Get branch info if available
    let studentWithBranch = student;
    if (student.home_branch_id) {
      const branchResult = await client.query(
        'SELECT name as home_branch_name, address as home_branch_address FROM "Branch" WHERE id = $1',
        [student.home_branch_id]
      );
      if (branchResult.rows.length > 0) {
        studentWithBranch = { ...student, ...branchResult.rows[0] };
      }
    }

    await client.query('COMMIT');

    // Prepare response message
    let message = 'Student updated successfully';
    if (cancelledEnrollments.length > 0) {
      const cancelledClassNames = cancelledEnrollments.map(e => `${e.subject} (${e.level})`).join(', ');
      message = `Student updated successfully. Grade changed from ${currentGrade} to ${newGrade}. Automatically cancelled ${cancelledEnrollments.length} enrollment(s) that no longer match the new grade: ${cancelledClassNames}. Mixed Levels classes were kept.`;
    }

    res.json({
      message,
      student: studentWithBranch,
      cancelledEnrollments: cancelledEnrollments.length > 0 ? {
        count: cancelledEnrollments.length,
        classes: cancelledEnrollments,
        reason: `Grade changed from ${currentGrade} to ${newGrade}`
      } : null
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update student error:', error);
    res.status(500).json({ error: 'Failed to update student' });
  } finally {
    client.release();
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