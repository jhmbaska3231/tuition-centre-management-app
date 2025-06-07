// src/components/parent/ClassOperations.tsx

import React, { useState, useEffect } from 'react';
import { Calendar, MapPin, Users, Clock, Plus, X, Loader2, Filter } from 'lucide-react';
import type { Class, Enrollment, Student, Branch } from '../../types';
import ClassService from '../../services/class';
import EnrollmentService from '../../services/enrollment';
import StudentService from '../../services/student';
import BranchService from '../../services/branch';

interface ClassOperationsProps {
  refreshTrigger?: number; // Optional prop to trigger refresh from parent
}

const ClassOperations: React.FC<ClassOperationsProps> = ({ refreshTrigger = 0 }) => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [allClasses, setAllClasses] = useState<Class[]>([]); // Store all classes for subject extraction
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filter states
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Modal states
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  
  // Cancellation confirmation state
  const [showCancelConfirm, setShowCancelConfirm] = useState<Enrollment | null>(null);
  const [cancelling, setCancelling] = useState(false);
  
  // View toggle
  const [activeView, setActiveView] = useState<'browse' | 'enrollments'>('browse');

  // Load initial data when component mounts
  useEffect(() => {
    loadInitialData();
  }, []);

  // Refresh when refreshTrigger prop changes
  useEffect(() => {
    if (refreshTrigger > 0) {
      loadInitialData();
    }
  }, [refreshTrigger]);

  // Load classes when filters change or view changes to browse
  useEffect(() => {
    if (activeView === 'browse') {
      loadClasses();
    }
  }, [selectedBranch, selectedSubject, startDate, endDate, activeView]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [studentList, branchList, enrollmentList] = await Promise.all([
        StudentService.getMyStudents(),
        BranchService.getAllBranches(),
        EnrollmentService.getMyStudentsEnrollments()
      ]);
      
      setStudents(studentList);
      setBranches(branchList);
      setEnrollments(enrollmentList);
      
      // Set default date range (next 30 days)
      const today = new Date();
      const nextMonth = new Date();
      nextMonth.setDate(today.getDate() + 30);
      
      setStartDate(today.toISOString().split('T')[0]);
      setEndDate(nextMonth.toISOString().split('T')[0]);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadClasses = async () => {
    try {
      const filters: any = {};
      if (selectedBranch) filters.branchId = selectedBranch;
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;
      
      const classList = await ClassService.getAllClasses(filters);
      
      // Store all classes for subject extraction
      setAllClasses(classList);
      
      // Apply subject filter on frontend if selected
      const filteredClasses = selectedSubject 
        ? classList.filter(cls => cls.subject.toLowerCase().includes(selectedSubject.toLowerCase()))
        : classList;
        
      setClasses(filteredClasses);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load classes');
    }
  };

  const handleEnrollClick = (classItem: Class) => {
    setSelectedClass(classItem);
    setSelectedStudent('');
    setShowEnrollModal(true);
  };

  const handleEnrollSubmit = async () => {
    if (!selectedClass || !selectedStudent) return;
    
    setEnrolling(true);
    try {
      await EnrollmentService.createEnrollment({
        studentId: selectedStudent,
        classId: selectedClass.id
      });
      
      // Refresh both enrollments and classes to get updated counts
      const [enrollmentList, classList] = await Promise.all([
        EnrollmentService.getMyStudentsEnrollments(),
        ClassService.getAllClasses({
          branchId: selectedBranch || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined
        })
      ]);
      
      setEnrollments(enrollmentList);
      setAllClasses(classList);
      
      // Apply subject filter
      const filteredClasses = selectedSubject 
        ? classList.filter(cls => cls.subject.toLowerCase().includes(selectedSubject.toLowerCase()))
        : classList;
      setClasses(filteredClasses);
      
      setShowEnrollModal(false);
      setSelectedClass(null);
      setSelectedStudent('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enroll student');
    } finally {
      setEnrolling(false);
    }
  };

  const handleCancelEnrollment = (enrollment: Enrollment) => {
    setShowCancelConfirm(enrollment);
  };

  const confirmCancelEnrollment = async () => {
    if (!showCancelConfirm) return;

    setCancelling(true);
    try {
      await EnrollmentService.cancelEnrollment(showCancelConfirm.id);
      
      // Refresh both enrollments and classes to get updated counts
      const [enrollmentList, classList] = await Promise.all([
        EnrollmentService.getMyStudentsEnrollments(),
        ClassService.getAllClasses({
          branchId: selectedBranch || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined
        })
      ]);
      
      setEnrollments(enrollmentList);
      setAllClasses(classList);
      
      // Apply subject filter
      const filteredClasses = selectedSubject 
        ? classList.filter(cls => cls.subject.toLowerCase().includes(selectedSubject.toLowerCase()))
        : classList;
      setClasses(filteredClasses);
      
      setShowCancelConfirm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel enrollment');
      setShowCancelConfirm(null);
    } finally {
      setCancelling(false);
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

  const getAvailableSpots = (classItem: Class) => {
    return classItem.capacity - classItem.enrolled_count;
  };

  const isStudentEnrolled = (classId: string, studentId: string) => {
    return enrollments.some(e => 
      e.class_id === classId && 
      e.student_id === studentId && 
      e.status === 'enrolled'
    );
  };

  const canEnrollInClass = (classItem: Class) => {
    return getAvailableSpots(classItem) > 0 && students.some(student => 
      !isStudentEnrolled(classItem.id, student.id)
    );
  };

  // Get unique subjects from all available classes
  const getUniqueSubjects = () => {
    const subjects = allClasses.map(cls => cls.subject);
    return [...new Set(subjects)].sort();
  };

  // Filter enrollments by subject, branch, and date range if selected
  const getFilteredEnrollments = () => {
    let filtered = enrollments;
    
    // Filter by subject
    if (selectedSubject) {
      filtered = filtered.filter(enrollment => 
        enrollment.subject.toLowerCase().includes(selectedSubject.toLowerCase())
      );
    }
    
    // Filter by branch
    if (selectedBranch) {
      // Get the branch name from the selected branch ID
      const selectedBranchName = branches.find(b => b.id === selectedBranch)?.name;
      if (selectedBranchName) {
        filtered = filtered.filter(enrollment => 
          enrollment.branch_name === selectedBranchName
        );
      }
    }
    
    // Filter by date range
    if (startDate || endDate) {
      filtered = filtered.filter(enrollment => {
        const enrollmentDate = new Date(enrollment.start_time);
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate + 'T23:59:59') : null; // Include full end date
        
        if (start && enrollmentDate < start) return false;
        if (end && enrollmentDate > end) return false;
        return true;
      });
    }
    
    return filtered;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center space-x-3">
          <Loader2 className="animate-spin text-blue-600" size={24} />
          <span className="text-lg text-gray-700">Loading classes...</span>
        </div>
      </div>
    );
  }

  const filteredEnrollments = getFilteredEnrollments();

  return (
    <div className="px-6 py-16">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-3">
          <Calendar className="text-blue-600" size={32} />
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Class Operations</h1>
            <p className="text-gray-600">Browse classes and manage enrollments</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center space-x-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <Filter size={20} />
            <span>Filters</span>
          </button>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex space-x-4 mb-6">
        <button
          onClick={() => setActiveView('browse')}
          className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
            activeView === 'browse'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Browse Classes
        </button>
        <button
          onClick={() => setActiveView('enrollments')}
          className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
            activeView === 'enrollments'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          My Enrollments ({filteredEnrollments.filter(e => e.status === 'enrolled').length})
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 mb-6">
          <div className="grid md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subject
              </label>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full p-3 border border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
              >
                <option value="">All Subjects</option>
                {getUniqueSubjects().map((subject) => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Branch
              </label>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="w-full p-3 border border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
              >
                <option value="">All Branches</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full p-3 border border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full p-3 border border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
          
          {/* Active Filters Display */}
          {(selectedSubject || selectedBranch || startDate || endDate) && (
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="text-sm text-gray-600">Active filters:</span>
              {selectedSubject && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Subject: {selectedSubject}
                  <button
                    onClick={() => setSelectedSubject('')}
                    className="ml-1 text-blue-600 hover:text-blue-800"
                  >
                    <X size={12} />
                  </button>
                </span>
              )}
              {selectedBranch && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Branch: {branches.find(b => b.id === selectedBranch)?.name}
                  <button
                    onClick={() => setSelectedBranch('')}
                    className="ml-1 text-green-600 hover:text-green-800"
                  >
                    <X size={12} />
                  </button>
                </span>
              )}
              {(startDate || endDate) && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  Date: {startDate ? new Date(startDate).toLocaleDateString('en-SG') : 'Any'} - {endDate ? new Date(endDate).toLocaleDateString('en-SG') : 'Any'}
                  <button
                    onClick={() => {
                      setStartDate('');
                      setEndDate('');
                    }}
                    className="ml-1 text-purple-600 hover:text-purple-800"
                  >
                    <X size={12} />
                  </button>
                </span>
              )}
            </div>
          )}
        </div>
      )}

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

      {/* Content */}
      {activeView === 'browse' ? (
        // Browse Classes View
        <div>
          {classes.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="mx-auto text-gray-300 mb-4" size={64} />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">No Classes Available</h3>
              <p className="text-gray-500">
                No classes match your current filters. Try adjusting the filters.
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {classes.map((classItem) => (
                <div key={classItem.id} className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-xl font-bold text-gray-800">{classItem.subject}</h3>
                    <div className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      getAvailableSpots(classItem) > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {getAvailableSpots(classItem)} spots left
                    </div>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Calendar size={16} />
                      <span>{formatDateTime(classItem.start_time)}</span>
                    </div>
                    
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Clock size={16} />
                      <span>{formatDuration(classItem.duration_minutes)}</span>
                    </div>
                    
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <MapPin size={16} />
                      <span>{classItem.branch_name}</span>
                    </div>
                    
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Users size={16} />
                      <span>{classItem.enrolled_count}/{classItem.capacity} enrolled</span>
                    </div>
                    
                    {classItem.tutor_first_name && (
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Tutor:</span> {classItem.tutor_first_name} {classItem.tutor_last_name}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleEnrollClick(classItem)}
                    disabled={!canEnrollInClass(classItem)}
                    className={`w-full flex items-center justify-center space-x-2 py-3 rounded-lg font-semibold transition-colors ${
                      canEnrollInClass(classItem)
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <Plus size={20} />
                    <span>
                      {getAvailableSpots(classItem) === 0 ? 'Class Full' : 'Enroll Student'}
                    </span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        // Enrollments View
        <div>
          {filteredEnrollments.length === 0 ? (
            <div className="text-center py-12">
              <Users className="mx-auto text-gray-300 mb-4" size={64} />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">No Enrollments</h3>
              <p className="text-gray-500">
                {selectedSubject || selectedBranch || startDate || endDate
                  ? `No enrollments found matching your filters. Try adjusting the filters.`
                  : 'No current enrollments found. Browse classes to enroll your students.'
                }
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredEnrollments.map((enrollment) => (
                <div key={enrollment.id} className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-800">{enrollment.subject}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          enrollment.status === 'enrolled' ? 'bg-green-100 text-green-800' :
                          enrollment.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {enrollment.status}
                        </span>
                      </div>
                      
                      <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-600">
                        <div>
                          <p><span className="font-medium">Student:</span> {enrollment.student_name}</p>
                          <p><span className="font-medium">Date:</span> {formatDateTime(enrollment.start_time)}</p>
                          <p><span className="font-medium">Duration:</span> {formatDuration(enrollment.duration_minutes)}</p>
                        </div>
                        <div>
                          <p><span className="font-medium">Branch:</span> {enrollment.branch_name}</p>
                          <p><span className="font-medium">Enrolled:</span> {formatDateTime(enrollment.enrolled_at)}</p>
                          {enrollment.tutor_first_name && (
                            <p><span className="font-medium">Tutor:</span> {enrollment.tutor_first_name} {enrollment.tutor_last_name}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {enrollment.status === 'enrolled' && new Date(enrollment.start_time) > new Date() && (
                      <button
                        onClick={() => handleCancelEnrollment(enrollment)}
                        className="ml-4 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Enrollment Modal */}
      {showEnrollModal && selectedClass && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md relative shadow-2xl">
            <button
              onClick={() => setShowEnrollModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={24} />
            </button>
            
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Enroll Student</h2>
            
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">{selectedClass.subject}</h3>
              <div className="text-sm text-gray-600 space-y-1">
                <p>{formatDateTime(selectedClass.start_time)}</p>
                <p>{selectedClass.branch_name}</p>
                <p>{formatDuration(selectedClass.duration_minutes)}</p>
              </div>
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Student
              </label>
              <select
                value={selectedStudent}
                onChange={(e) => setSelectedStudent(e.target.value)}
                className="w-full p-3 border border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
              >
                <option value="">Choose a student</option>
                {students
                  .filter(student => !isStudentEnrolled(selectedClass.id, student.id))
                  .map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name} ({student.grade})
                    </option>
                  ))}
              </select>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => setShowEnrollModal(false)}
                className="flex-1 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEnrollSubmit}
                disabled={!selectedStudent || enrolling}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {enrolling ? 'Enrolling...' : 'Enroll'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md relative shadow-2xl">
            <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">Confirm Cancellation</h3>
            
            <div className="mb-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <X className="text-red-600" size={24} />
              </div>
              
              <p className="text-gray-700 mb-2">
                Are you sure you want to cancel this enrollment?
              </p>
              
              <div className="bg-gray-50 p-4 rounded-lg text-left">
                <p className="font-semibold text-gray-800">{showCancelConfirm.subject}</p>
                <p className="text-sm text-gray-600">Student: {showCancelConfirm.student_name}</p>
                <p className="text-sm text-gray-600">Date: {formatDateTime(showCancelConfirm.start_time)}</p>
                <p className="text-sm text-gray-600">Branch: {showCancelConfirm.branch_name}</p>
              </div>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => setShowCancelConfirm(null)}
                disabled={cancelling}
                className="flex-1 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              >
                Keep Enrollment
              </button>
              <button
                onClick={confirmCancelEnrollment}
                disabled={cancelling}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {cancelling ? (
                  <div className="flex items-center justify-center">
                    <Loader2 className="animate-spin mr-2" size={16} />
                    Cancelling...
                  </div>
                ) : (
                  'Cancel Enrollment'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClassOperations;