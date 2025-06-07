// backend/src/routes/branches.ts

import express from 'express';
import { pool } from '../index';

const router = express.Router();

// Get all branches (public endpoint)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, address, phone FROM "Branch" WHERE active = TRUE ORDER BY name'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Branches fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch branches' });
  }
});

export default router;