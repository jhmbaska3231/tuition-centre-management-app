// frontend/src/utils/validation.ts

// Email validation
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email) && email.length <= 254; // RFC 5321 limit
};

// Password validation (at least 8 characters)
export const isValidPassword = (password: string): boolean => {
  return Boolean(password && password.length >= 8);
};

// Name validation (only alphabets, 2-50 characters, no spaces)
export const isValidName = (name: string): boolean => {
  const nameRegex = /^[A-Za-z]{2,50}$/; // Only letters, 2-50 characters, no spaces
  return Boolean(name && name.trim().length >= 2 && name.trim().length <= 50 && nameRegex.test(name.trim()));
};

// Get name validation error message
export const getNameValidationError = (name: string, fieldName: string): string | null => {
  if (!name || name.trim().length === 0) {
    return `${fieldName} is required`;
  }
  
  if (name.trim().length < 2) {
    return `${fieldName} must be at least 2 characters long`;
  }
  
  if (name.trim().length > 50) {
    return `${fieldName} must be no more than 50 characters long`;
  }
  
  if (!/^[A-Za-z]+$/.test(name.trim())) {
    return `${fieldName} must contain only letters`;
  }
  
  return null;
};

// Phone validation (exactly 8 digits, optional)
export const isValidPhone = (phone: string): boolean => {
  if (!phone || phone.trim().length === 0) return true; // Optional field
  const phoneRegex = /^\d{8}$/; // Exactly 8 digits
  return phoneRegex.test(phone.trim());
};

// Get phone validation error message
export const getPhoneValidationError = (phone: string): string | null => {
  if (!phone || phone.trim().length === 0) {
    return null; // Optional field
  }
  
  if (!/^\d+$/.test(phone.trim())) {
    return 'Phone number must contain only digits';
  }
  
  if (phone.trim().length !== 8) {
    return 'Phone number must be exactly 8 digits';
  }
  
  return null;
};