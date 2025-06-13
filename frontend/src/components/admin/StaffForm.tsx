// frontend/src/components/admin/StaffForm.tsx

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { StaffMember, CreateStaffRequest, UpdateStaffRequest } from '../../types';
import AdminService from '../../services/admin';
import { getNameValidationError, getPhoneValidationError, isValidEmail, isValidPassword } from '../../utils/validation';

interface StaffFormProps {
  isOpen: boolean;
  onClose: () => void;
  staffMember?: StaffMember | null; // null for create, StaffMember for edit
  onSuccess: () => void;
}

const StaffForm: React.FC<StaffFormProps> = ({ isOpen, onClose, staffMember, onSuccess }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    active: true,
  });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  const isEdit = !!staffMember;

  // Helper function to normalize email (trim and lowercase)
  const normalizeEmail = (emailValue: string): string => {
    return emailValue.trim().toLowerCase();
  };

  // Populate form when editing
  useEffect(() => {
    if (staffMember) {
      setFormData({
        firstName: staffMember.first_name,
        lastName: staffMember.last_name,
        email: staffMember.email,
        phone: staffMember.phone || '',
        password: '',
        confirmPassword: '',
        active: staffMember.active,
      });
    } else {
      // Reset form for new staff
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: '',
        active: true,
      });
    }
    setError('');
    setFieldErrors({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
    });
  }, [staffMember, isOpen]);

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
        // Update form data if email was normalized during validation (only for new staff)
        if (!isEdit && normalizedEmail !== value) {
          setFormData(prev => ({ ...prev, email: normalizedEmail }));
        }
        if (!normalizedEmail) error = 'Email is required';
        else if (!isValidEmail(normalizedEmail)) error = 'Please enter a valid email address';
        break;
      case 'phone':
        error = getPhoneValidationError(value) || '';
        break;
      case 'password':
        if (!isEdit) { // Only validate password for new staff
          if (!value) error = 'Password is required';
          else if (!isValidPassword(value)) error = 'Password must be at least 8 characters long';
        }
        break;
      case 'confirmPassword':
        if (!isEdit) { // Only validate for new staff
          if (!value) error = 'Please confirm the password';
          else if (value !== formData.password) error = 'Passwords do not match';
        }
        break;
    }
    
    setFieldErrors(prev => ({ ...prev, [field]: error }));
    return error === '';
  };

  const handleInputChange = (field: string, value: any) => {
    // Special handling for email to normalize excessive spaces (only for new staff)
    if (field === 'email' && !isEdit) {
      if (typeof value === 'string') {
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
    // Only normalize on blur for new staff (email is disabled for existing staff)
    if (!isEdit) {
      const normalized = normalizeEmail(formData.email);
      if (normalized !== formData.email) {
        setFormData(prev => ({ ...prev, email: normalized }));
        validateField('email', normalized);
      }
    }
  };

  const handleEmailPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    // Only handle paste for new staff (email is disabled for existing staff)
    if (!isEdit) {
      e.preventDefault();
      const pastedText = e.clipboardData.getData('text');
      const normalized = normalizeEmail(pastedText);
      setFormData(prev => ({ ...prev, email: normalized }));
      setError('');
      validateField('email', normalized);
    }
  };

  const validateForm = (): boolean => {
    const firstNameValid = validateField('firstName', formData.firstName);
    const lastNameValid = validateField('lastName', formData.lastName);
    const emailValid = validateField('email', formData.email);
    const phoneValid = validateField('phone', formData.phone);
    
    let passwordValid = true;
    let confirmPasswordValid = true;
    
    if (!isEdit) {
      passwordValid = validateField('password', formData.password);
      confirmPasswordValid = validateField('confirmPassword', formData.confirmPassword);
    }
    
    return firstNameValid && lastNameValid && emailValid && phoneValid && passwordValid && confirmPasswordValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Ensure email is normalized before final validation (only for new staff)
    if (!isEdit) {
      const normalizedEmail = normalizeEmail(formData.email);
      if (normalizedEmail !== formData.email) {
        setFormData(prev => ({ ...prev, email: normalizedEmail }));
      }
    }
    
    if (!validateForm()) {
      setError('Please correct the errors above');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      if (isEdit && staffMember) {
        const updateData: UpdateStaffRequest = {
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          phone: formData.phone.trim() || undefined,
          active: formData.active,
        };
        await AdminService.updateStaffMember(staffMember.id, updateData);
      } else {
        const normalizedEmail = normalizeEmail(formData.email);
        const createData: CreateStaffRequest = {
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          email: normalizedEmail,
          phone: formData.phone.trim() || undefined,
          password: formData.password,
        };
        await AdminService.createStaffMember(createData);
      }

      onSuccess();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
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
      active: true,
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
      <div className="bg-white rounded-2xl p-8 w-full max-w-2xl relative shadow-2xl max-h-[90vh] overflow-y-auto">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          type="button"
        >
          <X size={24} />
        </button>
        
        <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">
          {isEdit ? 'Edit Staff Member' : 'Add New Staff Member'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name Fields */}
          <div className="grid md:grid-cols-2 gap-4">
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
                <p className="text-red-600 text-sm mt-1">{fieldErrors.firstName}</p>
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
                <p className="text-red-600 text-sm mt-1">{fieldErrors.lastName}</p>
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
              disabled={isEdit} // Can't change email for existing users
              className={`w-full p-3 border-2 rounded-lg focus:outline-none transition-colors ${
                isEdit ? 'bg-gray-100 cursor-not-allowed' : ''
              } ${
                fieldErrors.email 
                  ? 'border-red-300 focus:border-red-500' 
                  : 'border-gray-200 focus:border-indigo-500'
              }`}
              placeholder="john.tan@eduspark.com"
              required
            />
            {fieldErrors.email && (
              <p className="text-red-600 text-sm mt-1">{fieldErrors.email}</p>
            )}
            {isEdit && (
              <p className="text-sm text-gray-500 mt-1">
                Email address cannot be changed for existing staff members.
              </p>
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
              <p className="text-red-600 text-sm mt-1">{fieldErrors.phone}</p>
            )}
          </div>

          {/* Password Fields (only for new staff) */}
          {!isEdit && (
            <>
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
                  <p className="text-red-600 text-sm mt-1">{fieldErrors.password}</p>
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
                  placeholder="Re-enter password"
                  required
                />
                {fieldErrors.confirmPassword && (
                  <p className="text-red-600 text-sm mt-1">{fieldErrors.confirmPassword}</p>
                )}
              </div>
            </>
          )}

          {/* Active Status (only for editing) */}
          {isEdit && (
            <div>
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={formData.active}
                  onChange={(e) => handleInputChange('active', e.target.checked)}
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-gray-700">Active Staff Member</span>
              </label>
              <p className="text-sm text-gray-500 mt-1">
                Inactive staff members cannot login or be assigned to new classes.
              </p>
            </div>
          )}
          
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* Info Box */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-800 text-sm">
              <span className="font-medium">Note:</span> {isEdit ? 
                'Staff member details will be updated immediately.' : 
                'The new staff member will be able to login immediately after creation with the provided credentials.'
              }
            </p>
          </div>
          
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="flex-1 px-4 py-3 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || Object.values(fieldErrors).some(error => error !== '')}
              className="flex-1 bg-indigo-500 text-white p-3 rounded-lg font-semibold hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  {isEdit ? 'Updating...' : 'Creating...'}
                </div>
              ) : (
                isEdit ? 'Update Staff Member' : 'Create Staff Member'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StaffForm;