// backend/src/middleware/security.ts

import { Request, Response, NextFunction } from 'express';
import DOMPurify from 'isomorphic-dompurify';

// Input sanitization middleware to prevent XSS attacks
export const sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
  // Sanitize request body
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize query parameters
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }

  // Sanitize URL parameters
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeObject(req.params);
  }

  next();
};

// Helper function to recursively sanitize objects
const sanitizeObject = (obj: any): any => {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    // Sanitize HTML and script tags while preserving safe content
    return DOMPurify.sanitize(obj, { 
      ALLOWED_TAGS: [], // No HTML tags allowed
      ALLOWED_ATTR: [] // No attributes allowed
    }).trim();
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Sanitize both keys and values
      const sanitizedKey = DOMPurify.sanitize(key, { 
        ALLOWED_TAGS: [], 
        ALLOWED_ATTR: [] 
      });
      sanitized[sanitizedKey] = sanitizeObject(value);
    }
    return sanitized;
  }

  return obj;
};

// Request logging for security monitoring
export const securityLogging = (req: Request, res: Response, next: NextFunction): void => {
  // Log suspicious patterns
  const userAgent = req.get('User-Agent') || '';
  const contentType = req.get('Content-Type') || '';
  
  // Detect potential security threats
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /vbscript:/i,
    /onload=/i,
    /onerror=/i,
    /<iframe/i,
    /eval\(/i,
    /expression\(/i,
    /url\(/i,
    /import\(/i
  ];

  const requestString = JSON.stringify({
    body: req.body,
    query: req.query,
    params: req.params
  });

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(requestString) || pattern.test(userAgent)) {
      console.warn('SECURITY: Suspicious request detected', {
        ip: req.ip,
        method: req.method,
        url: req.url,
        userAgent: userAgent,
        contentType: contentType,
        timestamp: new Date().toISOString(),
        pattern: pattern.source
      });
      break;
    }
  }

  next();
};

// Additional security headers middleware
export const additionalSecurityHeaders = (req: Request, res: Response, next: NextFunction): void => {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Feature policy
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  next();
};