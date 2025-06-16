// frontend/src/components/admin/ClassroomManagement.tsx

import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Loader2, Users, MapPin, BookCopy, Calendar, ChevronLeft, X, CheckCircle } from 'lucide-react';
import type { Classroom, Branch, ClassroomDeletionImpact } from '../../types';
import ClassroomService from '../../services/classroom';
import ClassroomForm from './ClassroomForm';

interface ClassroomManagementProps {
  branch: Branch;
  onBack: () => void;
}

const ClassroomManagement: React.FC<ClassroomManagementProps> = ({ branch, onBack }) => {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modal states
  const [showClassroomForm, setShowClassroomForm] = useState(false);
  const [editingClassroom, setEditingClassroom] = useState<Classroom | null>(null);
  
  // Delete confirmation states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Classroom | null>(null);
  const [deletionImpact, setDeletionImpact] = useState<ClassroomDeletionImpact | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [loadingImpact, setLoadingImpact] = useState(false);

  useEffect(() => {
    loadClassrooms();
  }, [branch.id]);

  const loadClassrooms = async () => {
    setLoading(true);
    setError('');
    try {
      const classroomList = await ClassroomService.getClassroomsByBranch(branch.id);
      setClassrooms(classroomList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load classrooms');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClassroom = () => {
    setEditingClassroom(null);
    setShowClassroomForm(true);
  };

  const handleEditClassroom = (classroom: Classroom) => {
    setEditingClassroom(classroom);
    setShowClassroomForm(true);
  };

  const handleClose = () => {
    setShowDeleteConfirm(null);
    setDeletionImpact(null);
  }

  const handleDeleteClassroom = async (classroom: Classroom) => {
    setShowDeleteConfirm(classroom);
    setLoadingImpact(true);
    setDeletionImpact(null);
    
    try {
      const impact = await ClassroomService.getClassroomDeletionImpact(classroom.id);
      setDeletionImpact(impact);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check deletion impact');
      setShowDeleteConfirm(null);
    } finally {
      setLoadingImpact(false);
    }
  };

  const confirmDeleteClassroom = async () => {
    if (!showDeleteConfirm) return;

    setDeleting(true);
    try {
      await ClassroomService.deleteClassroom(showDeleteConfirm.id, true);
      
      // Refresh classroom list
      await loadClassrooms();
      
      setShowDeleteConfirm(null);
      setDeletionImpact(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete classroom');
    } finally {
      setDeleting(false);
    }
  };

  const handleFormSuccess = () => {
    loadClassrooms(); // Reload the classroom list
    setShowClassroomForm(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-SG', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center space-x-3">
          <Loader2 className="animate-spin text-indigo-600" size={24} />
          <span className="text-lg text-gray-700">Loading classrooms...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className="p-4 flex items-center space-x-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Back to Branch Management"
          >
            <ChevronLeft size={24} />
            <span>Back to Branches</span>
          </button>
          <div className="h-8 w-px bg-gray-300"></div>
          <div className="flex items-center space-x-3">
            <BookCopy className="text-indigo-500" size={32} />
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Classroom Management</h1>
              <p className="text-gray-600">Managing classrooms for <span className="font-semibold">{branch.name}</span></p>
            </div>
          </div>
        </div>
        
        <button
          onClick={handleCreateClassroom}
          className="flex items-center space-x-2 bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-3 rounded-2xl transition-all duration-200 shadow-md text-lg font-semibold"
        >
          <Plus size={20} />
          <span>Add Classroom</span>
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
            <CheckCircle className="text-gray-600" size={24} />
            <h3 className="text-lg font-semibold text-gray-800">Total Classrooms</h3>
          </div>
          <p className="text-2xl font-bold text-green-600">{classrooms.length}</p>
          <p className="text-sm text-gray-500 mt-1">Available spaces</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
          <div className="flex items-center space-x-3 mb-2">
            <Users className="text-gray-600" size={24} />
            <h3 className="text-lg font-semibold text-gray-800">Total Capacity</h3>
          </div>
          <p className="text-2xl font-bold text-blue-600">
            {classrooms.reduce((sum, room) => sum + room.room_capacity, 0)}
          </p>
          <p className="text-sm text-gray-500 mt-1">Students max</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
          <div className="flex items-center space-x-3 mb-2">
            <MapPin className="text-gray-600" size={24} />
            <h3 className="text-lg font-semibold text-gray-800">Active Classes</h3>
          </div>
          <p className="text-2xl font-bold text-orange-600">
            {classrooms.reduce((sum, room) => sum + (room.active_classes_count || 0), 0)}
          </p>
          <p className="text-sm text-gray-500 mt-1">Currently scheduled</p>
        </div>
      </div>

      {/* Classrooms Grid */}
      {classrooms.length === 0 ? (
        <div className="text-center py-12">
          <MapPin className="mx-auto text-gray-300 mb-4" size={64} />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">No Classrooms</h3>
          <p className="text-gray-500 mb-6">
            Start by adding classrooms to {branch.name}.
          </p>
          <button
            onClick={handleCreateClassroom}
            className="bg-indigo-500 hover:bg-indigo-600 text-white px-8 py-4 rounded-2xl transition-all duration-200 text-lg font-semibold"
          >
            Add First Classroom
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classrooms.map((classroom) => (
            <div key={classroom.id} className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
                    <MapPin className="text-indigo-600" size={20} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">{classroom.room_name}</h3>
                    <span className="inline-block px-2 py-1 rounded text-xs font-semibold bg-green-100 text-green-800">
                      Capacity: {classroom.room_capacity}
                    </span>
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEditClassroom(classroom)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit Classroom"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDeleteClassroom(classroom)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete Classroom"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Classroom Details */}
              <div className="space-y-3 mb-4">
                {classroom.description && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Description:</p>
                    <p className="text-sm text-gray-600 leading-relaxed">{classroom.description}</p>
                  </div>
                )}
                
                <div className="flex items-center mb-6 text-sm">
                  <span className="text-gray-600">Active Classes:</span>
                  <span className="text-gray-600 ml-1">{classroom.active_classes_count || 0}</span>
                </div>
              </div>

              {/* Footer */}
              <div className="pt-4 border-t border-gray-100">
                <div className="grid grid-cols-2 gap-4 text-xs text-gray-500">
                  <div>
                    <p className="font-medium">Created:</p>
                    <p>{formatDate(classroom.created_at)}</p>
                  </div>
                  <div>
                    <p className="font-medium">Updated:</p>
                    <p>{formatDate(classroom.updated_at)}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Classroom Form Modal */}
      {showClassroomForm && (
        <ClassroomForm
          classroom={editingClassroom}
          branchId={branch.id}
          branchName={branch.name}
          onSuccess={handleFormSuccess}
          onCancel={() => setShowClassroomForm(false)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-gradient-to-br from-white-100 to-indigo-200 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-3xl relative shadow-2xl max-h-[90vh] overflow-y-auto">
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
              type="button"
            >
              <X size={24} />
            </button>

            <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">Confirm Classroom Deletion</h3>
            
            <div className="mb-6 text-center">              
              <p className="text-gray-700 mb-2 font-medium">
                Are you sure you want to delete this classroom?
              </p>
              
              <div className="bg-gray-50 p-4 rounded-lg text-left mb-4">
                <p className="font-semibold text-gray-800">{showDeleteConfirm.room_name}</p>
                <p className="text-sm text-gray-600">Capacity: {showDeleteConfirm.room_capacity} students</p>
                {showDeleteConfirm.description && (
                  <p className="text-sm text-gray-600">Description: {showDeleteConfirm.description}</p>
                )}
              </div>

              {/* Enhanced Impact Analysis */}
              {loadingImpact ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="animate-spin text-indigo-600 mr-2" size={20} />
                  <span className="text-gray-600">Checking deletion impact...</span>
                </div>
              ) : deletionImpact ? (
                <div className="text-left">
                  {deletionImpact.impact.warning && (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
                      <p className="text-yellow-800 text-sm font-medium mb-2">Impact Warning</p>
                      <p className="text-yellow-700 text-sm">{deletionImpact.impact.warning}</p>
                    </div>
                  )}

                  <div className="bg-gray-50 p-4 rounded-lg mb-4">
                  <p className="font-medium text-gray-800 mb-3">Deletion Impact:</p>
                  
                  {/* Impact Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                    <div className="text-center p-3 bg-white rounded border">
                      <div className="flex items-center justify-center mb-1">
                        <BookCopy className="text-gray-600" size={16} />
                      </div>
                      <div className="text-lg font-bold text-gray-800">
                        {deletionImpact.impact.totalClasses}
                      </div>
                      <div className="text-xs text-gray-600">Total Classes</div>
                      {deletionImpact.impact.futureClasses > 0 && (
                        <div className="text-xs text-blue-600 mt-1">
                          ({deletionImpact.impact.futureClasses} future)
                        </div>
                      )}
                    </div>
                    
                    <div className="text-center p-3 bg-white rounded border">
                      <div className="flex items-center justify-center mb-1">
                        <Users className="text-gray-600" size={16} />
                      </div>
                      <div className="text-lg font-bold text-gray-800">
                        {deletionImpact.impact.enrollmentsAffected}
                      </div>
                      <div className="text-xs text-gray-600">Enrollments Lost</div>
                    </div>
                    
                    <div className="text-center p-3 bg-white rounded border">
                      <div className="flex items-center justify-center mb-1">
                        <Calendar className="text-gray-600" size={16} />
                      </div>
                      <div className="text-lg font-bold text-gray-800">
                        {deletionImpact.impact.attendanceRecordsAffected}
                      </div>
                      <div className="text-xs text-gray-600">Attendance Lost</div>
                    </div>
                  </div>
                </div>
                </div>
              ) : null}
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(null);
                  setDeletionImpact(null);
                }}
                disabled={deleting || loadingImpact}
                className="flex-1 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteClassroom}
                disabled={deleting || loadingImpact || !deletionImpact}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {deleting ? (
                  <div className="flex items-center justify-center">
                    <Loader2 className="animate-spin mr-2" size={16} />
                    Permanently Deleting...
                  </div>
                ) : (
                  'Delete Classroom'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClassroomManagement;