// src/components/staff/ClassForm.tsx

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Class, Branch, CreateClassRequest, UpdateClassRequest } from '../../types';
import ClassService from '../../services/class';
import BranchService from '../../services/branch';
import { useAuth } from '../../hooks/useAuth';

interface ClassFormProps {
  isOpen: boolean;
  onClose: () => void;
  classData?: Class | null; // null for create, Class for edit
  onSuccess: () => void;
}

const ClassForm: React.FC<ClassFormProps> = ({ isOpen, onClose, classData, onSuccess }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    subject: '',
    description: '',
    level: '',
    startTime: '',
    durationMinutes: 60,
    capacity: 10,
    branchId: '',
  });
  const [branches, setBranches] = useState<Branch[]>([]);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({
    subject: '',
    startTime: '',
    durationMinutes: '',
    capacity: '',
    branchId: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);

  const isEdit = !!classData;

  // Load branches on component mount
  useEffect(() => {
    if (isOpen) {
      loadBranches();
    }
  }, [isOpen]);

  // Populate form when editing
  useEffect(() => {
    if (classData) {
      // Convert start_time to local datetime format for input
      const startDate = new Date(classData.start_time);
      const localDateTime = new Date(startDate.getTime() - startDate.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);

      // Debug branch_id value
      console.log('ClassForm - Setting branchId:', classData.branch_id);
      console.log('ClassForm - Available branches:', branches.map(b => ({ id: b.id, name: b.name })));
        
      setFormData({
        subject: classData.subject,
        description: classData.description || '',
        level: classData.level || '',
        startTime: localDateTime,
        durationMinutes: classData.duration_minutes,
        capacity: classData.capacity,
        branchId: classData.branch_id || '',
      });
    } else {
      // Reset form for new class
      setFormData({
        subject: '',
        description: '',
        level: '',
        startTime: '',
        durationMinutes: 60,
        capacity: 10,
        branchId: '',
      });
    }
    setError('');
    setFieldErrors({
      subject: '',
      startTime: '',
      durationMinutes: '',
      capacity: '',
      branchId: '',
    });
  }, [classData, isOpen, branches]); // Added branches as dependency

  const loadBranches = async () => {
    setLoadingBranches(true);
    try {
      const branchList = await BranchService.getAllBranches();
      setBranches(branchList);
    } catch (err) {
      console.error('Failed to load branches:', err);
      setError('Failed to load branches');
    } finally {
      setLoadingBranches(false);
    }
  };

  const validateField = (field: string, value: any): boolean => {
    let error = '';
    
    switch (field) {
      case 'subject':
        if (!value || value.trim().length < 2) {
          error = 'Subject must be at least 2 characters';
        }
        break;
      case 'startTime':
        if (!value) {
          error = 'Start time is required';
        } else {
          const startDate = new Date(value);
          if (startDate <= new Date()) {
            error = 'Class start time must be in the future';
          }
        }
        break;
      case 'durationMinutes':
        const duration = parseInt(value);
        if (isNaN(duration) || duration < 30 || duration > 300) {
          error = 'Duration must be between 30 and 300 minutes';
        }
        break;
      case 'capacity':
        const cap = parseInt(value);
        if (isNaN(cap) || cap < 1 || cap > 50) {
          error = 'Capacity must be between 1 and 50 students';
        }
        // Validation for edit mode to ensure capacity is not less than current enrollment
        else if (isEdit && classData && cap < classData.enrolled_count) {
          error = `Capacity cannot be less than current enrollment (${classData.enrolled_count} students)`;
        }
        break;
      case 'branchId':
        if (!value) {
          error = 'Branch is required';
        }
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
    const subjectValid = validateField('subject', formData.subject);
    const startTimeValid = validateField('startTime', formData.startTime);
    const durationValid = validateField('durationMinutes', formData.durationMinutes);
    const capacityValid = validateField('capacity', formData.capacity);
    const branchValid = validateField('branchId', formData.branchId);
    
    return subjectValid && startTimeValid && durationValid && capacityValid && branchValid;
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
      const requestData: CreateClassRequest | UpdateClassRequest = {
        subject: formData.subject.trim(),
        description: formData.description.trim() || undefined,
        level: formData.level.trim() || undefined,
        startTime: formData.startTime,
        durationMinutes: formData.durationMinutes,
        capacity: formData.capacity,
        branchId: formData.branchId,
      };

      if (isEdit && classData) {
        await ClassService.updateClass(classData.id, requestData);
      } else {
        await ClassService.createClass(requestData as CreateClassRequest);
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
      subject: '',
      description: '',
      level: '',
      startTime: '',
      durationMinutes: 60,
      capacity: 10,
      branchId: '',
    });
    setError('');
    setFieldErrors({
      subject: '',
      startTime: '',
      durationMinutes: '',
      capacity: '',
      branchId: '',
    });
  };

  if (!isOpen) return null;

  const getTutorName = () => {
    if (user) {
      return `${user.first_name} ${user.last_name}`;
    }
    return 'Current User';
  };

  // Get minimum date-time (current time + 1 hour)
  const getMinDateTime = () => {
    const now = new Date();
    now.setHours(now.getHours() + 1);
    return now.toISOString().slice(0, 16);
  };

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
          {isEdit ? 'Edit Class' : 'Create New Class'}
        </h2>

        {/* Tutor Info */}
        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            <span className="font-medium">Tutor:</span> {getTutorName()}
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Subject and Level Row */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subject *
              </label>
              <input
                type="text"
                value={formData.subject}
                onChange={(e) => handleInputChange('subject', e.target.value)}
                className={`w-full p-3 border-2 rounded-lg focus:outline-none transition-colors ${
                  fieldErrors.subject 
                    ? 'border-red-300 focus:border-red-500' 
                    : 'border-gray-200 focus:border-blue-500'
                }`}
                placeholder="e.g., Mathematics, English, Science"
                required
              />
              {fieldErrors.subject && (
                <p className="text-red-600 text-sm mt-1">{fieldErrors.subject}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Grade/Level
              </label>
              <select
                value={formData.level}
                onChange={(e) => handleInputChange('level', e.target.value)}
                className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none transition-colors"
              >
                <option value="">Select Level (Optional)</option>
                <option value="Nursery 1">Nursery 1 (N1)</option>
                <option value="Nursery 2">Nursery 2 (N2)</option>
                <option value="Kindergarten 1">Kindergarten 1 (K1)</option>
                <option value="Kindergarten 2">Kindergarten 2 (K2)</option>
                <option value="Primary 1">Primary 1 (P1)</option>
                <option value="Primary 2">Primary 2 (P2)</option>
                <option value="Primary 3">Primary 3 (P3)</option>
                <option value="Primary 4">Primary 4 (P4)</option>
                <option value="Primary 5">Primary 5 (P5)</option>
                <option value="Primary 6">Primary 6 (P6)</option>
                <option value="Secondary 1">Secondary 1 (Sec 1)</option>
                <option value="Secondary 2">Secondary 2 (Sec 2)</option>
                <option value="Secondary 3">Secondary 3 (Sec 3)</option>
                <option value="Secondary 4">Secondary 4 (Sec 4)</option>
                <option value="Secondary 5">Secondary 5 (Sec 5)</option>
                <option value="Mixed Levels">Mixed Levels</option>
              </select>
            </div>
          </div>

          {/* Description Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none transition-colors"
              placeholder="Brief description of the class content and objectives"
              rows={3}
            />
          </div>

          {/* Date/Time and Duration Row */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date & Time *
              </label>
              <input
                type="datetime-local"
                value={formData.startTime}
                min={getMinDateTime()}
                onChange={(e) => handleInputChange('startTime', e.target.value)}
                className={`w-full p-3 border-2 rounded-lg focus:outline-none transition-colors ${
                  fieldErrors.startTime 
                    ? 'border-red-300 focus:border-red-500' 
                    : 'border-gray-200 focus:border-blue-500'
                }`}
                required
              />
              {fieldErrors.startTime && (
                <p className="text-red-600 text-sm mt-1">{fieldErrors.startTime}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Duration (minutes) *
              </label>
              <select
                value={formData.durationMinutes}
                onChange={(e) => handleInputChange('durationMinutes', parseInt(e.target.value))}
                className={`w-full p-3 border-2 rounded-lg focus:outline-none transition-colors ${
                  fieldErrors.durationMinutes 
                    ? 'border-red-300 focus:border-red-500' 
                    : 'border-gray-200 focus:border-blue-500'
                }`}
                required
              >
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>1 hour</option>
                <option value={75}>1 hour 15 minutes</option>
                <option value={90}>1 hour 30 minutes</option>
                <option value={105}>1 hour 45 minutes</option>
                <option value={120}>2 hours</option>
                <option value={150}>2 hours 30 minutes</option>
                <option value={180}>3 hours</option>
              </select>
              {fieldErrors.durationMinutes && (
                <p className="text-red-600 text-sm mt-1">{fieldErrors.durationMinutes}</p>
              )}
            </div>
          </div>

          {/* Capacity and Branch Row */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Capacity *
              </label>
              <input
                type="number"
                value={formData.capacity}
                min={isEdit && classData ? classData.enrolled_count : 1}
                max="50"
                onChange={(e) => handleInputChange('capacity', parseInt(e.target.value))}
                className={`w-full p-3 border-2 rounded-lg focus:outline-none transition-colors ${
                  fieldErrors.capacity 
                    ? 'border-red-300 focus:border-red-500' 
                    : 'border-gray-200 focus:border-blue-500'
                }`}
                placeholder="Maximum number of students"
                required
              />
              {fieldErrors.capacity && (
                <p className="text-red-600 text-sm mt-1">{fieldErrors.capacity}</p>
              )}
              {isEdit && classData && classData.enrolled_count > 0 && (
                <p className="text-sm text-gray-600 mt-1">
                  Current enrollment: {classData.enrolled_count} students (minimum capacity)
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Branch *
              </label>
              {loadingBranches ? (
                <div className="w-full p-3 border-2 border-gray-200 rounded-lg bg-gray-50">
                  <span className="text-gray-500">Loading branches...</span>
                </div>
              ) : (
                <select
                  value={formData.branchId}
                  onChange={(e) => handleInputChange('branchId', e.target.value)}
                  className={`w-full p-3 border-2 rounded-lg focus:outline-none transition-colors ${
                    fieldErrors.branchId 
                      ? 'border-red-300 focus:border-red-500' 
                      : 'border-gray-200 focus:border-blue-500'
                  }`}
                  required
                >
                  <option value="">Select Branch</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              )}
              {fieldErrors.branchId && (
                <p className="text-red-600 text-sm mt-1">{fieldErrors.branchId}</p>
              )}
            </div>
          </div>
          
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* Info Box */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-800 text-sm">
              <span className="font-medium">Note:</span> Class creation and update times will be automatically recorded. 
              {isEdit ? ' Only future classes can be modified.' : ' Make sure all details are correct before creating.'}
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
                isEdit ? 'Update Class' : 'Create Class'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ClassForm;