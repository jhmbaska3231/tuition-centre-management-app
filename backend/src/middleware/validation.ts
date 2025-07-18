// backend/src/middleware/validation.ts

import { Request, Response, NextFunction } from 'express';

// Email validation
export const isValidEmail = (email: string): boolean => {
  // More comprehensive email regex
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email) && email.length <= 254; // RFC 5321 limit
};

// Password validation (at least 8 characters)
export const isValidPassword = (password: string): boolean => {
  return Boolean(password && password.length >= 8);
};

// Name validation (only alphabets, at least 2 characters, max 50 characters, no spaces)
export const isValidName = (name: string): boolean => {
  const nameRegex = /^[A-Za-z]{2,50}$/; // Only letters, 2-50 characters, no spaces
  return Boolean(name && name.trim().length >= 2 && name.trim().length <= 50 && nameRegex.test(name.trim()));
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
  
  // Trim email before validation
  const trimmedEmail = email.trim();
  if (!isValidEmail(trimmedEmail)) {
    res.status(400).json({ error: 'Invalid email format' });
    return;
  }
  
  if (!isValidPassword(password)) {
    res.status(400).json({ error: 'Password must be at least 8 characters long' });
    return;
  }
  
  if (!isValidName(firstName)) {
    res.status(400).json({ error: 'First name must contain only letters and be 2-50 characters long' });
    return;
  }
  
  if (!isValidName(lastName)) {
    res.status(400).json({ error: 'Last name must contain only letters and be 2-50 characters long' });
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
  
  // Trim email before validation
  const trimmedEmail = email.trim();
  if (!isValidEmail(trimmedEmail)) {
    res.status(400).json({ error: 'Invalid email format' });
    return;
  }
  
  next();
};

// Profile update validation middleware
export const validateProfileUpdate = (req: Request, res: Response, next: NextFunction): void => {
  const { firstName, lastName, phone } = req.body;
  
  if (firstName && !isValidName(firstName)) {
    res.status(400).json({ error: 'First name must contain only letters and be 2-50 characters long' });
    return;
  }
  
  if (lastName && !isValidName(lastName)) {
    res.status(400).json({ error: 'Last name must contain only letters and be 2-50 characters long' });
    return;
  }

  // Optional phone validation
  if (phone && !isValidPhone(phone)) {
    res.status(400).json({ error: 'Phone number must be exactly 8 digits if provided' });
    return;
  }
  
  next();
};

// Branch creation validation
export const validateBranch = (req: Request, res: Response, next: NextFunction): void => {
  const { name, address, phone } = req.body;
  
  if (!name || !address) {
    res.status(400).json({ error: 'Name and address are required' });
    return;
  }
  
  if (name.trim().length < 2 || name.trim().length > 50) {
    res.status(400).json({ error: 'Branch name must be 2-50 characters long' });
    return;
  }
  
  if (address.trim().length < 5 || address.trim().length > 100) {
    res.status(400).json({ error: 'Address must be 5-100 characters long' });
    return;
  }

  // Optional phone validation
  if (phone && !isValidPhone(phone)) {
    res.status(400).json({ error: 'Phone number must be exactly 8 digits if provided' });
    return;
  }
  
  next();
};

// Class creation validation
export const validateClass = (req: Request, res: Response, next: NextFunction): void => {
  const { subject, startTime, durationMinutes, capacity, branchId, level, classroomId } = req.body;
  
  if (!subject || !startTime || !durationMinutes || !capacity || !branchId || !level || !classroomId) {
    res.status(400).json({ error: 'All fields are required (subject, startTime, durationMinutes, capacity, branchId, level, classroomId)' });
    return;
  }
  
  if (subject.trim().length < 2 || subject.trim().length > 50) {
    res.status(400).json({ error: 'Subject must be 2-50 characters long' });
    return;
  }
  
  if (!level || level.trim().length < 1) {
    res.status(400).json({ error: 'Level/Grade is required' });
    return;
  }
  
  if (isNaN(durationMinutes) || durationMinutes < 30 || durationMinutes > 300) {
    res.status(400).json({ error: 'Duration must be between 30 and 300 minutes' });
    return;
  }
  
  // Classroom capacity validation is done in the route handler where classroom data is available
  if (isNaN(capacity) || capacity < 1) {
    res.status(400).json({ error: 'Capacity must be at least 1 student' });
    return;
  }
  
  if (!isValidUUID(branchId)) {
    res.status(400).json({ error: 'Invalid branch ID' });
    return;
  }
  
  // Classroom ID is required
  if (!isValidUUID(classroomId)) {
    res.status(400).json({ error: 'Invalid classroom ID format' });
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

// Student creation validation middleware
export const validateStudent = (req: Request, res: Response, next: NextFunction): void => {
  const { firstName, lastName, grade, dateOfBirth, homeBranchId } = req.body;
  
  if (!firstName || !lastName || !grade) {
    res.status(400).json({ error: 'First name, last name, and grade are required' });
    return;
  }
  
  if (!isValidName(firstName)) {
    res.status(400).json({ error: 'First name must contain only letters and be 2-50 characters long' });
    return;
  }
  
  if (!isValidName(lastName)) {
    res.status(400).json({ error: 'Last name must contain only letters and be 2-50 characters long' });
    return;
  }
  
  if (!grade || grade.trim().length < 1) {
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

    // Check if student is at least 2 years old
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    if (birthDate > twoYearsAgo) {
      res.status(400).json({ error: 'Student must be at least 2 years old' });
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