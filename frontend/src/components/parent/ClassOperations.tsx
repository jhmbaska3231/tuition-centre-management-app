// frontend/src/components/parent/ClassOperations.tsx

import React, { useState, useEffect } from 'react';
import { Calendar, MapPin, Users, Clock, Plus, X, Loader2, Filter, User, CheckCircle, AlertCircle } from 'lucide-react';
import type { Class, Enrollment, Student, Branch } from '../../types';
import ClassService from '../../services/class';
import EnrollmentService from '../../services/enrollment';
import StudentService from '../../services/student';
import BranchService from '../../services/branch';
import DateInput from '../common/DateInput';

interface ClassOperationsProps {
  refreshTrigger?: number; // Prop to trigger refresh from parent
}

const ClassOperations: React.FC<ClassOperationsProps> = ({ refreshTrigger = 0 }) => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [allClasses, setAllClasses] = useState<Class[]>([]); // Store all classes for subject extraction
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  // Enhanced filter states
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Child filter state
  const [selectedChild, setSelectedChild] = useState('all'); // 'all' or student ID
  
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

  // Helper function to get one month from today (matching backend logic)
  const getOneMonthFromToday = () => {
    const oneMonthFromNow = new Date();
    oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
    return oneMonthFromNow;
  };

  // Helper function to get max allowed end date (1 month from today)
  const getMaxEndDate = () => {
    return getOneMonthFromToday().toISOString().split('T')[0];
  };

  // Helper function to check if class is approaching and has no tutor
  const isClassApproaching = (startTime: string): boolean => {
    const classDate = new Date(startTime);
    const now = new Date();
    const daysDifference = Math.ceil((classDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysDifference <= 7; // Class is within 7 days
  };

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
      
      // Set default date range (today to 1 month from today - matching backend validation)
      const today = new Date();
      const oneMonthFromToday = getOneMonthFromToday();
      
      setStartDate(today.toISOString().split('T')[0]);
      setEndDate(oneMonthFromToday.toISOString().split('T')[0]);
      
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
      let filteredClasses = selectedSubject 
        ? classList.filter(cls => cls.subject.toLowerCase().includes(selectedSubject.toLowerCase()))
        : classList;

      // Only show classes within 1 month from today
      const today = new Date();
      const oneMonthFromToday = getOneMonthFromToday();
      
      filteredClasses = filteredClasses.filter(cls => {
        const classDate = new Date(cls.start_time);
        return classDate > today && classDate <= oneMonthFromToday;
      });

      // Filter classes to only show those that match student grades or are Mixed Levels
      const studentGrades = students.map(student => student.grade);
      const uniqueGrades = [...new Set(studentGrades)];
      
      if (uniqueGrades.length > 0) {
        filteredClasses = filteredClasses.filter(cls => 
          cls.level === 'Mixed Levels' || uniqueGrades.includes(cls.level || '')
        );
      }
        
      setClasses(filteredClasses);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load classes');
    }
  };

  const handleEnrollClick = (classItem: Class) => {
    setSelectedClass(classItem);
    setSelectedStudent('');
    setError('');
    setSuccessMessage('');
    setShowEnrollModal(true);
  };

  const handleEnrollSubmit = async () => {
    if (!selectedClass || !selectedStudent) return;
    
    setEnrolling(true);
    setError('');
    setSuccessMessage('');
    
    try {
      await EnrollmentService.createEnrollment({
        studentId: selectedStudent,
        classId: selectedClass.id
      });
      
      // Get student name for success message
      const student = students.find(s => s.id === selectedStudent);
      const studentName = student ? `${student.first_name} ${student.last_name}` : 'Student';
      
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
      
      // Apply filters again
      await loadClasses();
      
      // Show success message
      setSuccessMessage(`${studentName} has been successfully enrolled in ${selectedClass.subject}!`);
      
      // Auto-clear success message after 5 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 5000);
      
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
      
      // Apply filters again
      await loadClasses();
      
      setShowCancelConfirm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel enrollment');
      setShowCancelConfirm(null);
    } finally {
      setCancelling(false);
    }
  };

  // Handler for end date changes with validation
  const handleEndDateChange = (newEndDate: string) => {
    const maxEndDate = getMaxEndDate();
    
    // If the selected date is beyond the max allowed date, use the max date instead
    if (newEndDate > maxEndDate) {
      setEndDate(maxEndDate);
      setError('End date cannot be more than 1 month from today. Date has been adjusted to the maximum allowed.');
      // Clear error after 3 seconds
      setTimeout(() => setError(''), 3000);
    } else {
      setEndDate(newEndDate);
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

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-SG', {
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

  // Check if student can enroll based on grade matching
  const canStudentEnrollInClass = (classItem: Class, student: Student) => {
    return classItem.level === 'Mixed Levels' || student.grade === classItem.level;
  };

  // Get eligible students for a class
  const getEligibleStudents = (classItem: Class) => {
    return students.filter(student => 
      canStudentEnrollInClass(classItem, student) && 
      !isStudentEnrolled(classItem.id, student.id)
    );
  };

  const canEnrollInClass = (classItem: Class) => {
    return getAvailableSpots(classItem) > 0 && getEligibleStudents(classItem).length > 0;
  };

  // Get unique subjects from all available classes (including filtered by grade)
  const getUniqueSubjects = () => {
    const studentGrades = students.map(student => student.grade);
    const uniqueGrades = [...new Set(studentGrades)];
    
    // Filter classes by grade eligibility first, then extract subjects
    const eligibleClasses = uniqueGrades.length > 0 
      ? allClasses.filter(cls => cls.level === 'Mixed Levels' || uniqueGrades.includes(cls.level || ''))
      : allClasses;
      
    const subjects = eligibleClasses.map(cls => cls.subject);
    return [...new Set(subjects)].sort();
  };

  // Filter enrollments by subject, branch, date range, and selected child
  const getFilteredEnrollments = () => {
    // Show only active enrollments
    let filtered = enrollments.filter(enrollment => enrollment.status === 'enrolled');
    
    // Filter by selected child first
    if (selectedChild !== 'all') {
      const selectedStudentName = students.find(s => s.id === selectedChild);
      if (selectedStudentName) {
        const fullName = `${selectedStudentName.first_name} ${selectedStudentName.last_name}`;
        filtered = filtered.filter(enrollment => enrollment.student_name === fullName);
      }
    }
    
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

  // Get unique students who have enrollments
  const getStudentsWithEnrollments = () => {
    const enrolledStudentNames = [...new Set(enrollments.map(e => e.student_name))];
    return students.filter(student => {
      const fullName = `${student.first_name} ${student.last_name}`;
      return enrolledStudentNames.includes(fullName);
    });
  };

  // Determine whether to show child filter (for multiple children with enrollments)
  const shouldShowChildFilter = () => {
    const studentsWithEnrollments = getStudentsWithEnrollments();
    return studentsWithEnrollments.length > 1;
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

  const filteredEnrollments = getFilteredEnrollments();
  const studentsWithEnrollments = getStudentsWithEnrollments();
  const eligibleStudentsForSelectedClass = selectedClass ? getEligibleStudents(selectedClass) : [];
  const maxEndDate = getMaxEndDate();

  return (
    <div className="px-6 py-16">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-3">
          <Calendar className="text-indigo-500" size={32} />
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Class Operations</h1>
            <p className="text-gray-600">Browse classes and manage enrollments for your children</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center space-x-2 px-4 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
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
              ? 'bg-indigo-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Browse Classes
        </button>
        <button
          onClick={() => setActiveView('enrollments')}
          className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
            activeView === 'enrollments'
              ? 'bg-indigo-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          My Enrollments ({filteredEnrollments.filter(e => e.status === 'enrolled').length})
        </button>
      </div>

      {/* Child Filter (only shown for enrollments view with multiple children) */}
      {activeView === 'enrollments' && shouldShowChildFilter() && (
        <div className="bg-white p-4 rounded-2xl shadow-lg border border-gray-100 mb-6">
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-gray-700">View enrollments for:</span>
            <div className="flex flex-wrap gap-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="child-filter"
                  value="all"
                  checked={selectedChild === 'all'}
                  onChange={(e) => setSelectedChild(e.target.value)}
                  className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700 font-medium">All Children</span>
              </label>
              
              {studentsWithEnrollments.map((student) => (
                <label key={student.id} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="child-filter"
                    value={student.id}
                    checked={selectedChild === student.id}
                    onChange={(e) => setSelectedChild(e.target.value)}
                    className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700 font-medium">
                    {student.first_name} {student.last_name}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Filters */}
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
                className="w-full p-3 border border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
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
                className="w-full p-3 border border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
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
              <DateInput
                value={startDate}
                onChange={setStartDate}
                className=""
                placeholder="DD/MM/YYYY"
                min={new Date().toISOString().split('T')[0]}
                max={maxEndDate}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date
              </label>
              <DateInput
                value={endDate}
                onChange={handleEndDateChange}
                className=""
                placeholder="DD/MM/YYYY"
                min={startDate || new Date().toISOString().split('T')[0]}
                max={maxEndDate}
              />
              <p className="text-xs text-gray-500 mt-1">
                Maximum: {new Date(maxEndDate).toLocaleDateString('en-SG')} (1 month from today)
              </p>
            </div>
          </div>
          
          {/* Active Filters Display */}
          {(selectedSubject || selectedBranch || (selectedChild !== 'all' && shouldShowChildFilter())) && (
            <div className="mt-4 flex flex-wrap gap-2 items-center">
              <span className="text-sm text-gray-600">Active filters:</span>
              {selectedSubject && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                  Subject: {selectedSubject}
                  <button
                    onClick={() => setSelectedSubject('')}
                    className="ml-1 text-indigo-600 hover:text-indigo-800"
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
              {selectedChild !== 'all' && shouldShowChildFilter() && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  Child: {students.find(s => s.id === selectedChild)?.first_name} {students.find(s => s.id === selectedChild)?.last_name}
                  <button
                    onClick={() => setSelectedChild('all')}
                    className="ml-1 text-purple-600 hover:text-purple-800"
                  >
                    <X size={12} />
                  </button>
                </span>
              )}
              
              {/* Clear All Filters Button */}
              <button
                onClick={() => {
                  setSelectedSubject('');
                  setSelectedBranch('');
                  setSelectedChild('all');
                  // Reset to default date range (today to 1 month from today)
                  const today = new Date();
                  const oneMonthFromToday = getOneMonthFromToday();
                  setStartDate(today.toISOString().split('T')[0]);
                  setEndDate(oneMonthFromToday.toISOString().split('T')[0]);
                }}
                className="ml-2 px-3 py-1 bg-red-100 text-red-700 hover:bg-red-200 rounded-full text-xs font-medium transition-colors"
              >
                Clear All
              </button>
            </div>
          )}
        </div>
      )}

      {/* Grade Information Notice */}
      {activeView === 'browse' && students.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6">
          <div className="flex items-start space-x-3">
            <AlertCircle className="text-blue-600 mt-0.5" size={20} />
            <div>
              <h3 className="text-sm font-semibold text-blue-800 mb-1">Grade Level Information</h3>
              <p className="text-sm text-blue-700">
                Classes shown are filtered for your children's grade levels: {[...new Set(students.map(s => s.grade))].join(', ')}. 
                Mixed Levels classes are available to all students. Only classes within 1 month are available for enrollment.
              </p>
            </div>
          </div>
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
          {/* Status indicator */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <h2 className="text-xl font-semibold text-gray-800">
                Available Classes ({classes.length})
              </h2>
              <span className="text-sm text-gray-500">
                Showing classes for your children's grade levels (within 1 month)
              </span>
            </div>
          </div>

          {classes.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="mx-auto text-gray-300 mb-4" size={64} />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">No Classes Available</h3>
              <p className="text-gray-500">
                {students.length === 0 
                  ? 'Please add your children first to see available classes for their grade levels.'
                  : 'No classes match your current filters, your children\'s grade levels, or are within the 1-month enrollment window. Try adjusting the filters.'
                }
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {classes
                .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
                .map((classItem) => (
                <div key={classItem.id} className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-800 mb-1">{classItem.subject}</h3>
                      {classItem.level && (
                        <span className={`inline-block px-2 py-1 text-xs font-medium rounded mb-2 ${
                          classItem.level === 'Mixed Levels' 
                            ? 'bg-purple-100 text-purple-800' 
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {classItem.level}
                        </span>
                      )}
                    </div>
                    <div className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      getAvailableSpots(classItem) > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {getAvailableSpots(classItem)} spots left
                    </div>
                  </div>

                  {/* Description */}
                  {classItem.description && (
                    <p className="text-gray-600 text-sm mb-4 line-clamp-2">{classItem.description}</p>
                  )}

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Calendar size={16} />
                      <span>{formatDateTime(classItem.start_time)}</span>
                    </div>
                    
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Clock size={16} />
                      <span>
                        {formatDuration(classItem.duration_minutes)}
                        {classItem.end_time && (
                          <span className="text-gray-400 ml-2">
                            (ends {formatTime(classItem.end_time)})
                          </span>
                        )}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <MapPin size={16} />
                      <span>{classItem.branch_name} ({classItem.classroom_name})</span>
                    </div>
                    
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Users size={16} />
                      <span>{classItem.enrolled_count}/{classItem.capacity} enrolled</span>
                    </div>
                    
                    {classItem.tutor_first_name && (
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <User size={16} />
                        <span>
                          <span className="font-medium">Tutor:</span> {classItem.tutor_first_name} {classItem.tutor_last_name}
                        </span>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleEnrollClick(classItem)}
                    disabled={!canEnrollInClass(classItem)}
                    className={`w-full flex items-center justify-center space-x-2 py-3 rounded-lg font-semibold transition-colors ${
                      canEnrollInClass(classItem)
                        ? 'bg-indigo-500 text-white hover:bg-indigo-600'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <Plus size={20} />
                    <span>
                      {getAvailableSpots(classItem) === 0 ? 'Class Full' : 
                       getEligibleStudents(classItem).length === 0 ? 'No Eligible Students' :
                       'Enroll Student'}
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
          {/* Status indicator for enrollments */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <h2 className="text-xl font-semibold text-gray-800">
                My Enrollments ({filteredEnrollments.length})
              </h2>
              <span className="text-sm text-gray-500">
                {selectedChild !== 'all' && shouldShowChildFilter() 
                  ? `Showing enrollments for ${students.find(s => s.id === selectedChild)?.first_name} ${students.find(s => s.id === selectedChild)?.last_name}`
                  : selectedSubject || selectedBranch || startDate || endDate
                    ? 'Showing all upcoming enrollments'
                    : 'All enrollments for your students'
                }
              </span>
            </div>
          </div>

          {filteredEnrollments.length === 0 ? (
            <div className="text-center py-12">
              <Users className="mx-auto text-gray-300 mb-4" size={64} />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">No Enrollments</h3>
              <p className="text-gray-500">
                {selectedChild !== 'all' && shouldShowChildFilter()
                  ? `${students.find(s => s.id === selectedChild)?.first_name} has no enrollments matching the current filters.`
                  : selectedSubject || selectedBranch || startDate || endDate
                    ? `No enrollments found matching your filters. Try adjusting the filters.`
                    : 'No current enrollments found. Browse classes to enroll your students.'
                }
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredEnrollments
                .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
                .map((enrollment) => (
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

                      {/* No Tutor Assigned Warning */}
                      {!enrollment.tutor_first_name && enrollment.status === 'enrolled' && (
                        <div className={`mb-4 p-3 rounded-lg ${
                          isClassApproaching(enrollment.start_time) 
                            ? 'bg-red-50 border-red-400' 
                            : 'bg-amber-50 border-amber-400'
                        }`}>
                          <div className="flex items-start space-x-2">
                            <AlertCircle className={`mt-0.5 ${
                              isClassApproaching(enrollment.start_time) 
                                ? 'text-red-500' 
                                : 'text-amber-500'
                            }`} size={16} />
                            <div>
                              <h4 className={`text-sm font-medium ${
                                isClassApproaching(enrollment.start_time) 
                                  ? 'text-red-800' 
                                  : 'text-amber-800'
                              } mb-1`}>
                                {isClassApproaching(enrollment.start_time) 
                                  ? 'Class May Be Cancelled' 
                                  : 'Class On Hold - No Tutor Assigned'
                                }
                              </h4>
                              <p className={`text-xs ${
                                isClassApproaching(enrollment.start_time) 
                                  ? 'text-red-700' 
                                  : 'text-amber-700'
                              }`}>
                                {isClassApproaching(enrollment.start_time) 
                                  ? 'This class is approaching but still has no assigned tutor. It may unfortunately be cancelled if no replacement tutor is found.' 
                                  : 'This class is temporarily on hold as we are working to assign a qualified tutor. We will notify you once a tutor is assigned.'
                                }
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-600">
                        <div>
                          <p><span className="font-medium">Student:</span> {enrollment.student_name}</p>
                          <p><span className="font-medium">Date:</span> {formatDateTime(enrollment.start_time)}</p>
                          <p><span className="font-medium">Duration:</span> {formatDuration(enrollment.duration_minutes)}</p>
                          {enrollment.tutor_first_name ? (
                            <p><span className="font-medium">Tutor:</span> {enrollment.tutor_first_name} {enrollment.tutor_last_name}</p>
                          ) : (
                            <p><span className="font-medium">Tutor:</span> To be assigned</p>
                          )}
                        </div>
                        <div>
                          <p><span className="font-medium">Branch:</span> {enrollment.branch_name}</p>
                          {enrollment.classroom_name && (
                            <p><span className="font-medium">Classroom:</span> {enrollment.classroom_name}</p>
                          )}
                          <p><span className="font-medium">Enrolled:</span> {formatDateTime(enrollment.enrolled_at)}</p>
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
        <div className="fixed inset-0 bg-gradient-to-br from-white-100 to-indigo-200 backdrop-blur-sm flex items-center justify-center z-50">
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
              {selectedClass.level && (
                <span className={`inline-block px-2 py-1 text-xs font-medium rounded mb-2 ${
                  selectedClass.level === 'Mixed Levels' 
                    ? 'bg-purple-100 text-purple-800' 
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {selectedClass.level}
                </span>
              )}
              <div className="text-sm text-gray-600 space-y-1">
                <p>{formatDateTime(selectedClass.start_time)}</p>
                <p>{selectedClass.branch_name}</p>
                <p>{selectedClass.classroom_name}</p>
                <p>{formatDuration(selectedClass.duration_minutes)}</p>
                {selectedClass.tutor_first_name && (
                  <p>Tutor: {selectedClass.tutor_first_name} {selectedClass.tutor_last_name}</p>
                )}
              </div>
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Student
              </label>
              <select
                value={selectedStudent}
                onChange={(e) => setSelectedStudent(e.target.value)}
                className="w-full p-3 border border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
              >
                <option value="">Choose a student</option>
                {eligibleStudentsForSelectedClass.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.first_name} {student.last_name} ({student.grade})
                  </option>
                ))}
              </select>
              
              {/* Show grade matching info */}
              {selectedClass.level !== 'Mixed Levels' && (
                <p className="text-xs text-gray-500 mt-2">
                  Only students in {selectedClass.level} can enroll in this class.
                </p>
              )}
              
              {eligibleStudentsForSelectedClass.length === 0 && (
                <p className="text-xs text-red-600 mt-2">
                  No eligible students. Students must be in {selectedClass.level} grade to enroll.
                </p>
              )}
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
                className="flex-1 px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {enrolling ? 'Enrolling...' : 'Enroll'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-gradient-to-br from-white-100 to-indigo-200 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md relative shadow-2xl">
            <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">Confirm Cancellation</h3>
            
            <div className="mb-6 text-center">              
              <p className="text-gray-700 mb-2">
                Are you sure you want to cancel this enrollment?
              </p>
              
              <div className="bg-gray-50 p-4 rounded-lg text-left">
                <p className="font-semibold text-gray-800">{showCancelConfirm.subject}</p>
                <p className="text-sm text-gray-600">Student: {showCancelConfirm.student_name}</p>
                <p className="text-sm text-gray-600">Date: {formatDateTime(showCancelConfirm.start_time)}</p>
                <p className="text-sm text-gray-600">Branch: {showCancelConfirm.branch_name}</p>
                <p className="text-sm text-gray-600">Classroom: {showCancelConfirm.classroom_name}</p>
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
      
      {/* Success Toast Notification */}
      {successMessage && (
        <div className="fixed top-20 right-6 z-50 max-w-md">
          <div className="bg-green-600 text-white p-4 rounded-lg shadow-lg border border-green-700 transform transition-all duration-300 ease-in-out">
            <div className="flex items-center space-x-3">
              <CheckCircle className="text-white" size={20} />
              <div className="flex-1">
                <p className="font-medium">{successMessage}</p>
              </div>
              <button
                onClick={() => setSuccessMessage('')}
                className="text-white hover:text-green-200 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClassOperations;