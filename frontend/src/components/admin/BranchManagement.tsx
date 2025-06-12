// frontend/src/components/admin/BranchManagement.tsx

import React, { useState, useEffect } from 'react';
import { MapPin, Plus, Edit2, Trash2, AlertTriangle, Loader2, CheckCircle, XCircle, Phone, Calendar, Users, BookOpen, UserX } from 'lucide-react';
import type { Branch, BranchDeletionImpact } from '../../types';
import BranchService from '../../services/branch';
import BranchForm from './BranchForm';

const BranchManagement: React.FC = () => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modal states
  const [showBranchForm, setShowBranchForm] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  
  // Delete confirmation states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Branch | null>(null);
  const [deletionImpact, setDeletionImpact] = useState<BranchDeletionImpact | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [loadingImpact, setLoadingImpact] = useState(false);

  useEffect(() => {
    loadBranches();
  }, []);

  const loadBranches = async () => {
    setLoading(true);
    setError('');
    try {
      const branchList = await BranchService.getAllBranchesAdmin();
      setBranches(branchList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load branches');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBranch = () => {
    setEditingBranch(null);
    setShowBranchForm(true);
  };

  const handleEditBranch = (branch: Branch) => {
    setEditingBranch(branch);
    setShowBranchForm(true);
  };

  const handleDeleteBranch = async (branch: Branch) => {
    setShowDeleteConfirm(branch);
    setLoadingImpact(true);
    setDeletionImpact(null);
    
    try {
      const impact = await BranchService.getBranchDeletionImpact(branch.id);
      setDeletionImpact(impact);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check deletion impact');
      setShowDeleteConfirm(null);
    } finally {
      setLoadingImpact(false);
    }
  };

  const confirmDeleteBranch = async () => {
    if (!showDeleteConfirm) return;

    setDeleting(true);
    try {
      await BranchService.deleteBranch(showDeleteConfirm.id, true);
      
      // Refresh branch list
      await loadBranches();
      
      setShowDeleteConfirm(null);
      setDeletionImpact(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete branch');
    } finally {
      setDeleting(false);
    }
  };

  const handleFormSuccess = () => {
    loadBranches(); // Reload the branch list
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
          <Loader2 className="animate-spin text-blue-600" size={24} />
          <span className="text-lg text-gray-700">Loading branches...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-16">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-3">
          <MapPin className="text-blue-600" size={32} />
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Branch Management</h1>
            <p className="text-gray-600">Manage tuition center branches and locations</p>
          </div>
        </div>
        
        <button
          onClick={handleCreateBranch}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl transition-all duration-200 shadow-md text-lg font-semibold"
        >
          <Plus size={20} />
          <span>Add Branch</span>
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
            <CheckCircle className="text-green-600" size={24} />
            <h3 className="text-lg font-semibold text-gray-800">Active Branches</h3>
          </div>
          <p className="text-2xl font-bold text-green-600">
            {branches.filter(b => b.active).length}
          </p>
          <p className="text-sm text-gray-500 mt-1">Currently operational</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
          <div className="flex items-center space-x-3 mb-2">
            <XCircle className="text-red-600" size={24} />
            <h3 className="text-lg font-semibold text-gray-800">Inactive Branches</h3>
          </div>
          <p className="text-2xl font-bold text-red-600">
            {branches.filter(b => !b.active).length}
          </p>
          <p className="text-sm text-gray-500 mt-1">Temporarily disabled</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
          <div className="flex items-center space-x-3 mb-2">
            <MapPin className="text-blue-600" size={24} />
            <h3 className="text-lg font-semibold text-gray-800">Total Branches</h3>
          </div>
          <p className="text-2xl font-bold text-blue-600">{branches.length}</p>
          <p className="text-sm text-gray-500 mt-1">All locations</p>
        </div>
      </div>

      {/* Branches Grid */}
      {branches.length === 0 ? (
        <div className="text-center py-12">
          <MapPin className="mx-auto text-gray-300 mb-4" size={64} />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">No Branches</h3>
          <p className="text-gray-500 mb-6">
            Start by adding your first branch to the system.
          </p>
          <button
            onClick={handleCreateBranch}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl transition-all duration-200 text-lg font-semibold"
          >
            Add First Branch
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {branches.map((branch) => (
            <div key={branch.id} className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    branch.active ? 'bg-green-100' : 'bg-gray-100'
                  }`}>
                    <MapPin className={branch.active ? 'text-green-600' : 'text-gray-600'} size={20} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">{branch.name}</h3>
                    <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                      branch.active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {branch.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEditBranch(branch)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit Branch"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDeleteBranch(branch)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete Branch (Permanent)"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Branch Details */}
              <div className="space-y-3 mb-4">
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Address:</p>
                  <p className="text-sm text-gray-600 leading-relaxed">{branch.address}</p>
                </div>
                
                {branch.phone && (
                  <div className="flex items-center space-x-2">
                    <Phone size={14} className="text-gray-400" />
                    <span className="text-sm text-gray-600">{branch.phone}</span>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="pt-4 border-t border-gray-100">
                <div className="grid grid-cols-2 gap-4 text-xs text-gray-500">
                  <div>
                    <p className="font-medium">Created:</p>
                    <p>{formatDate(branch.created_at)}</p>
                  </div>
                  <div>
                    <p className="font-medium">Updated:</p>
                    <p>{formatDate(branch.updated_at)}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Branch Form Modal */}
      <BranchForm
        isOpen={showBranchForm}
        onClose={() => setShowBranchForm(false)}
        branch={editingBranch}
        onSuccess={handleFormSuccess}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-3xl relative shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">PERMANENT Branch Deletion</h3>
            
            <div className="mb-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="text-red-600" size={24} />
              </div>
              
              <p className="text-gray-700 mb-2 font-medium">
                You are about to permanently delete this branch and ALL associated data.
              </p>
              <p className="text-red-600 text-sm mb-4">
                This action cannot be undone. All data will be permanently lost.
              </p>
              
              <div className="bg-gray-50 p-4 rounded-lg text-left mb-4">
                <p className="font-semibold text-gray-800">{showDeleteConfirm.name}</p>
                <p className="text-sm text-gray-600">{showDeleteConfirm.address}</p>
                {showDeleteConfirm.phone && (
                  <p className="text-sm text-gray-600">Phone: {showDeleteConfirm.phone}</p>
                )}
              </div>

              {/* Enhanced Impact Analysis */}
              {loadingImpact ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="animate-spin text-blue-600 mr-2" size={20} />
                  <span className="text-gray-600">Analyzing deletion impact...</span>
                </div>
              ) : deletionImpact ? (
                <div className="text-left">
                  {deletionImpact.impact.warning && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
                      <p className="text-red-800 text-sm font-medium mb-2">Critical Warning</p>
                      <p className="text-red-700 text-sm">{deletionImpact.impact.warning}</p>
                    </div>
                  )}

                  <div className="bg-gray-50 p-4 rounded-lg mb-4">
                    <p className="font-medium text-gray-800 mb-3">Permanent Deletion Impact:</p>
                    
                    {/* Impact Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                      <div className="text-center p-3 bg-red-100 rounded-lg">
                        <div className="flex items-center justify-center mb-1">
                          <BookOpen className="text-red-600" size={16} />
                        </div>
                        <div className="text-lg font-bold text-red-600">
                          {deletionImpact.impact.totalClasses}
                        </div>
                        <div className="text-xs text-red-700">Classes Deleted</div>
                        {deletionImpact.impact.futureClasses > 0 && (
                          <div className="text-xs text-red-600 mt-1">
                            ({deletionImpact.impact.futureClasses} future)
                          </div>
                        )}
                      </div>
                      
                      <div className="text-center p-3 bg-orange-100 rounded-lg">
                        <div className="flex items-center justify-center mb-1">
                          <Users className="text-orange-600" size={16} />
                        </div>
                        <div className="text-lg font-bold text-orange-600">
                          {deletionImpact.impact.enrollmentsAffected}
                        </div>
                        <div className="text-xs text-orange-700">Enrollments Lost</div>
                      </div>
                      
                      <div className="text-center p-3 bg-yellow-100 rounded-lg">
                        <div className="flex items-center justify-center mb-1">
                          <Calendar className="text-yellow-600" size={16} />
                        </div>
                        <div className="text-lg font-bold text-yellow-600">
                          {deletionImpact.impact.attendanceRecordsLost}
                        </div>
                        <div className="text-xs text-yellow-700">Attendance Lost</div>
                      </div>
                      
                      <div className="text-center p-3 bg-blue-100 rounded-lg">
                        <div className="flex items-center justify-center mb-1">
                          <UserX className="text-blue-600" size={16} />
                        </div>
                        <div className="text-lg font-bold text-blue-600">
                          {deletionImpact.impact.studentsAffected}
                        </div>
                        <div className="text-xs text-blue-700">Students Affected</div>
                        <div className="text-xs text-blue-600 mt-1">(home branch cleared)</div>
                      </div>
                      
                      <div className="text-center p-3 bg-purple-100 rounded-lg">
                        <div className="flex items-center justify-center mb-1">
                          <CheckCircle className="text-purple-600" size={16} />
                        </div>
                        <div className="text-lg font-bold text-purple-600">
                          {deletionImpact.impact.paymentsAffected}
                        </div>
                        <div className="text-xs text-purple-700">Payment Records</div>
                        <div className="text-xs text-purple-600 mt-1">(preserved)</div>
                      </div>
                    </div>
                    
                    <div className="p-3 bg-red-50 border border-red-200 rounded">
                      <p className="text-sm text-red-800 font-medium">
                        All classes, enrollments, and attendance records will be permanently deleted. 
                        Students will lose their home branch association but remain in the system. 
                        Payment records are preserved for auditing purposes.
                      </p>
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
                onClick={confirmDeleteBranch}
                disabled={deleting || loadingImpact || !deletionImpact}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {deleting ? (
                  <div className="flex items-center justify-center">
                    <Loader2 className="animate-spin mr-2" size={16} />
                    Permanently Deleting...
                  </div>
                ) : (
                  'PERMANENTLY Delete Branch'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BranchManagement;