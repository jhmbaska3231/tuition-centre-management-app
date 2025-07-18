// frontend/src/components/auth/RegistrationModal.tsx

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { isValidEmail, isValidPassword, getNameValidationError, getPhoneValidationError } from '../../utils/validation';

interface RegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface RegistrationForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

const RegistrationModal: React.FC<RegistrationModalProps> = ({ isOpen, onClose }) => {
  const [formData, setFormData] = useState<RegistrationForm>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const { register } = useAuth();

  // Helper function to normalize email (trim and lowercase)
  const normalizeEmail = (emailValue: string): string => {
    return emailValue.trim().toLowerCase();
  };

  const validateField = (field: string, value: string): boolean => {
    let error = '';
    
    switch (field) {
      case 'firstName':
        error = getNameValidationError(value, 'First name') || '';
        break;
      case 'lastName':
        error = getNameValidationError(value, 'Last name') || '';
        break;
      case 'email':
        const normalizedEmail = normalizeEmail(value);
        // Update form data if email was normalized during validation
        if (normalizedEmail !== value) {
          setFormData(prev => ({ ...prev, email: normalizedEmail }));
        }
        if (!normalizedEmail) error = 'Email is required';
        else if (!isValidEmail(normalizedEmail)) error = 'Please enter a valid email address';
        break;
      case 'phone':
        error = getPhoneValidationError(value) || '';
        break;
      case 'password':
        if (!value) error = 'Password is required';
        else if (!isValidPassword(value)) error = 'Password must be at least 8 characters long';
        break;
      case 'confirmPassword':
        if (!value) error = 'Please confirm your password';
        else if (value !== formData.password) error = 'Passwords do not match';
        break;
    }
    
    setFieldErrors(prev => ({ ...prev, [field]: error }));
    return error === '';
  };

  const handleInputChange = (field: string, value: string) => {
    // Special handling for email to normalize excessive spaces
    if (field === 'email') {
      const hasExcessiveSpaces = value.startsWith('  ') || value.endsWith('  ') || value.includes('   ');
      
      if (hasExcessiveSpaces && value.trim() !== '') {
        // If there are excessive spaces but there's actual content, normalize it
        const normalized = normalizeEmail(value);
        setFormData(prev => ({ ...prev, [field]: normalized }));
        setError('');
        validateField(field, normalized);
        return;
      }
    }
    
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
    
    // Real-time validation
    validateField(field, value);
    
    // Also revalidate confirm password if password changed
    if (field === 'password' && formData.confirmPassword) {
      validateField('confirmPassword', formData.confirmPassword);
    }
  };

  const handleEmailBlur = () => {
    // Always normalize on blur to ensure clean final state
    const normalized = normalizeEmail(formData.email);
    if (normalized !== formData.email) {
      setFormData(prev => ({ ...prev, email: normalized }));
      validateField('email', normalized);
    }
  };

  const handleEmailPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    // Handle paste events to automatically normalize pasted content
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const normalized = normalizeEmail(pastedText);
    setFormData(prev => ({ ...prev, email: normalized }));
    setError('');
    validateField('email', normalized);
  };

  const validateForm = (): boolean => {
    const fields = ['firstName', 'lastName', 'email', 'phone', 'password', 'confirmPassword'];
    return fields.every(field => validateField(field, formData[field as keyof RegistrationForm]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Ensure email is normalized before final validation
    const normalizedEmail = normalizeEmail(formData.email);
    if (normalizedEmail !== formData.email) {
      setFormData(prev => ({ ...prev, email: normalizedEmail }));
    }
    
    if (!validateForm()) {
      setError('Please correct the errors above');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await register({
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: normalizedEmail,
        phone: formData.phone.trim() || undefined,
        password: formData.password,
      });
      
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
    });
    setError('');
    setFieldErrors({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-white-100 to-indigo-200 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 w-full max-w-md relative shadow-2xl max-h-[85vh] overflow-y-auto">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          type="button"
        >
          <X size={24} />
        </button>
        
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Create Account</h2>
          <p className="text-gray-600 mt-2">Join our tuition centre community</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name Fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                First Name *
              </label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
                className={`w-full p-3 border-2 rounded-lg focus:outline-none transition-colors ${
                  fieldErrors.firstName 
                    ? 'border-red-300 focus:border-red-500' 
                    : 'border-gray-200 focus:border-indigo-500'
                }`}
                placeholder="John"
                required
              />
              {fieldErrors.firstName && (
                <p className="text-red-600 text-xs mt-1">{fieldErrors.firstName}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Last Name *
              </label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
                className={`w-full p-3 border-2 rounded-lg focus:outline-none transition-colors ${
                  fieldErrors.lastName 
                    ? 'border-red-300 focus:border-red-500' 
                    : 'border-gray-200 focus:border-indigo-500'
                }`}
                placeholder="Tan"
                required
              />
              {fieldErrors.lastName && (
                <p className="text-red-600 text-xs mt-1">{fieldErrors.lastName}</p>
              )}
            </div>
          </div>

          {/* Email Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address *
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              onBlur={handleEmailBlur}
              onPaste={handleEmailPaste}
              className={`w-full p-3 border-2 rounded-lg focus:outline-none transition-colors ${
                fieldErrors.email 
                  ? 'border-red-300 focus:border-red-500' 
                  : 'border-gray-200 focus:border-indigo-500'
              }`}
              placeholder="john.tan@email.com"
              required
            />
            {fieldErrors.email && (
              <p className="text-red-600 text-xs mt-1">{fieldErrors.email}</p>
            )}
          </div>

          {/* Phone Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              className={`w-full p-3 border-2 rounded-lg focus:outline-none transition-colors ${
                fieldErrors.phone 
                  ? 'border-red-300 focus:border-red-500' 
                  : 'border-gray-200 focus:border-indigo-500'
              }`}
              placeholder="91234567"
            />
            {fieldErrors.phone && (
              <p className="text-red-600 text-xs mt-1">{fieldErrors.phone}</p>
            )}
          </div>

          {/* Password Fields */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password *
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              className={`w-full p-3 border-2 rounded-lg focus:outline-none transition-colors ${
                fieldErrors.password 
                  ? 'border-red-300 focus:border-red-500' 
                  : 'border-gray-200 focus:border-indigo-500'
              }`}
              placeholder="Minimum 8 characters"
              required
            />
            {fieldErrors.password && (
              <p className="text-red-600 text-xs mt-1">{fieldErrors.password}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Confirm Password *
            </label>
            <input
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
              className={`w-full p-3 border-2 rounded-lg focus:outline-none transition-colors ${
                fieldErrors.confirmPassword 
                  ? 'border-red-300 focus:border-red-500' 
                  : 'border-gray-200 focus:border-indigo-500'
              }`}
              placeholder="Re-enter your password"
              required
            />
            {fieldErrors.confirmPassword && (
              <p className="text-red-600 text-xs mt-1">{fieldErrors.confirmPassword}</p>
            )}
          </div>
          
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* Terms Notice */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-800 text-sm">
              By creating an account, you agree to our Terms of Service and Privacy Policy.
            </p>
          </div>
          
          <button
            type="submit"
            disabled={isLoading || Object.values(fieldErrors).some(error => error !== '')}
            className="w-full bg-indigo-500 text-white p-3 rounded-lg font-semibold hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Creating Account...
              </div>
            ) : (
              'Create Account'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default RegistrationModal;