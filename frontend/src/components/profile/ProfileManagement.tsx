// frontend/src/components/profile/ProfileManagement.tsx

import React, { useState, useEffect } from 'react';
import { User, Phone, Mail, Save, Loader2, CheckCircle, Trash2, AlertTriangle, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import AuthService from '../../services/auth';
import { getNameValidationError, getPhoneValidationError } from '../../utils/validation';
import type { UserProfileUpdateRequest } from '../../types';

const ProfileManagement: React.FC = () => {
  const { user, logout, updateUserProfile } = useAuth();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({
    firstName: '',
    lastName: '',
    phone: '',
  });
  
  // Delete account states (only for parents)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Check if user can delete account (only parents can delete their accounts)
  const canDeleteAccount = user?.role === 'parent';

  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.first_name || '',
        lastName: user.last_name || '',
        email: user.email || '',
        phone: user.phone || '',
      });
    }
  }, [user]);

  const validateField = (field: string, value: string) => {
    let error = '';
    
    switch (field) {
      case 'firstName':
        error = getNameValidationError(value, 'First name') || '';
        break;
      case 'lastName':
        error = getNameValidationError(value, 'Last name') || '';
        break;
      case 'phone':
        error = getPhoneValidationError(value) || '';
        break;
    }
    
    setFieldErrors(prev => ({ ...prev, [field]: error }));
    return error === '';
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
    setError('');
    setSuccess('');
    
    // Real-time validation
    validateField(field, value);
  };

  const validateForm = (): boolean => {
    const firstNameValid = validateField('firstName', formData.firstName);
    const lastNameValid = validateField('lastName', formData.lastName);
    const phoneValid = validateField('phone', formData.phone);
    
    return firstNameValid && lastNameValid && phoneValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      setError('Please correct the errors above');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const updateData: UserProfileUpdateRequest = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        phone: formData.phone.trim() || undefined,
      };

      const updatedUser = await AuthService.updateProfile(updateData);
      setSuccess('Profile updated successfully!');
      setHasChanges(false);
      
      // Update the user in the auth context so the UI reflects changes immediately
      if (updateUserProfile) {
        updateUserProfile(updatedUser);
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      setError('Please type "DELETE" to confirm account deletion');
      return;
    }

    setDeleting(true);
    setError('');

    try {
      const result = await AuthService.deleteAccount();
      
      // Show success message briefly before redirecting
      alert(`Account deleted successfully!\n\nDeleted data:\n- ${result.deletedData.students} student(s)\n- ${result.deletedData.enrollments} enrollment(s)\n- ${result.deletedData.payments} payment record(s)`);
      
      // Logout will redirect to landing page
      logout();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
      setDeleteConfirmText('');
    }
  };

  const formatMemberSince = (dateString?: string) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-SG', {
      month: 'long',
      year: 'numeric'
    });
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'parent':
        return 'Parent';
      case 'staff':
        return 'Teacher/Staff';
      case 'admin':
        return 'Administrator';
      default:
        return role;
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center space-x-3">
          <Loader2 className="animate-spin text-blue-600" size={24} />
          <span className="text-lg text-gray-700">Loading profile...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-16">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-3">
          <User className="text-blue-600" size={32} />
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Profile Settings</h1>
            <p className="text-gray-600">Manage your account information</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl">
        {/* Profile Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden mb-8">
          {/* Profile Header */}
          <div className="bg-blue-600 p-6">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                <User className="text-white" size={24} />
              </div>
              <div className="text-white">
                <h2 className="text-2xl font-bold">{user.first_name} {user.last_name}</h2>
                <p className="text-blue-100">{getRoleDisplayName(user.role)} Account</p>
                <p className="text-blue-100 text-sm mt-1">
                  Member since {formatMemberSince(user.created_at)}
                </p>
              </div>
            </div>
          </div>

          {/* Profile Form */}
          <div className="p-6">
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
                        : 'border-gray-200 focus:border-blue-500'
                    }`}
                    placeholder="Enter your first name"
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
                        : 'border-gray-200 focus:border-blue-500'
                    }`}
                    placeholder="Enter your last name"
                    required
                  />
                  {fieldErrors.lastName && (
                    <p className="text-red-600 text-sm mt-1">{fieldErrors.lastName}</p>
                  )}
                </div>
              </div>

              {/* Email Field (Read-only) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="email"
                    value={formData.email}
                    className="w-full pl-12 p-3 border-2 border-gray-200 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                    placeholder="Email address"
                    disabled
                  />
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Email address cannot be changed. Contact support if needed.
                </p>
              </div>

              {/* Phone Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    className={`w-full pl-12 p-3 border-2 rounded-lg focus:outline-none transition-colors ${
                      fieldErrors.phone 
                        ? 'border-red-300 focus:border-red-500' 
                        : 'border-gray-200 focus:border-blue-500'
                    }`}
                    placeholder="91234567"
                  />
                </div>
                {fieldErrors.phone && (
                  <p className="text-red-600 text-sm mt-1">{fieldErrors.phone}</p>
                )}
              </div>

              {/* Status Messages */}
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-600">{error}</p>
                </div>
              )}

              {success && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center space-x-2">
                  <CheckCircle className="text-green-600" size={20} />
                  <p className="text-green-600">{success}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex space-x-4 pt-4">
                <button
                  type="submit"
                  disabled={loading || !hasChanges || Object.values(fieldErrors).some(error => error !== '')}
                  className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save size={20} />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>

                {hasChanges && (
                  <button
                    type="button"
                    onClick={() => {
                      if (user) {
                        setFormData({
                          firstName: user.first_name || '',
                          lastName: user.last_name || '',
                          email: user.email || '',
                          phone: user.phone || '',
                        });
                        setHasChanges(false);
                        setError('');
                        setSuccess('');
                        setFieldErrors({ firstName: '', lastName: '', phone: '' });
                      }
                    }}
                    className="px-6 py-3 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* Danger Zone - Delete Account (Only for Parent users) */}
        {canDeleteAccount && (
          <div className="bg-white rounded-2xl shadow-lg border border-red-200 p-6">
            <h3 className="text-lg font-semibold text-red-800 mb-4 flex items-center space-x-2">
              <AlertTriangle size={20} />
              <span>Danger Zone</span>
            </h3>
            <div className="space-y-3">
              <p className="text-gray-700">
                Delete your account and all associated data permanently. This action cannot be undone.
              </p>
              <p className="text-sm text-gray-600">
                This will delete all your students, enrollments, and payment history.
              </p>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <Trash2 size={16} />
                <span>Delete Account</span>
              </button>
            </div>
          </div>
        )}

        {/* Info message for staff/admin users */}
        {!canDeleteAccount && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
            <div className="flex items-center space-x-3">
              <User className="text-blue-600" size={20} />
              <div>
                <h3 className="text-sm font-semibold text-blue-800">Account Management</h3>
                <p className="text-sm text-blue-700 mt-1">
                  {user.role === 'staff' && 'As a staff member, your account is managed by administrators. Contact support for account changes.'}
                  {user.role === 'admin' && 'As an administrator, your account requires special handling. Contact system support for account changes.'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal (Only for Parents) */}
      {showDeleteConfirm && canDeleteAccount && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md relative shadow-2xl">
            <button
              onClick={() => {
                setShowDeleteConfirm(false);
                setDeleteConfirmText('');
                setError('');
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={24} />
            </button>
            
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="text-red-600" size={24} />
              </div>
              
              <h3 className="text-xl font-bold text-gray-800 mb-2">Delete Parent Account</h3>
              <p className="text-gray-600 mb-4">
                This action will permanently delete your parent account and all associated data.
              </p>
              
              <div className="bg-red-50 p-4 rounded-lg text-left mb-4">
                <p className="text-sm text-red-800 font-semibold mb-2">This will delete:</p>
                <ul className="text-sm text-red-700 space-y-1">
                  <li>• Your parent account and profile</li>
                  <li>• All your children's information</li>
                  <li>• All enrollment records</li>
                  <li>• All payment history</li>
                  <li>• All attendance records</li>
                </ul>
              </div>
              
              <p className="text-sm text-gray-600 mb-4">
                Type <span className="font-bold">DELETE</span> to confirm:
              </p>
              
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-red-500 focus:outline-none text-center"
                placeholder="Type DELETE here"
              />
            </div>
            
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}
            
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText('');
                  setError('');
                }}
                disabled={deleting}
                className="flex-1 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting || deleteConfirmText !== 'DELETE'}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {deleting ? (
                  <div className="flex items-center justify-center">
                    <Loader2 className="animate-spin mr-2" size={16} />
                    Deleting...
                  </div>
                ) : (
                  'Delete Forever'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileManagement;