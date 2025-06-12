// frontend/src/components/admin/BranchForm.tsx

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Branch, CreateBranchRequest, UpdateBranchRequest } from '../../types';
import BranchService from '../../services/branch';
import { getPhoneValidationError } from '../../utils/validation';

interface BranchFormProps {
  isOpen: boolean;
  onClose: () => void;
  branch?: Branch | null; // null for create, Branch for edit
  onSuccess: () => void;
}

const BranchForm: React.FC<BranchFormProps> = ({ isOpen, onClose, branch, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    active: true,
  });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({
    name: '',
    address: '',
    phone: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  const isEdit = !!branch;

  // Populate form when editing
  useEffect(() => {
    if (branch) {
      setFormData({
        name: branch.name,
        address: branch.address,
        phone: branch.phone || '',
        active: branch.active,
      });
    } else {
      // Reset form for new branch
      setFormData({
        name: '',
        address: '',
        phone: '',
        active: true,
      });
    }
    setError('');
    setFieldErrors({
      name: '',
      address: '',
      phone: '',
    });
  }, [branch, isOpen]);

  const validateField = (field: string, value: string): boolean => {
    let error = '';
    
    switch (field) {
      case 'name':
        if (!value || value.trim().length < 2) {
          error = 'Branch name must be at least 2 characters long';
        }
        break;
      case 'address':
        if (!value || value.trim().length < 5) {
          error = 'Address must be at least 5 characters long';
        }
        break;
      case 'phone':
        error = getPhoneValidationError(value) || '';
        break;
    }
    
    setFieldErrors(prev => ({ ...prev, [field]: error }));
    return error === '';
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
    
    // Real-time validation
    validateField(field, value);
  };

  const validateForm = (): boolean => {
    const nameValid = validateField('name', formData.name);
    const addressValid = validateField('address', formData.address);
    const phoneValid = validateField('phone', formData.phone);
    
    return nameValid && addressValid && phoneValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      setError('Please correct the errors above');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      if (isEdit && branch) {
        const updateData: UpdateBranchRequest = {
          name: formData.name.trim(),
          address: formData.address.trim(),
          phone: formData.phone.trim() || undefined,
          active: formData.active,
        };
        await BranchService.updateBranch(branch.id, updateData);
      } else {
        const createData: CreateBranchRequest = {
          name: formData.name.trim(),
          address: formData.address.trim(),
          phone: formData.phone.trim() || undefined,
        };
        await BranchService.createBranch(createData);
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
      name: '',
      address: '',
      phone: '',
      active: true,
    });
    setError('');
    setFieldErrors({
      name: '',
      address: '',
      phone: '',
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 w-full max-w-2xl relative shadow-2xl max-h-[90vh] overflow-y-auto">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          type="button"
        >
          <X size={24} />
        </button>
        
        <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">
          {isEdit ? 'Edit Branch' : 'Add New Branch'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Branch Name Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Branch Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className={`w-full p-3 border-2 rounded-lg focus:outline-none transition-colors ${
                fieldErrors.name 
                  ? 'border-red-300 focus:border-red-500' 
                  : 'border-gray-200 focus:border-blue-500'
              }`}
              placeholder="e.g., Main Branch, North Branch"
              required
            />
            {fieldErrors.name && (
              <p className="text-red-600 text-sm mt-1">{fieldErrors.name}</p>
            )}
          </div>

          {/* Address Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Address *
            </label>
            <textarea
              value={formData.address}
              onChange={(e) => handleInputChange('address', e.target.value)}
              className={`w-full p-3 border-2 rounded-lg focus:outline-none transition-colors ${
                fieldErrors.address 
                  ? 'border-red-300 focus:border-red-500' 
                  : 'border-gray-200 focus:border-blue-500'
              }`}
              placeholder="e.g., Block 123, Tampines Street 45, #05-67, Singapore 520123"
              rows={3}
              required
            />
            {fieldErrors.address && (
              <p className="text-red-600 text-sm mt-1">{fieldErrors.address}</p>
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
                  : 'border-gray-200 focus:border-blue-500'
              }`}
              placeholder="61234567"
            />
            {fieldErrors.phone && (
              <p className="text-red-600 text-sm mt-1">{fieldErrors.phone}</p>
            )}
          </div>

          {/* Active Status (only for editing) */}
          {isEdit && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={formData.active}
                  onChange={(e) => handleInputChange('active', e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Branch is Active (Operational)
                </span>
              </label>
              <div className="mt-2 text-sm text-gray-600">
                <p className="mb-1">
                  <span className="font-medium">Active:</span> Branch is operational and available for class creation and student enrollment.
                </p>
                <p>
                  <span className="font-medium">Inactive:</span> Branch is temporarily closed (e.g., for renovation) but data is preserved.
                </p>
                <p className="mt-2 text-orange-600 font-medium">
                  Note: To permanently close a branch and remove all data, use the "Delete Branch" button instead.
                </p>
              </div>
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
                'Branch details will be updated immediately. Students and classes associated with this branch will see the updated information.' : 
                'The new branch will be available immediately for creating classes and assigning to students.'
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
              className="flex-1 bg-blue-600 text-white p-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  {isEdit ? 'Updating...' : 'Creating...'}
                </div>
              ) : (
                isEdit ? 'Update Branch' : 'Create Branch'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BranchForm;