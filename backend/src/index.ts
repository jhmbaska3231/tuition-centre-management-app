// backend/src/index.ts

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
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

// Validate required environment variables
const requiredEnvVars = ['JWT_SECRET', 'DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`FATAL: Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

const app = express();
const PORT = process.env.PORT || 8080;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const prometheusClient = require('prom-client');

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable for API compatibility
}));

// Rate limiter to prevent brute force attacks
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes  
  max: 5, // limit each IP to 5 login attempts per 15 minutes
  message: { error: 'Too many login attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Collect default metrics (CPU, memory, event loop lag, GC, etc)
prometheusClient.collectDefaultMetrics({ timeout: 5000 });

// Create custom metrics
const httpRequestsTotal = new prometheusClient.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'status']
});

app.use(generalLimiter);

const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [
      FRONTEND_URL,
    ]
  : [
      FRONTEND_URL,
      'http://localhost:5173'
    ];

// Secure CORS configuration
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400, // 24 hours
}));

// Enhanced body parsing with size limits
app.use(express.json({ 
  limit: '10mb', // Prevent large payload attacks
  strict: true
}));
app.use(express.urlencoded({ 
  extended: false, 
  limit: '10mb'
}));

// Track HTTP requests for Prometheus
app.use((req, res, next) => {
  res.on('finish', () => {
    httpRequestsTotal.inc({ 
      method: req.method, 
      status: res.statusCode.toString() 
    });
  });
  next();
});

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

    // Create schema only
    await createDatabaseSchema(pool);
    
    // Only seed database in development
    if (process.env.NODE_ENV === 'development') {
      await seedDatabase(pool);
      console.log('Database seeding completed (development mode)');
    }
    
    console.log('Database initialization completed successfully');
  } catch (error) {
    console.error('Database initialization failed:', error);
    process.exit(1);
  }
}

// Apply auth rate limiting to sensitive routes
app.use('/api/auth', authLimiter);

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

// Health check endpoints (required for Kubernetes)
app.get('/', (req, res) => {
  res.json({ 
    message: 'Tuition Center Management API',
    version: '1.0.0',
    status: 'Running'
  });
});

// Liveness probe endpoint, checks if the application is running (required for Kubernetes)
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Readiness probe endpoint, checks if the application is ready to serve traffic (required for Kubernetes)
app.get('/ready', async (req, res) => {
  try {
    const isDbReady = await testDatabaseConnection(pool);
    if (isDbReady) {
      res.status(200).json({ 
        status: 'ready',
        database: 'connected',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({ 
        status: 'not ready',
        database: 'disconnected',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(503).json({ 
      status: 'not ready',
      error: 'Database connection failed',
      timestamp: new Date().toISOString()
    });
  }
});

// Scrape metrics endpoint (required for Prometheus) 
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', prometheusClient.register.contentType);
    res.end(await prometheusClient.register.metrics());
  } catch (err) {
    res.status(500).end(err);
  }
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  pool.end();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  pool.end();
  process.exit(0);
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Log error details for debugging (but don't expose to client)
  console.error('Server Error:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    url: req.url,
    method: req.method,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });

  // Send generic error message to client
  res.status(err.status || 500).json({ 
    error: process.env.NODE_ENV === 'development' 
      ? err.message 
      : 'An internal server error occurred'
  });
});

// Start server after database initialization
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}).catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});