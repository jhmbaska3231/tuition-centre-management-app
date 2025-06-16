// frontend/src/components/staff/ClassForm.tsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { X } from 'lucide-react';
import type { Class, Branch, Classroom, CreateClassRequest, UpdateClassRequest, ClassroomAvailability } from '../../types';
import ClassService from '../../services/class';
import BranchService from '../../services/branch';
import ClassroomService from '../../services/classroom';
import DateInput from '../common/DateInput';

// Crucial card logic flow
// First opening: Modal opens → clears classrooms → form populates → branch changes → classrooms reload
// Second opening: Modal opens → clears classrooms → form populates with same branch → new effect detects we have branchId but no classrooms → classrooms reload

// Create mode: Modal opens → explicitly reset formData to fresh copy of INITIAL_FORM_DATA → clears any visual state in DateInput
// Edit mode: Modal opens → populate formData with class data → DateInput shows the correct date
// Mode switching: Each time modal opens, it explicitly sets the form state based on the mode

interface ClassFormProps {
  isOpen: boolean;
  onClose: () => void;
  classData?: Class | null;
  onSuccess: () => void;
}

interface FormData {
  subject: string;
  description: string;
  level: string;
  startDate: string;
  startTime: string;
  durationMinutes: number;
  capacity: number;
  branchId: string;
  classroomId: string;
}

interface FieldErrors {
  subject: string;
  level: string;
  startDate: string;
  startTime: string;
  durationMinutes: string;
  capacity: string;
  branchId: string;
  classroomId: string;
}

const INITIAL_FORM_DATA: FormData = {
  subject: '',
  description: '',
  level: '',
  startDate: '',
  startTime: '10:00',
  durationMinutes: 60,
  capacity: 10,
  branchId: '',
  classroomId: '',
};

const INITIAL_FIELD_ERRORS: FieldErrors = {
  subject: '',
  level: '',
  startDate: '',
  startTime: '',
  durationMinutes: '',
  capacity: '',
  branchId: '',
  classroomId: '',
};

const ClassForm: React.FC<ClassFormProps> = ({ isOpen, onClose, classData, onSuccess }) => {
  // Form state
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM_DATA);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>(INITIAL_FIELD_ERRORS);
  const [error, setError] = useState('');

  // Data state
  const [branches, setBranches] = useState<Branch[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [classroomAvailability, setClassroomAvailability] = useState<ClassroomAvailability | null>(null);

  // Loading state
  const [isLoading, setIsLoading] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [loadingClassrooms, setLoadingClassrooms] = useState(false);
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  const isEdit = !!classData;

  // Memoized values
  const timeOptions = useMemo(() => {
    const options = [];
    for (let hour = 8; hour <= 20; hour++) {
      for (let minute of [0, 30]) {
        if (hour === 20 && minute === 30) break;
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
  }, []);

  const { minDate, maxDate } = useMemo(() => {
    const today = new Date();
    const oneMonthLater = new Date();
    oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
    
    return {
      minDate: today.toISOString().split('T')[0],
      maxDate: oneMonthLater.toISOString().split('T')[0],
    };
  }, []);

  // Optimized data loading functions
  const loadBranches = useCallback(async () => {
    if (branches.length > 0) return; // Avoid reloading if already loaded
    
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
  }, [branches.length]);

  const loadClassrooms = useCallback(async (branchId: string) => {
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
  }, []);

  const checkClassroomAvailability = useCallback(async () => {
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
  }, [formData.classroomId, formData.startDate, isEdit, classData?.id]);

  // Utility functions
  const combineDateTime = useCallback((date: string, time: string): string => {
    if (!date || !time) return '';
    return `${date}T${time}:00`;
  }, []);

  const resetForm = useCallback(() => {
    setFormData(INITIAL_FORM_DATA);
    setFieldErrors(INITIAL_FIELD_ERRORS);
    setError('');
    setClassroomAvailability(null);
  }, []);

  // Form validation
  const validateField = useCallback((field: keyof FormData, value: any): boolean => {
    let error = '';
    
    switch (field) {
      case 'subject':
        if (!value || value.trim().length < 2) {
          error = 'Subject must be at least 2 characters';
        }
        break;
      case 'level':
        if (!value || value.trim().length < 1) {
          error = 'Grade/Level is required';
        }
        break;
      case 'startDate':
        if (!value) {
          error = 'Start date is required';
        } else {
          const selectedDate = new Date(value);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          const oneMonthFromNow = new Date();
          oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
          oneMonthFromNow.setHours(23, 59, 59, 999);
          
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
        if (isNaN(cap) || cap < 1) {
          error = 'Capacity must be at least 1 student';
        } else if (isEdit && classData && cap < classData.enrolled_count) {
          error = `Capacity cannot be less than current enrollment (${classData.enrolled_count} students)`;
        } else if (formData.classroomId && classroomAvailability) {
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
      case 'classroomId':
        if (!value) {
          error = 'Classroom is required';
        }
        break;
    }
    
    setFieldErrors(prev => ({ ...prev, [field]: error }));
    return error === '';
  }, [formData.startDate, formData.classroomId, classroomAvailability, isEdit, classData, combineDateTime]);

  // Event handlers
  const handleInputChange = useCallback((field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
    
    // Real-time validation
    validateField(field, value);
    
    // Handle special cases
    if (field === 'startDate' && formData.startTime) {
      setTimeout(() => validateField('startTime', formData.startTime), 0);
    } else if (field === 'startTime' && formData.startDate) {
      setTimeout(() => validateField('startTime', value), 0);
    } else if (field === 'branchId') {
      setFormData(prev => ({ ...prev, classroomId: '' }));
      setClassroomAvailability(null);
    }
  }, [formData.startTime, formData.startDate, validateField]);

  const validateForm = useCallback((): boolean => {
    const fields: (keyof FormData)[] = [
      'subject', 'level', 'startDate', 'startTime', 
      'durationMinutes', 'capacity', 'branchId', 'classroomId'
    ];
    
    return fields.every(field => validateField(field, formData[field]));
  }, [formData, validateField]);

  const hasTimeConflict = useCallback((): boolean => {
    if (!classroomAvailability || !formData.startTime || !formData.durationMinutes) return false;

    const startTime = new Date(`${formData.startDate}T${formData.startTime}:00`);
    const endTime = new Date(startTime.getTime() + formData.durationMinutes * 60000);

    return classroomAvailability.occupied_slots.some(slot => {
      const slotStart = new Date(slot.start_time);
      const slotEnd = new Date(slot.end_time);
      return (startTime < slotEnd && endTime > slotStart);
    });
  }, [classroomAvailability, formData.startDate, formData.startTime, formData.durationMinutes]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      setError('Please correct the errors above');
      return;
    }

    if (hasTimeConflict()) {
      setError('This time slot conflicts with an existing class in the selected classroom');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
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
  }, [validateForm, hasTimeConflict, combineDateTime, formData, isEdit, classData, onSuccess]);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  // Effects
  useEffect(() => {
    if (isOpen) {
      setClassrooms([]);
      setClassroomAvailability(null);
      loadBranches();
    }
  }, [isOpen, loadBranches]);

  useEffect(() => {
    if (formData.branchId) {
      loadClassrooms(formData.branchId);
    } else {
      setClassrooms([]);
      setFormData(prev => ({ ...prev, classroomId: '' }));
    }
  }, [formData.branchId, loadClassrooms]);

  // Critical: Handle same-branch scenario (when modal opens but branch hasn't changed)
  useEffect(() => {
    if (isOpen && formData.branchId && classrooms.length === 0) {
      loadClassrooms(formData.branchId);
    }
  }, [isOpen, formData.branchId, classrooms.length, loadClassrooms]);

  // Auto-populate classroom when editing
  useEffect(() => {
    if (classData?.classroom_id && classrooms.length > 0 && !formData.classroomId) {
      const foundClassroom = classrooms.find(cr => cr.id === classData.classroom_id);
      if (foundClassroom) {
        setFormData(prev => ({ ...prev, classroomId: classData.classroom_id! }));
      }
    }
  }, [classData, classrooms, formData.classroomId]);

  useEffect(() => {
    checkClassroomAvailability();
  }, [checkClassroomAvailability]);

  // Populate form when editing OR reset for create mode
  useEffect(() => {
    if (isOpen) {
      if (classData) {
        // Edit mode: populate with existing class data
        const startDateTime = new Date(classData.start_time);
        const localDate = startDateTime.toISOString().split('T')[0];
        const localTime = startDateTime.toTimeString().slice(0, 5);

        setFormData({
          subject: classData.subject,
          description: classData.description || '',
          level: classData.level || '',
          startDate: localDate,
          startTime: localTime,
          durationMinutes: classData.duration_minutes,
          capacity: classData.capacity,
          branchId: classData.branch_id || '',
          classroomId: '', // Will be set by auto-populate effect
        });
      } else {
        // Create mode: explicitly reset to initial state
        setFormData({ ...INITIAL_FORM_DATA });
      }

      // Always reset errors and availability when modal opens
      setFieldErrors({ ...INITIAL_FIELD_ERRORS });
      setError('');
      setClassroomAvailability(null);
    }
  }, [classData, isOpen]);

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
          {isEdit ? 'Edit Class' : 'Create New Class'}
        </h2>
        
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
                <option value="">Select Branch *</option>
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
              Classroom *
            </label>
            {loadingClassrooms || checkingAvailability ? (
              <div className="p-3 border-2 border-gray-200 rounded-lg bg-gray-50">
                <span className="text-gray-500">
                  {loadingClassrooms ? 'Loading classrooms...' : 'Checking availability...'}
                </span>
              </div>
            ) : (
              <select
                value={formData.classroomId}
                onChange={(e) => handleInputChange('classroomId', e.target.value)}
                className={`w-full p-3 border-2 rounded-lg focus:outline-none transition-colors ${
                  fieldErrors.classroomId 
                    ? 'border-red-300 focus:border-red-500' 
                    : 'border-gray-200 focus:border-indigo-500'
                }`}
                disabled={!formData.branchId}
                required
              >
                <option value="">
                  {!formData.branchId ? 'Please select a branch first' : 'Select Classroom *'}
                </option>
                {classrooms.map(classroom => (
                  <option key={classroom.id} value={classroom.id}>
                    {classroom.room_name} (Capacity: {classroom.room_capacity})
                  </option>
                ))}
              </select>
            )}
            {fieldErrors.classroomId && (
              <p className="text-red-600 text-sm mt-1">{fieldErrors.classroomId}</p>
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
                max={classroomAvailability ? classroomAvailability.classroom.room_capacity : undefined}
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

export default React.memo(ClassForm);