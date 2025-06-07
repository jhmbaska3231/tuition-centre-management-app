// src/components/students/StudentForm.tsx

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Student, CreateStudentRequest, UpdateStudentRequest, Branch } from '../../types';
import StudentService from '../../services/student';
import BranchService from '../../services/branch';
import { getNameValidationError } from '../../utils/validation';

interface StudentFormProps {
  isOpen: boolean;
  onClose: () => void;
  student?: Student | null; // null for create, Student for edit
  onSuccess: () => void;
}

const StudentForm: React.FC<StudentFormProps> = ({ isOpen, onClose, student, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    grade: '',
    dateOfBirth: '',
    homeBranchId: '',
  });
  const [branches, setBranches] = useState<Branch[]>([]);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({
    name: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);

  const isEdit = !!student;

  // Load branches on component mount
  useEffect(() => {
    if (isOpen) {
      loadBranches();
    }
  }, [isOpen]);

  // Populate form when editing
  useEffect(() => {
    if (student) {
      setFormData({
        name: student.name,
        grade: student.grade,
        dateOfBirth: student.date_of_birth ? student.date_of_birth.split('T')[0] : '',
        homeBranchId: student.home_branch_id || '',
      });
    } else {
      // Reset form for new student
      setFormData({
        name: '',
        grade: '',
        dateOfBirth: '',
        homeBranchId: '',
      });
    }
    setError('');
    setFieldErrors({ name: '' });
  }, [student, isOpen]);

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

  const validateField = (field: string, value: string): boolean => {
    let error = '';
    
    switch (field) {
      case 'name':
        error = getNameValidationError(value, 'Student name') || '';
        break;
    }
    
    setFieldErrors(prev => ({ ...prev, [field]: error }));
    return error === '';
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
    
    // Real-time validation for name field
    if (field === 'name') {
      validateField(field, value);
    }
  };

  const validateForm = (): boolean => {
    const nameValid = validateField('name', formData.name);
    
    if (!formData.grade.trim()) {
      setError('Grade is required');
      return false;
    }
    
    return nameValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const studentData: CreateStudentRequest | UpdateStudentRequest = {
        name: formData.name.trim(),
        grade: formData.grade.trim(),
        dateOfBirth: formData.dateOfBirth || undefined,
        homeBranchId: formData.homeBranchId || undefined,
      };

      if (isEdit && student) {
        await StudentService.updateStudent(student.id, studentData);
      } else {
        await StudentService.createStudent(studentData as CreateStudentRequest);
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
      grade: '',
      dateOfBirth: '',
      homeBranchId: '',
    });
    setError('');
    setFieldErrors({ name: '' });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 w-full max-w-md relative shadow-2xl max-h-[90vh] overflow-y-auto">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          type="button"
        >
          <X size={24} />
        </button>
        
        <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">
          {isEdit ? 'Edit Student' : 'Add New Student'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Student Name *
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
              placeholder="Enter student's full name"
              required
            />
            {fieldErrors.name && (
              <p className="text-red-600 text-sm mt-1">{fieldErrors.name}</p>
            )}
          </div>
          
          {/* Grade Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Grade *
            </label>
            <select
              value={formData.grade}
              onChange={(e) => handleInputChange('grade', e.target.value)}
              className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none transition-colors"
              required
            >
              <option value="">Select Grade</option>
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
            </select>
          </div>

          {/* Date of Birth Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date of Birth
            </label>
            <input
              type="date"
              value={formData.dateOfBirth}
              onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
              className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none transition-colors"
            />
          </div>

          {/* Home Branch Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Home Branch
            </label>
            {loadingBranches ? (
              <div className="w-full p-3 border-2 border-gray-200 rounded-lg bg-gray-50">
                <span className="text-gray-500">Loading branches...</span>
              </div>
            ) : (
              <select
                value={formData.homeBranchId}
                onChange={(e) => handleInputChange('homeBranchId', e.target.value)}
                className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none transition-colors"
              >
                <option value="">Select Home Branch (Optional)</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name} - {branch.address}
                  </option>
                ))}
              </select>
            )}
          </div>
          
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}
          
          <button
            type="submit"
            disabled={isLoading || fieldErrors.name !== ''}
            className="w-full bg-blue-600 text-white p-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                {isEdit ? 'Updating...' : 'Creating...'}
              </div>
            ) : (
              isEdit ? 'Update Student' : 'Add Student'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default StudentForm;