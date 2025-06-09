// frontend/src/components/staff/AttendanceTracking.tsx

import React, { useState, useEffect } from 'react';
import { Users, Clock, CheckCircle, XCircle, AlertCircle, UserCheck, Loader2, BarChart3, Calendar, BookOpen } from 'lucide-react';
import type { StaffClass, ClassStudent, AttendanceRecord, AttendanceMarkRequest, AttendanceSummary } from '../../types';
import AttendanceService from '../../services/attendance';

const AttendanceTracking: React.FC = () => {
  const [classes, setClasses] = useState<StaffClass[]>([]);
  const [selectedClass, setSelectedClass] = useState<StaffClass | null>(null);
  const [students, setStudents] = useState<ClassStudent[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  // Summary view states
  const [showSummary, setShowSummary] = useState(false);
  const [summaryDate, setSummaryDate] = useState(new Date().toISOString().split('T')[0]);
  const [todayClasses, setTodayClasses] = useState<StaffClass[]>([]);
  const [attendanceSummaries, setAttendanceSummaries] = useState<Record<string, AttendanceSummary>>({});

  // Attendance state for each student
  const [attendanceState, setAttendanceState] = useState<Record<string, AttendanceMarkRequest>>({});

  useEffect(() => {
    loadClasses();
  }, []);

  useEffect(() => {
    if (selectedClass) {
      loadClassStudents();
    }
  }, [selectedClass]);

  // Load summary data when summary view is shown
  useEffect(() => {
    if (showSummary) {
      loadSummaryData();
    }
  }, [showSummary, summaryDate]);

  const loadClasses = async () => {
    setLoading(true);
    setError('');
    try {
      const classList = await AttendanceService.getMyClasses();
      setClasses(classList);
      
      // Auto-select first class that can have attendance taken today
      const today = new Date().toISOString().split('T')[0];
      const todayClass = classList.find(cls => {
        const classDate = new Date(cls.start_time).toISOString().split('T')[0];
        return classDate === today;
      });
      
      if (todayClass && !selectedClass) {
        setSelectedClass(todayClass);
      } else if (classList.length > 0 && !selectedClass) {
        setSelectedClass(classList[0]);
      }
      
      // Filter today's classes for summary
      const todaysClasses = classList.filter(cls => {
        const classDate = new Date(cls.start_time).toISOString().split('T')[0];
        return classDate === today;
      });
      setTodayClasses(todaysClasses);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load classes');
    } finally {
      setLoading(false);
    }
  };

  const loadClassStudents = async () => {
    if (!selectedClass) return;
    
    setStudentsLoading(true);
    setError('');
    try {
      const studentList = await AttendanceService.getClassStudents(selectedClass.class_id);
      setStudents(studentList);
      
      // Load attendance records for the class date
      const classDate = new Date(selectedClass.start_time).toISOString().split('T')[0];
      if (studentList.length > 0) {
        setTimeout(() => {
          loadAttendanceRecordsForStudents(studentList, classDate);
        }, 100);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load students');
    } finally {
      setStudentsLoading(false);
    }
  };

  const loadAttendanceRecordsForStudents = async (studentList: ClassStudent[] = students, classDate?: string) => {
    if (!selectedClass || studentList.length === 0) return;
    
    // Use class date instead of selected date
    const attendanceDate = classDate || new Date(selectedClass.start_time).toISOString().split('T')[0];
    
    setAttendanceLoading(true);
    setError('');
    try {
      const records = await AttendanceService.getAttendanceRecords(selectedClass.class_id, attendanceDate);
      setAttendanceRecords(records);
      
      // Initialize attendance state from existing records
      const newAttendanceState: Record<string, AttendanceMarkRequest> = {};
      
      // First, set all students to 'present' by default with all required fields
      studentList.forEach(student => {
        newAttendanceState[student.enrollment_id] = {
          enrollmentId: student.enrollment_id,
          studentId: student.student_id,
          status: 'present',
          notes: ''
        };
      });
      
      // Then override with existing records
      records.forEach(record => {
        if (newAttendanceState[record.enrollment_id]) {
          newAttendanceState[record.enrollment_id] = {
            enrollmentId: record.enrollment_id,
            studentId: record.student_id,
            status: record.status,
            timeIn: record.time_in || undefined,
            timeOut: record.time_out || undefined,
            notes: record.notes || ''
          };
        }
      });
      
      setAttendanceState(newAttendanceState);
    } catch (err) {
      console.error('Load attendance error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load attendance records');
    } finally {
      setAttendanceLoading(false);
    }
  };

  const loadSummaryData = async () => {
    try {
      // Get classes for the selected summary date
      const summaryClassesList = classes.filter(cls => {
        const classDate = new Date(cls.start_time).toISOString().split('T')[0];
        return classDate === summaryDate;
      });
      
      // Load attendance summaries for each class
      const summaries: Record<string, AttendanceSummary> = {};
      
      for (const cls of summaryClassesList) {
        try {
          const summary = await AttendanceService.getAttendanceSummary(cls.class_id, summaryDate, summaryDate);
          summaries[cls.class_id] = summary;
        } catch (err) {
          console.error(`Failed to load summary for class ${cls.class_id}:`, err);
        }
      }
      
      setAttendanceSummaries(summaries);
    } catch (err) {
      console.error('Load summary data error:', err);
    }
  };

  const handleAttendanceChange = (enrollmentId: string, field: keyof AttendanceMarkRequest, value: any) => {
    setAttendanceState(prev => ({
      ...prev,
      [enrollmentId]: {
        ...prev[enrollmentId],
        [field]: value
      }
    }));
  };

  const handleSaveAttendance = async () => {
    if (!selectedClass || Object.keys(attendanceState).length === 0) return;
    
    // Use class date for attendance
    const classDate = new Date(selectedClass.start_time).toISOString().split('T')[0];
    
    setSaving(true);
    setError('');
    setSuccessMessage('');
    
    try {
      // Convert attendance state to array and validate
      const attendanceRecords = Object.values(attendanceState).map(record => ({
        enrollmentId: record.enrollmentId,
        studentId: record.studentId,
        status: record.status,
        timeIn: record.timeIn || undefined,
        timeOut: record.timeOut || undefined,
        notes: record.notes || ''
      }));
      
      // Validate that we have all required fields
      for (let i = 0; i < attendanceRecords.length; i++) {
        const record = attendanceRecords[i];
        if (!record.enrollmentId || !record.studentId || !record.status) {
          throw new Error(`Invalid attendance record at index ${i}: missing required fields`);
        }
      }
      
      await AttendanceService.markAttendance(selectedClass.class_id, classDate, attendanceRecords);
      
      // Refresh attendance records to get updated data
      await loadAttendanceRecordsForStudents();
      
      setSuccessMessage(`Attendance saved successfully for ${attendanceRecords.length} students!`);
      
      // Auto-clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
      
    } catch (err) {
      console.error('Save attendance error:', err);
      setError(err instanceof Error ? err.message : 'Failed to save attendance');
    } finally {
      setSaving(false);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'late':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'absent':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'excused':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present':
        return <CheckCircle size={16} />;
      case 'late':
        return <Clock size={16} />;
      case 'absent':
        return <XCircle size={16} />;
      case 'excused':
        return <AlertCircle size={16} />;
      default:
        return <UserCheck size={16} />;
    }
  };

  // Check if attendance can be taken for the selected class
  const canTakeAttendance = () => {
    if (!selectedClass) return false;
    
    const today = new Date().toISOString().split('T')[0];
    const classDate = new Date(selectedClass.start_time).toISOString().split('T')[0];
    
    // Only allow attendance on the exact date of the class
    return classDate === today;
  };

  const getClassDateStatus = () => {
    if (!selectedClass) return '';
    
    const today = new Date().toISOString().split('T')[0];
    const classDate = new Date(selectedClass.start_time).toISOString().split('T')[0];
    
    if (classDate === today) {
      return 'today';
    } else if (classDate > today) {
      return 'future';
    } else {
      return 'past';
    }
  };

  const getClassDateMessage = () => {
    const status = getClassDateStatus();
    const classDate = selectedClass ? new Date(selectedClass.start_time).toLocaleDateString('en-SG', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }) : '';
    
    switch (status) {
      case 'today':
        return { 
          message: `This class is today (${classDate}). You can take attendance now.`, 
          color: 'text-green-700 bg-green-50 border-green-200' 
        };
      case 'future':
        return { 
          message: `This class is scheduled for ${classDate}. Attendance can only be taken on the day of the class.`, 
          color: 'text-blue-700 bg-blue-50 border-blue-200' 
        };
      case 'past':
        return { 
          message: `This class was on ${classDate}. ${attendanceRecords.length > 0 ? 'Viewing saved attendance records.' : 'No attendance was recorded.'}`, 
          color: 'text-gray-700 bg-gray-50 border-gray-200' 
        };
      default:
        return { message: '', color: '' };
    }
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

  return (
    <div className="px-6 py-16">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-3">
          <UserCheck className="text-blue-600" size={32} />
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Attendance Tracking</h1>
            <p className="text-gray-600">Track attendance for your classes</p>
          </div>
        </div>
        
        {/* View Toggle */}
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setShowSummary(false)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              !showSummary 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Individual Class
          </button>
          <button
            onClick={() => setShowSummary(true)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              showSummary 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Daily Summary
          </button>
        </div>
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

      {/* Success Message */}
      {successMessage && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-600">{successMessage}</p>
        </div>
      )}

      {classes.length === 0 ? (
        <div className="text-center py-12">
          <Users className="mx-auto text-gray-300 mb-4" size={64} />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">No Classes Assigned</h3>
          <p className="text-gray-500">
            You don't have any classes assigned to you yet. Contact your administrator.
          </p>
        </div>
      ) : showSummary ? (
        /* Summary View */
        <div>
          {/* Summary Date Picker */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-8">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-800">Daily Attendance Summary</h2>
              <div className="flex items-center space-x-4">
                <label className="text-sm font-medium text-gray-700">Select Date:</label>
                <input
                  type="date"
                  value={summaryDate}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setSummaryDate(e.target.value)}
                  className="p-2 border border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="space-y-6">
            {classes.filter(cls => {
              const classDate = new Date(cls.start_time).toISOString().split('T')[0];
              return classDate === summaryDate;
            }).length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="mx-auto text-gray-300 mb-4" size={64} />
                <h3 className="text-xl font-semibold text-gray-600 mb-2">No Classes on This Date</h3>
                <p className="text-gray-500">
                  You don't have any classes scheduled for {new Date(summaryDate).toLocaleDateString('en-SG', {
                    weekday: 'long',
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric'
                  })}.
                </p>
              </div>
            ) : (
              classes
                .filter(cls => {
                  const classDate = new Date(cls.start_time).toISOString().split('T')[0];
                  return classDate === summaryDate;
                })
                .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
                .map((cls) => {
                  const summary = attendanceSummaries[cls.class_id];
                  
                  return (
                    <div key={cls.class_id} className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <BookOpen className="text-blue-600" size={24} />
                          <div>
                            <h3 className="text-xl font-bold text-gray-800">
                              {cls.subject} {cls.level && `(${cls.level})`}
                            </h3>
                            <p className="text-gray-600">
                              {formatTime(cls.start_time)} • {formatDuration(cls.duration_minutes)} • {cls.branch_name}
                            </p>
                          </div>
                        </div>
                        
                        <button
                          onClick={() => {
                            setSelectedClass(cls);
                            setShowSummary(false);
                          }}
                          className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-sm font-medium"
                        >
                          View Details
                        </button>
                      </div>

                      {summary ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="text-center p-3 bg-green-50 rounded-lg">
                            <div className="text-2xl font-bold text-green-600">
                              {summary.summary.present_count}
                            </div>
                            <div className="text-sm text-green-700">Present</div>
                          </div>
                          <div className="text-center p-3 bg-yellow-50 rounded-lg">
                            <div className="text-2xl font-bold text-yellow-600">
                              {summary.summary.late_count}
                            </div>
                            <div className="text-sm text-yellow-700">Late</div>
                          </div>
                          <div className="text-center p-3 bg-red-50 rounded-lg">
                            <div className="text-2xl font-bold text-red-600">
                              {summary.summary.absent_count}
                            </div>
                            <div className="text-sm text-red-700">Absent</div>
                          </div>
                          <div className="text-center p-3 bg-blue-50 rounded-lg">
                            <div className="text-2xl font-bold text-blue-600">
                              {cls.enrolled_count}
                            </div>
                            <div className="text-sm text-blue-700">Total Enrolled</div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-4 text-gray-500">
                          {summaryDate === new Date().toISOString().split('T')[0] 
                            ? 'Attendance not yet taken' 
                            : 'No attendance records found'
                          }
                        </div>
                      )}
                    </div>
                  );
                })
            )}
          </div>
        </div>
      ) : (
        /* Individual Class View */
        <div>
          {/* Class Selection */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-8">
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Class
              </label>
              <select
                value={selectedClass?.class_id || ''}
                onChange={(e) => {
                  const classItem = classes.find(c => c.class_id === e.target.value);
                  setSelectedClass(classItem || null);
                }}
                className="w-full p-3 border border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
              >
                <option value="">Choose a class</option>
                {classes.map((classItem) => (
                  <option key={classItem.class_id} value={classItem.class_id}>
                    {classItem.subject} {classItem.level && `(${classItem.level})`} - {formatDateTime(classItem.start_time)} - {classItem.branch_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Class Info and Date Status */}
            {selectedClass && (
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="grid md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-blue-800">Subject:</span>
                      <p className="text-blue-700">{selectedClass.subject} {selectedClass.level && `(${selectedClass.level})`}</p>
                    </div>
                    <div>
                      <span className="font-medium text-blue-800">Schedule:</span>
                      <p className="text-blue-700">{formatDateTime(selectedClass.start_time)}</p>
                    </div>
                    <div>
                      <span className="font-medium text-blue-800">Duration:</span>
                      <p className="text-blue-700">{formatDuration(selectedClass.duration_minutes)}</p>
                    </div>
                  </div>
                </div>

                {/* Date Status Message */}
                {(() => {
                  const { message, color } = getClassDateMessage();
                  return message && (
                    <div className={`p-4 rounded-lg border ${color}`}>
                      <div className="flex items-center space-x-2">
                        {getClassDateStatus() === 'today' && <CheckCircle size={20} />}
                        {getClassDateStatus() === 'future' && <Clock size={20} />}
                        {getClassDateStatus() === 'past' && <AlertCircle size={20} />}
                        <p className="text-sm font-medium">{message}</p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Students and Attendance */}
          {selectedClass && (
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="bg-blue-600 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-white">
                      Enrolled Students ({students.length})
                    </h3>
                    <p className="text-blue-100">
                      Attendance for {new Date(selectedClass.start_time).toLocaleDateString('en-SG', {
                        weekday: 'long',
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                  
                  {students.length > 0 && canTakeAttendance() && (
                    <button
                      onClick={handleSaveAttendance}
                      disabled={saving}
                      className="flex items-center space-x-2 bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 disabled:opacity-50 transition-colors"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="animate-spin" size={16} />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle size={16} />
                          <span>Save Attendance</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              <div className="p-6">
                {studentsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="flex items-center space-x-3">
                      <Loader2 className="animate-spin text-blue-600" size={20} />
                      <span className="text-gray-700">Loading students...</span>
                    </div>
                  </div>
                ) : students.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="mx-auto text-gray-300 mb-4" size={48} />
                    <h4 className="text-lg font-semibold text-gray-600 mb-2">No Students Enrolled</h4>
                    <p className="text-gray-500">
                      This class doesn't have any enrolled students yet.
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="space-y-4">
                      {students.map((student) => {
                        const attendance = attendanceState[student.enrollment_id] || {
                          enrollmentId: student.enrollment_id,
                          studentId: student.student_id,
                          status: 'present' as const,
                          notes: ''
                        };

                        return (
                          <div key={student.enrollment_id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-3 mb-2">
                                  <h4 className="text-lg font-semibold text-gray-800">
                                    {student.first_name} {student.last_name}
                                  </h4>
                                  <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded">
                                    {student.grade}
                                  </span>
                                </div>
                                
                                <p className="text-sm text-gray-600">
                                  Parent: {student.parent_first_name} {student.parent_last_name} ({student.parent_email})
                                </p>
                              </div>

                              {canTakeAttendance() && (
                                <div className="ml-6 flex flex-col space-y-3">
                                  {/* Status Selection */}
                                  <div className="flex space-x-2">
                                    {(['present', 'late', 'absent', 'excused'] as const).map((status) => (
                                      <button
                                        key={status}
                                        onClick={() => handleAttendanceChange(student.enrollment_id, 'status', status)}
                                        className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                                          attendance.status === status
                                            ? getStatusColor(status)
                                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                        }`}
                                      >
                                        {getStatusIcon(status)}
                                        <span className="capitalize">{status}</span>
                                      </button>
                                    ))}
                                  </div>

                                  {/* Notes */}
                                  <textarea
                                    value={attendance.notes || ''}
                                    onChange={(e) => handleAttendanceChange(student.enrollment_id, 'notes', e.target.value)}
                                    placeholder="Add notes (optional)"
                                    className="w-full text-xs p-2 border border-gray-200 rounded focus:border-blue-500 focus:outline-none resize-none"
                                    rows={2}
                                  />
                                </div>
                              )}

                              {!canTakeAttendance() && attendanceRecords.find(r => r.enrollment_id === student.enrollment_id) && (
                                <div className="ml-6">
                                  <div className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-xs font-semibold border ${
                                    getStatusColor(attendance.status)
                                  }`}>
                                    {getStatusIcon(attendance.status)}
                                    <span className="capitalize">{attendance.status}</span>
                                  </div>
                                  {attendance.notes && (
                                    <p className="text-xs text-gray-600 mt-2 max-w-48">
                                      Notes: {attendance.notes}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Attendance Summary */}
                    {attendanceRecords.length > 0 && (
                      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
                        <h4 className="font-semibold text-gray-800 mb-3 flex items-center space-x-2">
                          <BarChart3 size={16} />
                          <span>Class Summary</span>
                        </h4>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-green-600">
                              {attendanceRecords.filter(r => r.status === 'present').length}
                            </div>
                            <div className="text-gray-600">Present</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-yellow-600">
                              {attendanceRecords.filter(r => r.status === 'late').length}
                            </div>
                            <div className="text-gray-600">Late</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-red-600">
                              {attendanceRecords.filter(r => r.status === 'absent').length}
                            </div>
                            <div className="text-gray-600">Absent</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-blue-600">
                              {attendanceRecords.filter(r => r.status === 'excused').length}
                            </div>
                            <div className="text-gray-600">Excused</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AttendanceTracking;