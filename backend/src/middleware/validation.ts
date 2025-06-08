// backend/src/middleware/validation.ts

import { Request, Response, NextFunction } from 'express';

// Email validation
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Password validation (at least 8 characters)
export const isValidPassword = (password: string): boolean => {
  return Boolean(password && password.length >= 8);
};

// Name validation (only alphabets, at least 2 characters, no spaces)
export const isValidName = (name: string): boolean => {
  const nameRegex = /^[A-Za-z]{2,}$/; // Only letters, at least 2 characters, no spaces
  return Boolean(name && name.trim().length >= 2 && nameRegex.test(name.trim()));
};

// Phone validation (exactly 8 digits, optional)
export const isValidPhone = (phone: string): boolean => {
  if (!phone || phone.trim().length === 0) return true; // Optional field
  const phoneRegex = /^\d{8}$/; // Exactly 8 digits
  return phoneRegex.test(phone.trim());
};

// UUID validation
export const isValidUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

// Registration validation middleware (for parent registration)
export const validateParentRegistration = (req: Request, res: Response, next: NextFunction): void => {
  const { firstName, lastName, email, password, phone } = req.body;
  
  if (!firstName || !lastName || !email || !password) {
    res.status(400).json({ error: 'First name, last name, email, and password are required' });
    return;
  }
  
  if (!isValidEmail(email)) {
    res.status(400).json({ error: 'Invalid email format' });
    return;
  }
  
  if (!isValidPassword(password)) {
    res.status(400).json({ error: 'Password must be at least 8 characters long' });
    return;
  }
  
  if (!isValidName(firstName)) {
    res.status(400).json({ error: 'First name must contain only letters and be at least 2 characters long' });
    return;
  }
  
  if (!isValidName(lastName)) {
    res.status(400).json({ error: 'Last name must contain only letters and be at least 2 characters long' });
    return;
  }

  // Optional phone validation
  if (phone && !isValidPhone(phone)) {
    res.status(400).json({ error: 'Phone number must be exactly 8 digits if provided' });
    return;
  }
  
  next();
};

// Login validation middleware
export const validateLogin = (req: Request, res: Response, next: NextFunction): void => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }
  
  if (!isValidEmail(email)) {
    res.status(400).json({ error: 'Invalid email format' });
    return;
  }
  
  next();
};

// Profile update validation middleware
export const validateProfileUpdate = (req: Request, res: Response, next: NextFunction): void => {
  const { firstName, lastName, phone } = req.body;
  
  if (firstName && !isValidName(firstName)) {
    res.status(400).json({ error: 'First name must contain only letters and be at least 2 characters long' });
    return;
  }
  
  if (lastName && !isValidName(lastName)) {
    res.status(400).json({ error: 'Last name must contain only letters and be at least 2 characters long' });
    return;
  }

  // Optional phone validation
  if (phone && !isValidPhone(phone)) {
    res.status(400).json({ error: 'Phone number must be exactly 8 digits if provided' });
    return;
  }
  
  next();
};

// Student creation validation middleware
export const validateStudent = (req: Request, res: Response, next: NextFunction): void => {
  const { firstName, lastName, grade, dateOfBirth, homeBranchId } = req.body;
  
  if (!firstName || !lastName || !grade) {
    res.status(400).json({ error: 'First name, last name, and grade are required' });
    return;
  }
  
  if (!isValidName(firstName)) {
    res.status(400).json({ error: 'First name must contain only letters and be at least 2 characters long' });
    return;
  }
  
  if (!isValidName(lastName)) {
    res.status(400).json({ error: 'Last name must contain only letters and be at least 2 characters long' });
    return;
  }
  
  if (grade.trim().length < 1) {
    res.status(400).json({ error: 'Grade is required' });
    return;
  }
  
  // Validate date of birth if provided
  if (dateOfBirth && dateOfBirth.trim()) {
    const birthDate = new Date(dateOfBirth);
    if (isNaN(birthDate.getTime())) {
      res.status(400).json({ error: 'Invalid date of birth format' });
      return;
    }
    
    // Check if birth date is not in the future
    if (birthDate > new Date()) {
      res.status(400).json({ error: 'Date of birth cannot be in the future' });
      return;
    }
    
    // Check if birth date is reasonable (not too old)
    const hundredYearsAgo = new Date();
    hundredYearsAgo.setFullYear(hundredYearsAgo.getFullYear() - 100);
    if (birthDate < hundredYearsAgo) {
      res.status(400).json({ error: 'Invalid date of birth' });
      return;
    }
  }
  
  // Validate home branch ID if provided
  if (homeBranchId && !isValidUUID(homeBranchId)) {
    res.status(400).json({ error: 'Invalid home branch ID format' });
    return;
  }
  
  next();
};

// Class creation validation
export const validateClass = (req: Request, res: Response, next: NextFunction): void => {
  const { subject, startTime, durationMinutes, capacity, branchId } = req.body;
  
  if (!subject || !startTime || !durationMinutes || !capacity || !branchId) {
    res.status(400).json({ error: 'All fields are required' });
    return;
  }
  
  if (subject.trim().length < 2) {
    res.status(400).json({ error: 'Subject must be at least 2 characters' });
    return;
  }
  
  if (isNaN(durationMinutes) || durationMinutes < 30 || durationMinutes > 300) {
    res.status(400).json({ error: 'Duration must be between 30 and 300 minutes' });
    return;
  }
  
  if (isNaN(capacity) || capacity < 1 || capacity > 50) {
    res.status(400).json({ error: 'Capacity must be between 1 and 50 students' });
    return;
  }
  
  if (!isValidUUID(branchId)) {
    res.status(400).json({ error: 'Invalid branch ID' });
    return;
  }
  
  // Validate start time is in the future
  const classStartTime = new Date(startTime);
  if (classStartTime <= new Date()) {
    res.status(400).json({ error: 'Class start time must be in the future' });
    return;
  }
  
  next();
};