// frontend/src/components/staff/ClassForm.tsx

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Class, Branch, Classroom, CreateClassRequest, UpdateClassRequest, ClassroomAvailability } from '../../types';
import ClassService from '../../services/class';
import BranchService from '../../services/branch';
import ClassroomService from '../../services/classroom';
import DateInput from '../common/DateInput';
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
    startDate: '',
    startTime: '',
    durationMinutes: 60,
    capacity: 10,
    branchId: '',
    classroomId: '',
  });
  const [branches, setBranches] = useState<Branch[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [classroomAvailability, setClassroomAvailability] = useState<ClassroomAvailability | null>(null);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({
    subject: '',
    level: '',
    startDate: '',
    startTime: '',
    durationMinutes: '',
    capacity: '',
    branchId: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [loadingClassrooms, setLoadingClassrooms] = useState(false);
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  const isEdit = !!classData;

  // Load branches on component mount
  useEffect(() => {
    if (isOpen) {
      loadBranches();
    }
  }, [isOpen]);

  // Load classrooms when branch changes
  useEffect(() => {
    if (formData.branchId) {
      loadClassrooms(formData.branchId);
    } else {
      setClassrooms([]);
      setFormData(prev => ({ ...prev, classroomId: '' }));
    }
  }, [formData.branchId]);

  // Check classroom availability when classroom, date, or time changes
  useEffect(() => {
    if (formData.classroomId && formData.startDate && formData.startTime) {
      checkClassroomAvailability();
    } else {
      setClassroomAvailability(null);
    }
  }, [formData.classroomId, formData.startDate, formData.startTime, formData.durationMinutes]);

  // Populate form when editing
  useEffect(() => {
    if (classData) {
      // Split the start_time into date and time components
      const startDateTime = new Date(classData.start_time);
      const localDate = startDateTime.toISOString().split('T')[0]; // YYYY-MM-DD format
      const localTime = startDateTime.toTimeString().slice(0, 5); // HH:MM format

      setFormData({
        subject: classData.subject,
        description: classData.description || '',
        level: classData.level || '',
        startDate: localDate,
        startTime: localTime,
        durationMinutes: classData.duration_minutes,
        capacity: classData.capacity,
        branchId: classData.branch_id || '',
        classroomId: classData.classroom_id || '',
      });
    } else {
      // Reset form for new class with default time
      setFormData({
        subject: '',
        description: '',
        level: '',
        startDate: '',
        startTime: '10:00', // Default to 10:00 AM
        durationMinutes: 60,
        capacity: 10,
        branchId: '',
        classroomId: '',
      });
    }
    setError('');
    setFieldErrors({
      subject: '',
      level: '',
      startDate: '',
      startTime: '',
      durationMinutes: '',
      capacity: '',
      branchId: '',
    });
    setClassroomAvailability(null); // Reset availability
  }, [classData, isOpen, branches]);

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

  // Load classrooms
  const loadClassrooms = async (branchId: string) => {
    setLoadingClassrooms(true);
    try {
      const classroomList = await ClassroomService.getClassroomsByBranch(branchId);
      setClassrooms(classroomList);
    } catch (err) {
      console.error('Failed to load classrooms:', err);
      setError('Failed to load classrooms');
    } finally {
      setLoadingClassrooms(false);
    }
  };

  // Check classroom availability
  const checkClassroomAvailability = async () => {
    if (!formData.classroomId || !formData.startDate) return;

    setCheckingAvailability(true);
    try {
      const availability = await ClassroomService.getClassroomAvailability(
        formData.classroomId, 
        formData.startDate,
        isEdit ? classData?.id : undefined
      );
      setClassroomAvailability(availability);
    } catch (err) {
      console.error('Failed to check availability:', err);
    } finally {
      setCheckingAvailability(false);
    }
  };

  // Combine date and time into datetime string for validation and submission
  const combineDateTime = (date: string, time: string): string => {
    if (!date || !time) return '';
    return `${date}T${time}:00`; // Creates YYYY-MM-DDTHH:MM:SS format
  };

  // Get minimum date (today)
  const getMinDate = (): string => {
    return new Date().toISOString().split('T')[0];
  };

  // Get maximum date (1 month from today)
  const getMaxDate = (): string => {
    const oneMonthFromNow = new Date();
    oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
    return oneMonthFromNow.toISOString().split('T')[0];
  };

  const validateField = (field: string, value: any): boolean => {
    let error = '';
    
    switch (field) {
      case 'subject':
        if (!value || value.trim().length < 2) {
          error = 'Subject must be at least 2 characters';
        }
        break;
      case 'level':
        if (!value || value.trim().length < 1) {
          error = 'Level/Grade is required';
        }
        break;
      case 'startDate':
        if (!value) {
          error = 'Start date is required';
        } else {
          const selectedDate = new Date(value);
          const today = new Date();
          today.setHours(0, 0, 0, 0); // Reset time to start of day
          
          const oneMonthFromNow = new Date();
          oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
          oneMonthFromNow.setHours(23, 59, 59, 999); // End of day
          
          if (selectedDate < today) {
            error = 'Class date cannot be in the past';
          } else if (selectedDate > oneMonthFromNow) {
            error = 'Class date cannot be more than 1 month in the future';
          }
        }
        break;
      case 'startTime':
        if (!value) {
          error = 'Start time is required';
        } else if (formData.startDate) {
          // Check if the combined datetime is at least 1 hour from now
          const combinedDateTime = new Date(combineDateTime(formData.startDate, value));
          const oneHourFromNow = new Date();
          oneHourFromNow.setHours(oneHourFromNow.getHours() + 1);
          
          if (combinedDateTime <= oneHourFromNow) {
            error = 'Class must be scheduled at least 1 hour from now';
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
        else if (formData.classroomId && classroomAvailability) {
          // Check room capacity
          if (value > classroomAvailability.classroom.room_capacity) {
            error = `Capacity cannot exceed room limit of ${classroomAvailability.classroom.room_capacity}`;
          }
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
    
    // If date or time changes, revalidate the other field to check combined datetime
    if (field === 'startDate' && formData.startTime) {
      setTimeout(() => validateField('startTime', formData.startTime), 0);
    } else if (field === 'startTime' && formData.startDate) {
      setTimeout(() => validateField('startTime', value), 0);
      // Reset classroom when branch changes
    } if (field === 'branchId') {
      setFormData(prev => ({ ...prev, classroomId: '' }));
      setClassroomAvailability(null);
    }
  };

  const validateForm = (): boolean => {
    const subjectValid = validateField('subject', formData.subject);
    const levelValid = validateField('level', formData.level);
    const startDateValid = validateField('startDate', formData.startDate);
    const startTimeValid = validateField('startTime', formData.startTime);
    const durationValid = validateField('durationMinutes', formData.durationMinutes);
    const capacityValid = validateField('capacity', formData.capacity);
    const branchValid = validateField('branchId', formData.branchId);
    
    return subjectValid && levelValid && startDateValid && startTimeValid && durationValid && capacityValid && branchValid;
  };

  // Check for time conflicts
  const hasTimeConflict = (): boolean => {
    if (!classroomAvailability || !formData.startTime || !formData.durationMinutes) return false;

    const startTime = new Date(`${formData.startDate}T${formData.startTime}:00`);
    const endTime = new Date(startTime.getTime() + formData.durationMinutes * 60000);

    return classroomAvailability.occupied_slots.some(slot => {
      const slotStart = new Date(slot.start_time);
      const slotEnd = new Date(slot.end_time);
      
      return (startTime < slotEnd && endTime > slotStart);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      setError('Please correct the errors above');
      return;
    }

    // Check for time conflicts
    if (hasTimeConflict()) {
      setError('This time slot conflicts with an existing class in the selected classroom');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Combine date and time for submission
      const startDateTime = combineDateTime(formData.startDate, formData.startTime);
      
      const requestData: CreateClassRequest | UpdateClassRequest = {
        subject: formData.subject.trim(),
        description: formData.description.trim() || undefined,
        level: formData.level.trim(),
        startTime: startDateTime,
        durationMinutes: formData.durationMinutes,
        capacity: formData.capacity,
        branchId: formData.branchId,
        classroomId: formData.classroomId || undefined,
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
      startDate: '',
      startTime: '10:00',
      durationMinutes: 60,
      capacity: 10,
      branchId: '',
      classroomId: '',
    });
    setError('');
    setFieldErrors({
      subject: '',
      level: '',
      startDate: '',
      startTime: '',
      durationMinutes: '',
      capacity: '',
      branchId: '',
    });
    setClassroomAvailability(null); // Reset availability
    onClose();
  };

  if (!isOpen) return null;

  const getTutorName = () => {
    if (user) {
      return `${user.first_name} ${user.last_name}`;
    }
    return 'Current User';
  };

  // Generate time options (every 30 minutes from 8:00 to 20:00)
  const generateTimeOptions = () => {
    const options = [];
    for (let hour = 8; hour <= 20; hour++) {
      for (let minute of [0, 30]) {
        if (hour === 20 && minute === 30) break; // Stop at 20:00
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const displayTime = new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-SG', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
        options.push({ value: timeString, label: displayTime });
      }
    }
    return options;
  };

  const timeOptions = generateTimeOptions();
  const minDate = getMinDate();
  const maxDate = getMaxDate();

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
                    : 'border-gray-200 focus:border-indigo-500'
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
                Grade/Level *
              </label>
              <select
                value={formData.level}
                onChange={(e) => handleInputChange('level', e.target.value)}
                className={`w-full p-3 border-2 rounded-lg focus:outline-none transition-colors ${
                  fieldErrors.level 
                    ? 'border-red-300 focus:border-red-500' 
                    : 'border-gray-200 focus:border-indigo-500'
                }`}
                required
              >
                <option value="">Select Level *</option>
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
                <option value="Mixed Levels">Mixed Levels (All Grades)</option>
              </select>
              {fieldErrors.level && (
                <p className="text-red-600 text-sm mt-1">{fieldErrors.level}</p>
              )}
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
              className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none transition-colors"
              placeholder="Brief description of the class content and objectives"
              rows={3}
            />
          </div>

          {/* Branch Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Branch *
            </label>
            {loadingBranches ? (
              <div className="p-3 border-2 border-gray-200 rounded-lg">
                <span className="text-gray-500">Loading branches...</span>
              </div>
            ) : (
              <select
                value={formData.branchId}
                onChange={(e) => handleInputChange('branchId', e.target.value)}
                className={`w-full p-3 border-2 rounded-lg focus:outline-none transition-colors ${
                  fieldErrors.branchId 
                    ? 'border-red-300 focus:border-red-500' 
                    : 'border-gray-200 focus:border-indigo-500'
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

          {/* Classroom Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Classroom
            </label>
            {loadingClassrooms ? (
              <div className="p-3 border-2 border-gray-200 rounded-lg bg-gray-50">
                <span className="text-gray-500">Loading classrooms...</span>
              </div>
            ) : (
              <select
                value={formData.classroomId}
                onChange={(e) => handleInputChange('classroomId', e.target.value)}
                className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none transition-colors"
                disabled={!formData.branchId}
              >
                <option value="">No specific classroom</option>
                {classrooms.map(classroom => (
                  <option key={classroom.id} value={classroom.id}>
                    {classroom.room_name} (Capacity: {classroom.room_capacity})
                  </option>
                ))}
              </select>
            )}
            {formData.branchId && classrooms.length === 0 && !loadingClassrooms && (
              <p className="text-gray-500 text-xs mt-1">No classrooms available for this branch</p>
            )}
          </div>

          {/* Date and Time Row */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date *
              </label>
              <DateInput
                value={formData.startDate}
                onChange={(value) => handleInputChange('startDate', value)}
                className={`${
                  fieldErrors.startDate 
                    ? 'border-red-300 focus:border-red-500' 
                    : 'border-gray-200 focus:border-indigo-500'
                }`}
                placeholder="DD/MM/YYYY"
                min={minDate}
                max={maxDate}
                required
              />
              {fieldErrors.startDate && (
                <p className="text-red-600 text-sm mt-1">{fieldErrors.startDate}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Valid range: Today to {new Date(maxDate).toLocaleDateString('en-SG')}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Time *
              </label>
              <select
                value={formData.startTime}
                onChange={(e) => handleInputChange('startTime', e.target.value)}
                className={`w-full p-3 border-2 rounded-lg focus:outline-none transition-colors ${
                  fieldErrors.startTime 
                    ? 'border-red-300 focus:border-red-500' 
                    : 'border-gray-200 focus:border-indigo-500'
                }`}
                required
              >
                <option value="">Select Time *</option>
                {timeOptions.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              {fieldErrors.startTime && (
                <p className="text-red-600 text-sm mt-1">{fieldErrors.startTime}</p>
              )}
            </div>
          </div>

          {/* Duration and Capacity Row */}
          <div className="grid md:grid-cols-2 gap-4">
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
                    : 'border-gray-200 focus:border-indigo-500'
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
                    : 'border-gray-200 focus:border-indigo-500'
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
              {classroomAvailability && (
                <p className="text-gray-500 text-xs mt-1">
                  Room limit: {classroomAvailability.classroom.room_capacity} students
                </p>
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
              <span className="font-medium">Note:</span> Grade/Level is required for all classes. Use "Mixed Levels" for classes or activities that accept students of different grades.
              {isEdit ? ' Only future classes can be modified.' : ' Classes can be scheduled from today up to 1 month in advance, and must be at least 1 hour from now.'}
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