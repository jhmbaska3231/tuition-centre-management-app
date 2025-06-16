// frontend/src/components/admin/ClassroomForm.tsx

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Classroom, CreateClassroomRequest, UpdateClassroomRequest } from '../../types';
import ClassroomService from '../../services/classroom';

interface ClassroomFormProps {
  classroom?: Classroom | null;
  branchId: string;
  branchName: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const ClassroomForm: React.FC<ClassroomFormProps> = ({
  classroom,
  branchId,
  branchName,
  onSuccess,
  onCancel,
}) => {
  const [formData, setFormData] = useState({
    room_name: '',
    description: '',
    room_capacity: 20,
    active: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({
    room_name: '',
    room_capacity: '',
  });

  const isEditing = !!classroom;

  useEffect(() => {
    if (classroom) {
      setFormData({
        room_name: classroom.room_name,
        description: classroom.description || '',
        room_capacity: classroom.room_capacity,
        active: classroom.active,
      });
    } else {
      // Reset form for new classroom
      setFormData({
        room_name: '',
        description: '',
        room_capacity: 20,
        active: true,
      });
    }
    setError('');
    setFieldErrors({
      room_name: '',
      room_capacity: '',
    });
  }, [classroom]);

  const validateField = (field: string, value: any): boolean => {
    let error = '';
    
    switch (field) {
      case 'room_name':
        if (!value || value.trim().length < 2) {
          error = 'Room name must be at least 2 characters long';
        }
        break;
      case 'room_capacity':
        if (!value || value < 1 || value > 50) {
          error = 'Capacity must be between 1 and 50';
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
    if (field === 'room_name' || field === 'room_capacity') {
      validateField(field, value);
    }
  };

  const validateForm = (): boolean => {
    const nameValid = validateField('room_name', formData.room_name);
    const capacityValid = validateField('room_capacity', formData.room_capacity);
    
    return nameValid && capacityValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      setError('Please correct the errors above');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (isEditing) {
        const updateData: UpdateClassroomRequest = {
          room_name: formData.room_name.trim(),
          description: formData.description.trim() || undefined,
          room_capacity: formData.room_capacity,
          active: formData.active,
        };
        await ClassroomService.updateClassroom(classroom.id, updateData);
      } else {
        const createData: CreateClassroomRequest = {
          room_name: formData.room_name.trim(),
          description: formData.description.trim() || undefined,
          room_capacity: formData.room_capacity,
          branch_id: branchId,
        };
        await ClassroomService.createClassroom(createData);
      }
      
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onCancel();
    setFormData({
      room_name: '',
      description: '',
      room_capacity: 20,
      active: true,
    });
    setError('');
    setFieldErrors({
      room_name: '',
      room_capacity: '',
    });
  };

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
          {isEditing ? 'Edit Classroom' : 'Add New Classroom'}
        </h2>

        <div className="mb-6 text-center">
          <div className="text-gray-600">
            <span className="text-sm font-medium">{branchName}</span>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Room Name Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Room Name *
            </label>
            <input
              type="text"
              value={formData.room_name}
              onChange={(e) => handleInputChange('room_name', e.target.value)}
              className={`w-full p-3 border-2 rounded-lg focus:outline-none transition-colors ${
                fieldErrors.room_name 
                  ? 'border-red-300 focus:border-red-500' 
                  : 'border-gray-200 focus:border-indigo-500'
              }`}
              placeholder="e.g. Room A1, Classroom 101, Conference Room"
              required
            />
            {fieldErrors.room_name && (
              <p className="text-red-600 text-sm mt-1">{fieldErrors.room_name}</p>
            )}
          </div>

          {/* Description Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none transition-colors"
              placeholder="Optional description of the classroom (e.g. whiteboard, projector, air-conditioned)"
              rows={3}
            />
          </div>

          {/* Room Capacity Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Room Capacity *
            </label>
            <input
              type="number"
              min="1"
              max="100"
              value={formData.room_capacity}
              onChange={(e) => handleInputChange('room_capacity', parseInt(e.target.value) || 0)}
              className={`w-full p-3 border-2 rounded-lg focus:outline-none transition-colors ${
                fieldErrors.room_capacity 
                  ? 'border-red-300 focus:border-red-500' 
                  : 'border-gray-200 focus:border-indigo-500'
              }`}
              placeholder="20"
              required
            />
            {fieldErrors.room_capacity && (
              <p className="text-red-600 text-sm mt-1">{fieldErrors.room_capacity}</p>
            )}
            <p className="text-sm text-gray-500 mt-1">
              Maximum number of students that can be accommodated in this classroom. 
              Teachers cannot create classes that exceed this capacity when selecting this classroom.
            </p>
          </div>

          {/* Active Status (only for editing) */}
          {isEditing && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={formData.active}
                  onChange={(e) => handleInputChange('active', e.target.checked)}
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Classroom is Active (Operational)
                </span>
              </label>
              <div className="mt-2 text-sm text-gray-600">
                <p className="mb-1">
                  <span className="font-medium">Active: </span>
                  Classroom is available for class scheduling and is visible to staff members.
                </p>
                <p>
                  <span className="font-medium">Inactive: </span> 
                  Classroom is temporarily unavailable (e.g. under maintenance) but data is preserved. Any existing classes with this classroom will remain.
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="flex-1 px-4 py-3 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.room_name.trim() || formData.room_capacity < 1}
              className="flex-1 bg-indigo-500 text-white p-3 rounded-lg font-semibold hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  {isEditing ? 'Updating...' : 'Creating...'}
                </div>
              ) : (
                isEditing ? 'Update Classroom' : 'Create Classroom'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ClassroomForm;