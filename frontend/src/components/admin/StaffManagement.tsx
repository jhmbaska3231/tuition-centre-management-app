// frontend/src/components/admin/StaffManagement.tsx

import React, { useState, useEffect } from 'react';
import { X, Users, Plus, Edit2, Trash2, Loader2, UserCheck, UserX } from 'lucide-react';
import type { StaffMember, StaffDeletionImpact } from '../../types';
import AdminService from '../../services/admin';
import StaffForm from './StaffForm';

const StaffManagement: React.FC = () => {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modal states
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  
  // Delete confirmation states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<StaffMember | null>(null);
  const [deletionImpact, setDeletionImpact] = useState<StaffDeletionImpact | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [loadingImpact, setLoadingImpact] = useState(false);

  useEffect(() => {
    loadStaff();
  }, []);

  const loadStaff = async () => {
    setLoading(true);
    setError('');
    try {
      const staffList = await AdminService.getAllStaff();
      setStaff(staffList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load staff');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStaff = () => {
    setEditingStaff(null);
    setShowStaffForm(true);
  };

  const handleEditStaff = (staffMember: StaffMember) => {
    setEditingStaff(staffMember);
    setShowStaffForm(true);
  };

  const handleClose = () => {
    setShowDeleteConfirm(null);
    setDeletionImpact(null);
  }

  const handleDeleteStaff = async (staffMember: StaffMember) => {
    setShowDeleteConfirm(staffMember);
    setLoadingImpact(true);
    setDeletionImpact(null);
    
    try {
      const impact = await AdminService.getStaffDeletionImpact(staffMember.id);
      setDeletionImpact(impact);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check deletion impact');
      setShowDeleteConfirm(null);
    } finally {
      setLoadingImpact(false);
    }
  };

  const confirmDeleteStaff = async () => {
    if (!showDeleteConfirm) return;

    setDeleting(true);
    try {
      await AdminService.deleteStaffMember(showDeleteConfirm.id, true);
      
      // Refresh staff list
      await loadStaff();
      
      setShowDeleteConfirm(null);
      setDeletionImpact(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete staff member');
    } finally {
      setDeleting(false);
    }
  };

  const handleFormSuccess = () => {
    loadStaff(); // Reload the staff list
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-SG', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center space-x-3">
          <Loader2 className="animate-spin text-indigo-600" size={24} />
          <span className="text-lg text-gray-700">Loading staff...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-16">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-3">
          <Users className="text-indigo-500" size={32} />
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Staff Management</h1>
            <p className="text-gray-600">Manage teacher and staff accounts</p>
          </div>
        </div>
        
        <button
          onClick={handleCreateStaff}
          className="flex items-center space-x-2 bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-3 rounded-2xl transition-all duration-200 shadow-md text-lg font-semibold"
        >
          <Plus size={20} />
          <span>Add Staff Member</span>
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

      {/* Staff Grid */}
      {staff.length === 0 ? (
        <div className="text-center py-12">
          <Users className="mx-auto text-gray-300 mb-4" size={64} />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">No Staff Members</h3>
          <p className="text-gray-500 mb-6">
            Start by adding your first staff member to the system.
          </p>
          <button
            onClick={handleCreateStaff}
            className="bg-indigo-500 hover:bg-indigo-600 text-white px-8 py-4 rounded-2xl transition-all duration-200 text-lg font-semibold"
          >
            Add First Staff Member
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {staff.map((staffMember) => (
            <div key={staffMember.id} className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    staffMember.active ? 'bg-indigo-100' : 'bg-gray-100'
                  }`}>
                    {staffMember.active ? (
                      <UserCheck className="text-indigo-600" size={20} />
                    ) : (
                      <UserX className="text-gray-600" size={20} />
                    )}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">
                      {staffMember.first_name} {staffMember.last_name}
                    </h3>
                    <p className="text-gray-500 text-sm">{staffMember.email}</p>
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEditStaff(staffMember)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit Staff Member"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDeleteStaff(staffMember)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete Staff Member"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Staff Details */}
              <div className="space-y-2 mb-4">
                {staffMember.phone && (
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Phone:</span> {staffMember.phone}
                  </p>
                )}
                
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Status:</span>{' '}
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    staffMember.active 
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {staffMember.active ? 'Active' : 'Inactive'}
                  </span>
                </p>

                {staffMember.class_count !== undefined && (
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Classes@@@:</span> {staffMember.class_count} total
                    {staffMember.future_class_count !== undefined && staffMember.future_class_count > 0 && (
                      <span className="text-blue-600"> ({staffMember.future_class_count} upcoming)</span>
                    )}
                  </p>
                )}
              </div>

              {/* Footer */}
              <div className="pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-400">
                  Joined {formatDate(staffMember.created_at)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Staff Form Modal */}
      <StaffForm
        isOpen={showStaffForm}
        onClose={() => setShowStaffForm(false)}
        staffMember={editingStaff}
        onSuccess={handleFormSuccess}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-gradient-to-br from-white-100 to-indigo-200 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-2xl relative shadow-2xl max-h-[90vh] overflow-y-auto">
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
              type="button"
            >
              <X size={24} />
            </button>
            <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">Confirm Staff Deletion</h3>
            
            <div className="mb-6 text-center">              
              <p className="text-gray-700 mb-2">
                Are you sure you want to delete this staff member?
              </p>
              
              <div className="bg-gray-50 p-4 rounded-lg text-left mb-4">
                <p className="font-semibold text-gray-800">
                  {showDeleteConfirm.first_name} {showDeleteConfirm.last_name}
                </p>
                <p className="text-sm text-gray-600">{showDeleteConfirm.email}</p>
              </div>

              {/* Impact Analysis */}
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

                  {deletionImpact.impact.affectedClasses.length > 0 && (
                    <div className="bg-gray-50 p-4 rounded-lg mb-4">
                      <p className="font-medium text-gray-800 mb-2">
                        Affected Classes ({deletionImpact.impact.affectedClasses.length}):
                      </p>
                      <div className="max-h-42 overflow-y-auto space-y-2">
                        {deletionImpact.impact.affectedClasses.map((cls) => (
                          <div key={cls.id} className="text-sm text-gray-600 p-2 bg-white rounded border">
                            <p className="font-medium">{cls.subject}</p>
                            <p>{formatDateTime(cls.start_time)} • {cls.branch_name}</p>
                            <p>{cls.enrolled_count} students enrolled</p>
                          </div>
                        ))}
                      </div>
                      <p className="text-sm text-blue-600 mt-2">
                        These classes will have no assigned tutor after deletion. 
                        You can reassign them to other staff members later.
                      </p>
                    </div>
                  )}
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
                onClick={confirmDeleteStaff}
                disabled={deleting || loadingImpact || !deletionImpact}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {deleting ? (
                  <div className="flex items-center justify-center">
                    <Loader2 className="animate-spin mr-2" size={16} />
                    Deleting...
                  </div>
                ) : (
                  'Delete Staff Member'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffManagement;