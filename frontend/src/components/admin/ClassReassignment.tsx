// frontend/src/components/admin/ClassReassignment.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { X, UserCheck, Calendar, MapPin, Users, Clock, AlertCircle, Loader2 } from 'lucide-react';
import type { UnassignedClass, StaffMember } from '../../types';
import AdminService from '../../services/admin';
import ClassService from '../../services/class';

// Interface for teacher's schedule class (from ClassForm.tsx)
interface TeacherScheduleClass {
  id: string;
  subject: string;
  level?: string;
  start_time: string;
  end_time?: string;
  duration_minutes: number;
  branch_id?: string;
  branch_name?: string;
}

const ClassReassignment: React.FC = () => {
  const [unassignedClasses, setUnassignedClasses] = useState<UnassignedClass[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Assignment modal states
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedClass, setSelectedClass] = useState<UnassignedClass | null>(null);
  const [selectedTutor, setSelectedTutor] = useState('');
  const [assigning, setAssigning] = useState(false);
  
  // Conflict validation states
  const [validatingConflicts, setValidatingConflicts] = useState(false);
  const [scheduleConflicts, setScheduleConflicts] = useState<{ direct: TeacherScheduleClass[], travel: TeacherScheduleClass[] } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [classesList, staffList] = await Promise.all([
        AdminService.getUnassignedClasses(),
        AdminService.getAllStaff()
      ]);
      
      setUnassignedClasses(classesList);
      setStaff(staffList.filter(s => s.active)); // Only active staff for assignment
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to format time
  const formatTime = useCallback((timeString: string): string => {
    const date = new Date(timeString);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  }, []);

  // Function to check teacher's schedule conflicts (similar to ClassForm.tsx)
  const checkTeacherScheduleConflicts = useCallback(async (tutorId: string, classData: UnassignedClass): Promise<{ direct: TeacherScheduleClass[], travel: TeacherScheduleClass[] }> => {
    try {
      // Get teacher's classes for the selected date
      const classDate = new Date(classData.start_time).toISOString().split('T')[0];
      
      console.log('=== DEBUGGING API CALL ===');
      console.log('Requesting classes for date:', classDate);
      console.log('API parameters:', { startDate: classDate, endDate: classDate });
      
      const teacherClasses = await ClassService.getAllClasses({
        startDate: classDate,
        endDate: classDate
      });
      
      // Debug logging
      console.log('=== API RESPONSE ANALYSIS ===');
      console.log('Total classes returned for date:', teacherClasses.length);
      console.log('Target tutor ID:', tutorId);
      console.log('Target class ID we are assigning to:', classData.id);
      console.log('All classes returned:', teacherClasses.map(cls => ({ 
        id: cls.id, 
        subject: cls.subject, 
        tutor_id: cls.tutor_id,
        tutor_name: cls.tutor_first_name ? `${cls.tutor_first_name} ${cls.tutor_last_name}` : 'No tutor',
        start_time: cls.start_time,
        branch_name: cls.branch_name
      })));
      
      // Filter classes for the specific tutor only - be very explicit about this
      const tutorOnlyClasses = teacherClasses.filter(cls => {
        const isSameTutor = cls.tutor_id === tutorId;
        const isDifferentClass = cls.id !== classData.id;
        const hasTutor = cls.tutor_id != null; // Exclude unassigned classes
        
        console.log(`Class ${cls.id} (${cls.subject}): tutor_id=${cls.tutor_id}, isSameTutor=${isSameTutor}, isDifferentClass=${isDifferentClass}, hasTutor=${hasTutor}`);
        
        return isSameTutor && isDifferentClass && hasTutor;
      });
      
      console.log('=== FILTERING RESULTS ===');
      console.log('Classes after filtering for target tutor:', tutorOnlyClasses.length);
      if (tutorOnlyClasses.length === 0) {
        console.log('⚠️ NO CLASSES FOUND FOR THIS TUTOR ON THIS DATE');
        console.log('This could mean:');
        console.log('1. The tutor really has no other classes that day (OK)');
        console.log('2. The API is not returning all classes (BUG)');
        console.log('3. The tutor ID is wrong (BUG)');
      }
      
      // Convert to TeacherScheduleClass format
      const teacherSchedule: TeacherScheduleClass[] = tutorOnlyClasses.map(cls => ({
        id: cls.id,
        subject: cls.subject,
        level: cls.level,
        start_time: cls.start_time,
        end_time: cls.end_time || new Date(new Date(cls.start_time).getTime() + cls.duration_minutes * 60000).toISOString(),
        duration_minutes: cls.duration_minutes,
        branch_id: cls.branch_id,
        branch_name: cls.branch_name
      }));

      const newClassStart = new Date(classData.start_time);
      const newClassEnd = new Date(newClassStart.getTime() + classData.duration_minutes * 60000);

      console.log('New class time:', newClassStart.toISOString(), 'to', newClassEnd.toISOString());
      console.log('Checking against', teacherSchedule.length, 'existing classes for this tutor');

      const directConflicts: TeacherScheduleClass[] = [];
      const travelConflicts: TeacherScheduleClass[] = [];

      for (const existingClass of teacherSchedule) {
        const existingStart = new Date(existingClass.start_time);
        const existingEnd = new Date(existingClass.end_time!);

        console.log(`Checking class ${existingClass.id} (${existingClass.subject}): ${existingStart.toISOString()} to ${existingEnd.toISOString()}`);

        // Check for direct time overlap
        const hasDirectOverlap = (newClassStart < existingEnd && newClassEnd > existingStart);
        
        console.log(`  Direct overlap check: ${hasDirectOverlap}`);
        
        if (hasDirectOverlap) {
          console.log(`  -> DIRECT CONFLICT DETECTED`);
          directConflicts.push(existingClass);
          continue; // Don't check travel time if there's direct conflict
        }

        // Check for travel time conflicts (only if different branches)
        if (classData.branch_id !== existingClass.branch_id) {
          const oneHourBefore = new Date(newClassStart.getTime() - 60 * 60 * 1000); // 1 hour before new class
          const oneHourAfter = new Date(newClassEnd.getTime() + 60 * 60 * 1000); // 1 hour after new class

          // Check if existing class ends too close to new class start (need 1 hour to travel)
          const existingEndsTooClose = existingEnd > oneHourBefore && existingEnd <= newClassStart;
          
          // Check if existing class starts too close to new class end (need 1 hour to travel)
          const existingStartsTooClose = existingStart >= newClassEnd && existingStart < oneHourAfter;

          console.log(`  Travel time check (different branches): existingEndsTooClose=${existingEndsTooClose}, existingStartsTooClose=${existingStartsTooClose}`);

          if (existingEndsTooClose || existingStartsTooClose) {
            console.log(`  -> TRAVEL CONFLICT DETECTED`);
            travelConflicts.push(existingClass);
          }
        } else {
          console.log(`  Same branch - no travel time needed`);
        }
      }

      console.log('Final conflicts:', { direct: directConflicts.length, travel: travelConflicts.length });
      return { direct: directConflicts, travel: travelConflicts };
    } catch (err) {
      console.error('Failed to check teacher schedule:', err);
      return { direct: [], travel: [] };
    }
  }, []);

  // Helper function to format teacher schedule conflicts
  const formatTeacherConflictMessage = useCallback((conflicts: { direct: TeacherScheduleClass[], travel: TeacherScheduleClass[] }, tutorName: string): string => {
    let message = '';
    
    if (conflicts.direct.length > 0) {
      const conflictDetails = conflicts.direct.map(conflict => {
        const startTime = formatTime(conflict.start_time);
        const endTime = conflict.end_time ? formatTime(conflict.end_time) : formatTime(new Date(new Date(conflict.start_time).getTime() + conflict.duration_minutes * 60000).toISOString());
        const levelText = conflict.level ? ` (${conflict.level})` : '';
        const branchText = conflict.branch_name ? ` at ${conflict.branch_name}` : '';
        
        return `• "${conflict.subject}"${levelText} from ${startTime} to ${endTime}${branchText}`;
      }).join('\n');

      const conflictCount = conflicts.direct.length;
      const conflictWord = conflictCount === 1 ? 'class' : 'classes';
      
      message += `${tutorName} already has ${conflictCount} ${conflictWord} scheduled at the same time:\n\n${conflictDetails}`;
    }
    
    if (conflicts.travel.length > 0) {
      if (message) message += '\n\n';
      
      const travelDetails = conflicts.travel.map(conflict => {
        const startTime = formatTime(conflict.start_time);
        const endTime = conflict.end_time ? formatTime(conflict.end_time) : formatTime(new Date(new Date(conflict.start_time).getTime() + conflict.duration_minutes * 60000).toISOString());
        const levelText = conflict.level ? ` (${conflict.level})` : '';
        const branchText = conflict.branch_name ? ` at ${conflict.branch_name}` : '';
        
        return `• "${conflict.subject}"${levelText} from ${startTime} to ${endTime}${branchText}`;
      }).join('\n');

      const conflictCount = conflicts.travel.length;
      const conflictWord = conflictCount === 1 ? 'class' : 'classes';
      
      message += `${tutorName} has ${conflictCount} ${conflictWord} at different branch(es) that require at least 1 hour buffer time:\n\n${travelDetails}`;
    }
    
    return message;
  }, [formatTime]);

  const handleAssignTutor = (classItem: UnassignedClass) => {
    setSelectedClass(classItem);
    setSelectedTutor('');
    setScheduleConflicts(null);
    setShowAssignModal(true);
  };

  const handleTutorSelection = async (tutorId: string) => {
    setSelectedTutor(tutorId);
    setScheduleConflicts(null);
    
    if (tutorId && selectedClass) {
      setValidatingConflicts(true);
      try {
        const conflicts = await checkTeacherScheduleConflicts(tutorId, selectedClass);
        setScheduleConflicts(conflicts);
      } catch (err) {
        console.error('Failed to validate schedule:', err);
        setError('Failed to validate tutor schedule');
      } finally {
        setValidatingConflicts(false);
      }
    }
  };

  const handleAssignSubmit = async () => {
    if (!selectedClass || !selectedTutor) return;
    
    setAssigning(true);
    try {
      await AdminService.assignTutorToClass(selectedClass.id, { tutorId: selectedTutor });
      
      // Refresh data
      await loadData();
      
      setShowAssignModal(false);
      setSelectedClass(null);
      setSelectedTutor('');
      setScheduleConflicts(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign tutor');
    } finally {
      setAssigning(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-SG', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const getAvailableSpots = (classItem: UnassignedClass) => {
    return classItem.capacity - classItem.enrolled_count;
  };

  const isUpcoming = (classItem: UnassignedClass) => {
    return new Date(classItem.start_time) > new Date();
  };

  const selectedTutorData = staff.find(s => s.id === selectedTutor);
  const tutorName = selectedTutorData ? `${selectedTutorData.first_name} ${selectedTutorData.last_name}` : '';
  const hasConflicts = Boolean(scheduleConflicts && (scheduleConflicts.direct.length > 0 || scheduleConflicts.travel.length > 0));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center space-x-3">
          <Loader2 className="animate-spin text-indigo-600" size={24} />
          <span className="text-lg text-gray-700">Loading classes...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-16">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-3">
          <UserCheck className="text-indigo-500" size={32} />
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Class Assignments</h1>
            <p className="text-gray-600">Assign tutors to classes without teachers</p>
          </div>
        </div>
        
        <button
          onClick={loadData}
          className="flex items-center space-x-2 px-4 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>Refresh</span>
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600">{error}</p>
          <button
            onClick={() => setError('')}
            className="mt-2 text-sm text-red-700 hover:text-red-800 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
          <div className="flex items-center space-x-3 mb-2">
            <AlertCircle className="text-gray-600" size={24} />
            <h3 className="text-lg font-semibold text-gray-800">Unassigned Classes</h3>
          </div>
          <p className="text-2xl font-bold text-orange-600">{unassignedClasses.length}</p>
          <p className="text-sm text-gray-500 mt-1">Classes without tutors</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
          <div className="flex items-center space-x-3 mb-2">
            <Calendar className="text-gray-600" size={24} />
            <h3 className="text-lg font-semibold text-gray-800">Upcoming Classes</h3>
          </div>
          <p className="text-2xl font-bold text-blue-600">
            {unassignedClasses.filter(isUpcoming).length}
          </p>
          <p className="text-sm text-gray-500 mt-1">Need urgent assignment</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
          <div className="flex items-center space-x-3 mb-2">
            <Users className="text-gray-600" size={24} />
            <h3 className="text-lg font-semibold text-gray-800">Available Staff</h3>
          </div>
          <p className="text-2xl font-bold text-green-600">{staff.length}</p>
          <p className="text-sm text-gray-500 mt-1">Active staff members</p>
        </div>
      </div>

      {/* Classes Grid */}
      {unassignedClasses.length === 0 ? (
        <div className="text-center py-12">
          <UserCheck className="mx-auto text-gray-300 mb-4" size={64} />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">All Classes Assigned!</h3>
          <p className="text-gray-500">
            Great! All classes currently have assigned tutors.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800">Classes Needing Assignment</h2>
            <span className="text-sm text-gray-500">
              {unassignedClasses.length} class{unassignedClasses.length !== 1 ? 'es' : ''} total
            </span>
          </div>

          <div className="grid gap-4">
            {unassignedClasses.map((classItem) => {
              const upcoming = isUpcoming(classItem);
              
              return (
                <div
                  key={classItem.id}
                  className={`
                    bg-white rounded-2xl shadow-lg border-l-4 p-6 transition-all hover:shadow-xl
                    ${upcoming ? 'border-l-orange-500' : 'border-l-gray-300'}
                  `}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        <div>
                          <h3 className="text-xl font-bold text-gray-800">{classItem.subject}</h3>
                          {classItem.description && (
                            <p className="text-gray-600 text-sm mt-1">{classItem.description}</p>
                          )}
                          {upcoming && (
                            <span className="inline-block mt-2 px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                              Upcoming - Needs Urgent Assignment
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-600">
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <Calendar size={16} />
                            <span>{formatDateTime(classItem.start_time)}</span>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <Clock size={16} />
                            <span>{formatDuration(classItem.duration_minutes)}</span>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <MapPin size={16} />
                            <span>{classItem.branch_name} ({classItem.classroom_name})</span>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <Users size={16} />
                            <span>{classItem.enrolled_count}/{classItem.capacity} enrolled ({getAvailableSpots(classItem)} spots left)</span>
                          </div>
                        </div>
                      </div>

                      {classItem.level && (
                        <div className="mt-2">
                          <span className="inline-block px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded">
                            {classItem.level}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <div className="ml-6 flex flex-col space-y-2">
                      <button
                        onClick={() => handleAssignTutor(classItem)}
                        className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors text-sm font-medium"
                      >
                        Assign Tutor
                      </button>
                      
                      {classItem.enrolled_count > 0 && (
                        <div className="text-xs text-gray-500 text-center">
                          {classItem.enrolled_count} student{classItem.enrolled_count !== 1 ? 's' : ''} waiting
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Assignment Modal */}
      {showAssignModal && selectedClass && (
        <div className="fixed inset-0 bg-gradient-to-br from-white-100 to-indigo-200 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md relative shadow-2xl">
            <button
              onClick={() => setShowAssignModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
              type="button"
            >
              <X size={24} />
            </button>
            
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Assign Tutor</h2>
            
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">{selectedClass.subject}</h3>
              <div className="text-sm text-gray-600 space-y-1">
                <p>{formatDateTime(selectedClass.start_time)}</p>
                <p>{selectedClass.branch_name}</p>
                <p>{selectedClass.classroom_name}</p>
                <p>{formatDuration(selectedClass.duration_minutes)}</p>
                <p>{selectedClass.enrolled_count}/{selectedClass.capacity} students enrolled</p>
              </div>
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Tutor
              </label>
              <select
                value={selectedTutor}
                onChange={(e) => handleTutorSelection(e.target.value)}
                className="w-full p-3 border border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
                disabled={validatingConflicts}
              >
                <option value="">Choose a staff member</option>
                {staff.map((staffMember) => (
                  <option key={staffMember.id} value={staffMember.id}>
                    {staffMember.first_name} {staffMember.last_name} ({staffMember.email})
                  </option>
                ))}
              </select>
              
              {validatingConflicts && (
                <div className="mt-2 flex items-center space-x-2 text-blue-600">
                  <Loader2 className="animate-spin" size={16} />
                  <span className="text-sm">Checking schedule conflicts...</span>
                </div>
              )}
            </div>

            {/* Schedule Conflict Warning */}
            {selectedTutor && scheduleConflicts && hasConflicts && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start space-x-3">
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-red-800 mb-2">Schedule Conflict Detected</h4>
                    <p className="text-sm text-red-700 whitespace-pre-line">
                      {formatTeacherConflictMessage(scheduleConflicts, tutorName)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* No Conflicts - Success Indicator */}
            {selectedTutor && scheduleConflicts && !hasConflicts && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-green-800">
                    No schedule conflicts. {tutorName} is available for this class.
                  </span>
                </div>
              </div>
            )}
            
            <div className="flex space-x-3">
              <button
                onClick={() => setShowAssignModal(false)}
                className="flex-1 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignSubmit}
                disabled={!selectedTutor || assigning}
                className="flex-1 px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {assigning ? 'Assigning...' : 'Assign Tutor'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClassReassignment;