// frontend/src/components/admin/ClassroomForm.tsx

import React, { useState, useEffect } from 'react';
import { X, Loader2, MapPin } from 'lucide-react';
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

  const isEditing = !!classroom;

  useEffect(() => {
    if (classroom) {
      setFormData({
        room_name: classroom.room_name,
        description: classroom.description || '',
        room_capacity: classroom.room_capacity,
        active: classroom.active,
      });
    }
  }, [classroom]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (name === 'room_capacity') {
      setFormData(prev => ({ ...prev, [name]: parseInt(value) || 1 }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white rounded-t-2xl border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <MapPin className="text-indigo-500" size={24} />
              <div>
                <h2 className="text-xl font-bold text-gray-800">
                  {isEditing ? 'Edit Classroom' : 'Create New Classroom'}
                </h2>
                <p className="text-sm text-gray-600">For {branchName}</p>
              </div>
            </div>
            <button
              onClick={onCancel}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* Room Name */}
          <div>
            <label htmlFor="room_name" className="block text-sm font-medium text-gray-700 mb-2">
              Room Name *
            </label>
            <input
              type="text"
              id="room_name"
              name="room_name"
              value={formData.room_name}
              onChange={handleChange}
              required
              placeholder="e.g., Room A1, Computer Lab, Music Room"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
            />
            <p className="text-xs text-gray-500 mt-1">
              Must be unique within this branch
            </p>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              placeholder="Optional description of the classroom facilities and features"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors resize-none"
            />
          </div>

          {/* Room Capacity */}
          <div>
            <label htmlFor="room_capacity" className="block text-sm font-medium text-gray-700 mb-2">
              Room Capacity *
            </label>
            <input
              type="number"
              id="room_capacity"
              name="room_capacity"
              value={formData.room_capacity}
              onChange={handleChange}
              min="1"
              max="200"
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
            />
            <p className="text-xs text-gray-500 mt-1">
              Maximum number of students for fire safety (1-200)
            </p>
          </div>

          {/* Active Status (only for editing) */}
          {isEditing && (
            <div>
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  name="active"
                  checked={formData.active}
                  onChange={handleChange}
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Active Classroom
                </span>
              </label>
              <p className="text-xs text-gray-500 mt-1">
                Inactive classrooms cannot be assigned to new classes
              </p>
            </div>
          )}

          {/* Fire Safety Warning */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-yellow-800 mb-1">Fire Safety Notice</h4>
            <p className="text-xs text-yellow-700">
              The room capacity sets the maximum limit for class sizes. Teachers cannot create classes 
              that exceed this capacity when selecting this classroom.
            </p>
          </div>

          {/* Buttons */}
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.room_name.trim() || formData.room_capacity < 1}
              className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <Loader2 className="animate-spin mr-2" size={16} />
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