// frontend/src/components/staff/ClassManagement.tsx

import React, { useState, useEffect } from 'react';
import { BookOpen, Plus, Calendar, MapPin, Users, Clock, Edit2, Trash2, Filter, X, Loader2, User, ToggleLeft, ToggleRight } from 'lucide-react';
import type { Class, Branch } from '../../types';
import ClassService from '../../services/class';
import BranchService from '../../services/branch';
import ClassForm from './ClassForm';
import { useAuth } from '../../hooks/useAuth';
import DateInput from '../common/DateInput';

const ClassManagement: React.FC = () => {
  const { user } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [allClasses, setAllClasses] = useState<Class[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filter states
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Teacher toggle for own classes vs all classes
  const [showMyClassesOnly, setShowMyClassesOnly] = useState(true);
  
  // Modal states
  const [showClassForm, setShowClassForm] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  
  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Class | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadClasses();
  }, [selectedBranch, selectedSubject, startDate, endDate, showMyClassesOnly]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [branchList] = await Promise.all([
        BranchService.getAllBranches()
      ]);
      
      setBranches(branchList);
      
      // Set default date range (next 90 days)
      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(today.getDate() + 90);
      
      setStartDate(today.toISOString().split('T')[0]);
      setEndDate(futureDate.toISOString().split('T')[0]);
      
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
      
      // Apply teacher filter if "My Classes Only" is enabled
      let filteredByTeacher = classList;
      if (showMyClassesOnly && user) {
        filteredByTeacher = classList.filter(cls => cls.tutor_id === user.id);
      }
      
      // Apply subject filter on frontend if selected
      const filteredClasses = selectedSubject 
        ? filteredByTeacher.filter(cls => cls.subject.toLowerCase().includes(selectedSubject.toLowerCase()))
        : filteredByTeacher;
        
      setClasses(filteredClasses);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load classes');
    }
  };

  const handleCreateClass = () => {
    setEditingClass(null);
    setShowClassForm(true);
  };

  const handleEditClass = (classItem: Class) => {
    setEditingClass(classItem);
    setShowClassForm(true);
  };

  const handleDeleteClass = (classItem: Class) => {
    setShowDeleteConfirm(classItem);
  };

  const confirmDeleteClass = async () => {
    if (!showDeleteConfirm) return;

    setDeleting(true);
    try {
      await ClassService.deleteClass(showDeleteConfirm.id);
      
      // Refresh classes list
      await loadClasses();
      
      setShowDeleteConfirm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete class');
      setShowDeleteConfirm(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleFormSuccess = () => {
    loadClasses(); // Reload the classes list
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

  const isClassInFuture = (classItem: Class) => {
    return new Date(classItem.start_time) > new Date();
  };

  // Get unique subjects from all available classes
  const getUniqueSubjects = () => {
    const subjects = allClasses.map(cls => cls.subject);
    return [...new Set(subjects)].sort();
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
          <BookOpen className="text-blue-600" size={32} />
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Class Management</h1>
            <p className="text-gray-600">Create and manage your classes</p>
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
          
          {/* Teacher Toggle */}
          <div className="flex items-center space-x-3 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setShowMyClassesOnly(!showMyClassesOnly)}
              className={`flex items-center space-x-2 px-3 py-2 rounded-md transition-all ${
                !showMyClassesOnly 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {!showMyClassesOnly ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
              <span className="text-sm font-medium">
                {showMyClassesOnly ? 'My Classes Only' : 'All Classes'}
              </span>
            </button>
          </div>
          
          <button
            onClick={handleCreateClass}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl transition-all duration-200 shadow-md text-lg font-semibold"
          >
            <Plus size={20} />
            <span>Create Class</span>
          </button>
        </div>
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
              <DateInput
                value={startDate}
                onChange={setStartDate}
                className=""
                placeholder="DD/MM/YYYY"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date
              </label>
              <DateInput
                value={endDate}
                onChange={setEndDate}
                className=""
                placeholder="DD/MM/YYYY"
              />
            </div>
          </div>
          
          {/* Active Filters Display */}
          {(selectedSubject || selectedBranch) && (
            <div className="mt-4 flex flex-wrap gap-2 items-center">
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
              
              {/* Clear All Filters Button */}
              <button
                onClick={() => {
                  setSelectedSubject('');
                  setSelectedBranch('');
                  // Reset to default date range (next 90 days)
                  const today = new Date();
                  const futureDate = new Date();
                  futureDate.setDate(today.getDate() + 90);
                  setStartDate(today.toISOString().split('T')[0]);
                  setEndDate(futureDate.toISOString().split('T')[0]);
                }}
                className="ml-2 px-3 py-1 bg-red-100 text-red-700 hover:bg-red-200 rounded-full text-xs font-medium transition-colors"
              >
                Clear All
              </button>
            </div>
          )}

          {/* Date Range Info */}
          <div className="mt-4 text-sm text-gray-500">
            <span>Date range: {startDate ? new Date(startDate).toLocaleDateString('en-SG') : 'Any'} - {endDate ? new Date(endDate).toLocaleDateString('en-SG') : 'Any'}</span>
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

      {/* Classes Grid */}
      {classes.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="mx-auto text-gray-300 mb-4" size={64} />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">No Classes Found</h3>
          <p className="text-gray-500 mb-6">
            {selectedSubject || selectedBranch || startDate || endDate ? (
              'No classes match your current filters. Try adjusting the filters.'
            ) : showMyClassesOnly ? (
              "You haven't created any classes yet. Start by creating your first class!"
            ) : (
              'No classes available in the system. You can create the first one!'
            )}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center space-y-3 sm:space-y-0 sm:space-x-4">
            <button
              onClick={handleCreateClass}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl transition-all duration-200 text-lg font-semibold"
            >
              Create Your First Class
            </button>
            {showMyClassesOnly && (
              <button
                onClick={() => setShowMyClassesOnly(false)}
                className="text-blue-600 hover:text-blue-700 px-4 py-2 rounded-lg transition-colors"
              >
                View All Classes
              </button>
            )}
          </div>
        </div>
      ) : (
        <div>
          {/* Status indicator */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <h2 className="text-xl font-semibold text-gray-800">
                {showMyClassesOnly ? 'My Classes' : 'All Classes'} ({classes.length})
              </h2>
              <span className="text-sm text-gray-500">
                {showMyClassesOnly 
                  ? 'Showing only classes assigned to you' 
                  : 'Showing all classes in the system'
                }
              </span>
            </div>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classes
              .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
              .map((classItem) => (
              <div key={classItem.id} className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-800 mb-1">{classItem.subject}</h3>
                    {classItem.level && (
                      <span className="inline-block px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded mb-2">
                        {classItem.level}
                      </span>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    {classItem.can_edit && isClassInFuture(classItem) && (
                      <button
                        onClick={() => handleEditClass(classItem)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit Class"
                      >
                        <Edit2 size={16} />
                      </button>
                    )}
                    {classItem.can_delete && isClassInFuture(classItem) && (
                      <button
                        onClick={() => handleDeleteClass(classItem)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Class"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Description */}
                {classItem.description && (
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">{classItem.description}</p>
                )}

                <div className="space-y-3 mb-6">
                  {/* Date and Time */}
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Calendar size={16} />
                    <span>{formatDateTime(classItem.start_time)}</span>
                  </div>
                  
                  {/* Duration and End Time */}
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
                  
                  {/* Branch */}
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <MapPin size={16} />
                    <span>{classItem.branch_name}</span>
                  </div>
                  
                  {/* Enrollment Count */}
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Users size={16} />
                    <span>{classItem.enrolled_count}/{classItem.capacity} enrolled ({getAvailableSpots(classItem)} spots left)</span>
                  </div>

                  {/* Tutor Information */}
                  {classItem.tutor_first_name && (
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <User size={16} />
                      <span>
                        <span className="font-medium">Tutor:</span> {classItem.tutor_first_name} {classItem.tutor_last_name}
                      </span>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      getAvailableSpots(classItem) > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {getAvailableSpots(classItem) > 0 ? 'Available' : 'Full'}
                    </div>
                    
                    <div className="text-xs text-gray-400">
                      Created {new Date(classItem.created_at).toLocaleDateString('en-SG')}
                    </div>
                  </div>
                  
                  {!isClassInFuture(classItem) && (
                    <div className="mt-2 px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                      Past class - cannot be modified
                    </div>
                  )}
                  
                  {!classItem.can_edit && !classItem.can_delete && isClassInFuture(classItem) && (
                    <div className="mt-2 px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded">
                      View only - assigned to another tutor
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Class Form Modal */}
      <ClassForm
        isOpen={showClassForm}
        onClose={() => setShowClassForm(false)}
        classData={editingClass}
        onSuccess={handleFormSuccess}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md relative shadow-2xl">
            <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">Confirm Deletion</h3>
            
            <div className="mb-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="text-red-600" size={24} />
              </div>
              
              <p className="text-gray-700 mb-2">
                Are you sure you want to delete this class?
              </p>
              
              <div className="bg-gray-50 p-4 rounded-lg text-left">
                <p className="font-semibold text-gray-800">{showDeleteConfirm.subject}</p>
                {showDeleteConfirm.level && (
                  <p className="text-sm text-gray-600">Level: {showDeleteConfirm.level}</p>
                )}
                <p className="text-sm text-gray-600">Date: {formatDateTime(showDeleteConfirm.start_time)}</p>
                <p className="text-sm text-gray-600">Branch: {showDeleteConfirm.branch_name}</p>
                <p className="text-sm text-gray-600">Enrolled: {showDeleteConfirm.enrolled_count}/{showDeleteConfirm.capacity}</p>
              </div>
              
              {showDeleteConfirm.enrolled_count > 0 && (
                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-yellow-800 text-sm">
                    Warning: This will affect {showDeleteConfirm.enrolled_count} enrolled student(s).
                  </p>
                </div>
              )}
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                disabled={deleting}
                className="flex-1 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteClass}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {deleting ? (
                  <div className="flex items-center justify-center">
                    <Loader2 className="animate-spin mr-2" size={16} />
                    Deleting...
                  </div>
                ) : (
                  'Delete Class'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClassManagement;