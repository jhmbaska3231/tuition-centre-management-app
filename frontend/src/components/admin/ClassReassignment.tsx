// frontend/src/components/admin/ClassReassignment.tsx

import React, { useState, useEffect } from 'react';
import { X, UserCheck, Calendar, MapPin, Users, Clock, AlertCircle, Loader2 } from 'lucide-react';
import type { UnassignedClass, StaffMember } from '../../types';
import AdminService from '../../services/admin';

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

  const handleAssignTutor = (classItem: UnassignedClass) => {
    setSelectedClass(classItem);
    setSelectedTutor('');
    setShowAssignModal(true);
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
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-800">
              Classes Requiring Assignment ({unassignedClasses.length})
            </h2>
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-red-200 rounded-full"></div>
                <span>Past</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-orange-200 rounded-full"></div>
                <span>Today</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-blue-200 rounded-full"></div>
                <span>Future</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {unassignedClasses
              .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
              .map((classItem) => {
                const classDate = new Date(classItem.start_time);
                const today = new Date();
                const isToday = classDate.toDateString() === today.toDateString();
                const isPast = classDate < today;
                const isFuture = classDate > today && !isToday;

                let borderColor = 'border-gray-200';
                let bgColor = 'bg-white';
                if (isPast) {
                  borderColor = 'border-red-200';
                  bgColor = 'bg-red-50';
                } else if (isToday) {
                  borderColor = 'border-orange-200';
                  bgColor = 'bg-orange-50';
                } else if (isFuture) {
                  borderColor = 'border-blue-200';
                  bgColor = 'bg-blue-50';
                }

                return (
                  <div key={classItem.id} className={`${bgColor} ${borderColor} border rounded-2xl p-6 hover:shadow-lg transition-shadow`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-xl font-bold text-gray-800">{classItem.subject}</h3>
                          {isPast && (
                            <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded-full">
                              Past Class
                            </span>
                          )}
                          {isToday && (
                            <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-semibold rounded-full">
                              Today
                            </span>
                          )}
                          {isFuture && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">
                              Upcoming
                            </span>
                          )}
                        </div>
                        
                        {classItem.description && (
                          <p className="text-gray-600 mb-3">{classItem.description}</p>
                        )}
                        
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
                onChange={(e) => setSelectedTutor(e.target.value)}
                className="w-full p-3 border border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
              >
                <option value="">Choose a staff member</option>
                {staff.map((staffMember) => (
                  <option key={staffMember.id} value={staffMember.id}>
                    {staffMember.first_name} {staffMember.last_name} ({staffMember.email})
                  </option>
                ))}
              </select>
            </div>
            
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