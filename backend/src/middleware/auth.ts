// backend/src/middleware/auth.ts

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Extend Express Request type to include user
export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: 'parent' | 'staff' | 'admin';
    iat?: number;
    exp?: number;
  };
}

// Authentication middleware
export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  // Validate JWT_SECRET exists
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    console.error('CRITICAL: JWT_SECRET not configured');
    res.status(500).json({ error: 'Server configuration error' });
    return;
  }

  try {
    // Enhanced JWT verification with additional checks
    const decoded = jwt.verify(token, jwtSecret, {
      algorithms: ['HS256'], // Explicitly specify allowed algorithms
      maxAge: '24h', // Maximum token age
      ignoreExpiration: false,
    }) as any;

    // Additional token validation
    if (!decoded.userId || !decoded.email || !decoded.role) {
      console.warn('SECURITY: Invalid token structure', {
        hasUserId: !!decoded.userId,
        hasEmail: !!decoded.email,
        hasRole: !!decoded.role,
        ip: req.ip,
        timestamp: new Date().toISOString()
      });
      res.status(403).json({ error: 'Invalid token structure' });
      return;
    }

    // Check if token is close to expiring (within 1 hour)
    if (decoded.exp) {
      const now = Math.floor(Date.now() / 1000);
      const timeUntilExpiry = decoded.exp - now;
      
      if (timeUntilExpiry < 3600) { // Less than 1 hour
        res.setHeader('X-Token-Refresh-Needed', 'true');
      }
    }

    // Validate role against allowed values
    const allowedRoles = ['parent', 'staff', 'admin'];
    if (!allowedRoles.includes(decoded.role)) {
      console.warn('SECURITY: Invalid role in token', {
        role: decoded.role,
        userId: decoded.userId,
        ip: req.ip,
        timestamp: new Date().toISOString()
      });
      res.status(403).json({ error: 'Invalid token role' });
      return;
    }

    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      iat: decoded.iat,
      exp: decoded.exp
    };

    next();
  } catch (err: any) {
    // Enhanced error logging for security monitoring
    console.warn('SECURITY: Token verification failed', {
      error: err.message,
      tokenLength: token.length,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });

    if (err.name === 'TokenExpiredError') {
      res.status(401).json({ error: 'Token expired' });
    } else if (err.name === 'JsonWebTokenError') {
      res.status(403).json({ error: 'Invalid token' });
    } else {
      res.status(403).json({ error: 'Token verification failed' });
    }
    return;
  }
};

// Role-based middleware with audit logging
export const requireRole = (role: 'parent' | 'staff' | 'admin') => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    
    if (req.user.role !== role) {
      // Log unauthorized access attempts
      console.warn('SECURITY: Unauthorized access attempt', {
        requiredRole: role,
        userRole: req.user.role,
        userId: req.user.userId,
        endpoint: req.url,
        method: req.method,
        ip: req.ip,
        timestamp: new Date().toISOString()
      });
      
      res.status(403).json({ error: `${role} access required` });
      return;
    }
    
    next();
  };
};

// Multiple roles middleware with audit logging, allows access if user has any of the specified roles
export const requireAnyRole = (...roles: ('parent' | 'staff' | 'admin')[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    
    if (!roles.includes(req.user.role)) {
      // Log unauthorized access attempts
      console.warn('SECURITY: Unauthorized access attempt', {
        allowedRoles: roles,
        userRole: req.user.role,
        userId: req.user.userId,
        endpoint: req.url,
        method: req.method,
        ip: req.ip,
        timestamp: new Date().toISOString()
      });
      
      res.status(403).json({ error: `Access denied. Required roles: ${roles.join(', ')}` });
      return;
    }
    
    next();
  };
};