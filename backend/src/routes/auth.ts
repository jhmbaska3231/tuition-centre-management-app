// backend/src/routes/auth.ts

import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../index';
import { AuthRequest } from '../middleware/auth';
import { validateParentRegistration, validateLogin } from '../middleware/validation';

const router = express.Router();

// User registration (parents only)
router.post('/register', validateParentRegistration, async (req, res) => {
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

    // Create user (all registrations are parent accounts)
    const result = await pool.query(
      `INSERT INTO "User" (email, password, role, first_name, last_name, phone) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING id, email, role, first_name, last_name, phone, created_at, updated_at`,
      [trimmedEmail, hashedPassword, 'parent', firstName.trim(), lastName.trim(), phone?.trim() || null]
    );

    const user = result.rows[0];

    // Get JWT secret from environment
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('JWT_SECRET not configured');
      res.status(500).json({ error: 'Server configuration error' });
      return;
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      jwtSecret,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'Account created successfully! Welcome to our tuition center.',
      token,
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
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Account creation failed. Please try again.' });
  }
});

// User login
router.post('/login', validateLogin, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Trim and normalize email
    const trimmedEmail = email.trim().toLowerCase();

    // Find user
    const result = await pool.query(
      'SELECT id, email, password, role, first_name, last_name, phone, created_at, updated_at FROM "User" WHERE email = $1 AND active = TRUE',
      [trimmedEmail]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const user = result.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Get JWT secret from environment
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('JWT_SECRET not configured');
      res.status(500).json({ error: 'Server configuration error' });
      return;
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      jwtSecret,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
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
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user profile
router.get('/me', async (req: AuthRequest, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      res.status(401).json({ error: 'Access token required' });
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('JWT_SECRET not configured');
      res.status(500).json({ error: 'Server configuration error' });
      return;
    }

    const decoded: any = jwt.verify(token, jwtSecret);
    
    const result = await pool.query(
      'SELECT id, email, role, first_name, last_name, phone, created_at, updated_at FROM "User" WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const user = result.rows[0];
    
    res.json({
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
    console.error('Profile fetch error:', error);
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: 'Invalid token' });
    } else {
      res.status(500).json({ error: 'Failed to fetch profile' });
    }
  }
});

export default router;