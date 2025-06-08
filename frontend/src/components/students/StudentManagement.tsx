// src/components/students/StudentManagement.tsx

import React, { useState, useEffect } from 'react';
import { Plus, Users, Loader2 } from 'lucide-react';
import type { Student } from '../../types';
import StudentService from '../../services/student';
import StudentCard from './StudentCard';
import StudentForm from './StudentForm';

const StudentManagement: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Student | null>(null);

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    setLoading(true);
    setError('');
    try {
      const studentList = await StudentService.getMyStudents();
      setStudents(studentList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const handleAddStudent = () => {
    setEditingStudent(null);
    setShowForm(true);
  };

  const handleEditStudent = (student: Student) => {
    setEditingStudent(student);
    setShowForm(true);
  };

  const handleDeleteStudent = (student: Student) => {
    setShowDeleteConfirm(student);
  };

  const confirmDelete = async () => {
    if (!showDeleteConfirm) return;

    try {
      await StudentService.deleteStudent(showDeleteConfirm.id);
      setStudents(students.filter(s => s.id !== showDeleteConfirm.id));
      setShowDeleteConfirm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete student');
      setShowDeleteConfirm(null);
    }
  };

  const handleFormSuccess = () => {
    loadStudents(); // Reload the student list
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center space-x-3">
          <Loader2 className="animate-spin text-blue-600" size={24} />
          <span className="text-lg text-gray-700">Loading students...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-16">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-3">
          <Users className="text-blue-600" size={32} />
          <div>
            <h1 className="text-3xl font-bold text-gray-800">My Students</h1>
            <p className="text-gray-600">Manage your children's information</p>
          </div>
        </div>
        <button
          onClick={handleAddStudent}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl transition-all duration-200 shadow-md text-lg font-semibold min-w-fit whitespace-nowrap"
        >
          <Plus size={20} />
          <span>Add Student</span>
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600">{error}</p>
          <button
            onClick={loadStudents}
            className="mt-2 text-sm text-red-700 hover:text-red-800 underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Students Grid */}
      {students.length === 0 ? (
        <div className="text-center py-12">
          <Users className="mx-auto text-gray-300 mb-4" size={64} />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">No Students Added Yet</h3>
          <p className="text-gray-500 mb-6">
            Start by adding your first child to the system.
          </p>
          <button
            onClick={handleAddStudent}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl transition-all duration-200 text-lg font-semibold"
          >
            Add Your First Student
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {students.map((student) => (
            <StudentCard
              key={student.id}
              student={student}
              onEdit={handleEditStudent}
              onDelete={handleDeleteStudent}
            />
          ))}
        </div>
      )}

      {/* Student Form Modal */}
      <StudentForm
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        student={editingStudent}
        onSuccess={handleFormSuccess}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md relative shadow-2xl">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Confirm Delete</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to remove <span className="font-semibold">{showDeleteConfirm.first_name} {showDeleteConfirm.last_name}</span>? 
              This action cannot be undone.
            </p>
            
            <div className="flex space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentManagement;