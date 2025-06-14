// backend/src/index.ts

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createDatabasePool, testDatabaseConnection } from './config/database';
import { createDatabaseSchema, seedDatabase } from './database/schema';

// Import routes
import authRoutes from './routes/auth';
import branchRoutes from './routes/branches';
import classroomRoutes from './routes/classrooms';
import classRoutes from './routes/classes';
import enrollmentRoutes from './routes/enrollments';
import paymentRoutes from './routes/payments';
import studentRoutes from './routes/students';
import userRoutes from './routes/users';
import adminRoutes from './routes/admin';
import attendanceRoutes from './routes/attendance';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Create database connection pool using the config
export const pool = createDatabasePool();

// Initialize database
async function initDatabase() {
  try {
    // Test database connection first
    const isConnected = await testDatabaseConnection(pool);
    if (!isConnected) {
      throw new Error('Failed to connect to database');
    }

    // Create schema and seed data
    await createDatabaseSchema(pool);
    await seedDatabase(pool);
  } catch (error) {
    console.error('Database initialization failed:', error);
    process.exit(1);
  }
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/classrooms', classroomRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/enrollments', enrollmentRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/attendance', attendanceRoutes);

// Health check endpoints
app.get('/', (req, res) => {
  res.json({ 
    message: 'Tuition Center Management API',
    version: '1.0.0',
    status: 'Running'
  });
});

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ 
      status: 'healthy', 
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'unhealthy', 
      database: 'disconnected',
      timestamp: new Date().toISOString()
    });
  }
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Initialize database and start server
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check available at http://localhost:${PORT}/api/health`);
  });
});