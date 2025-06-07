// src/components/students/StudentCard.tsx

import React from 'react';
import { User, GraduationCap, MapPin, Edit2, Trash2, Calendar } from 'lucide-react';
import type { Student } from '../../types';

interface StudentCardProps {
  student: Student;
  onEdit: (student: Student) => void;
  onDelete: (student: Student) => void;
}

const StudentCard: React.FC<StudentCardProps> = ({ student, onEdit, onDelete }) => {
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not provided';
    const date = new Date(dateString);
    
    return date.toLocaleDateString('en-SG', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric'
    });
  };

  const calculateAge = (dateString?: string) => {
    if (!dateString) return null;
    const today = new Date();
    const birthDate = new Date(dateString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  };

  const age = calculateAge(student.date_of_birth);

  return (
    <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border border-gray-100">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
            <User className="text-white" size={20} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-800">{student.name}</h3>
            <p className="text-gray-500 text-sm">Student ID: {student.id.slice(0, 8)}...</p>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex space-x-2">
          <button
            onClick={() => onEdit(student)}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit Student"
          >
            <Edit2 size={16} />
          </button>
          <button
            onClick={() => onDelete(student)}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete Student"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Student Details */}
      <div className="space-y-2">
        <div className="flex items-center space-x-3">
          <GraduationCap className="text-green-600" size={16} />
          <span className="text-gray-700">
            <span className="font-medium">Grade:</span> <span className="ml-2">{student.grade}</span>
          </span>
        </div>

        {student.date_of_birth && (
          <div className="flex items-center space-x-3">
            <Calendar className="text-blue-600" size={16} />
            <span className="text-gray-700">
              <span className="font-medium">Born:</span> <span className="ml-2">{formatDate(student.date_of_birth)}</span>
              {age && <span className="text-gray-500 ml-2">({age} years old)</span>}
            </span>
          </div>
        )}

        {student.home_branch_name && (
          <div className="flex items-center space-x-3">
            <MapPin className="text-orange-600" size={16} />
            <span className="text-gray-700">
              <span className="font-medium">Home Branch:</span> <span className="ml-2">{student.home_branch_name}</span>
            </span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-gray-100">
        <p className="text-xs text-gray-400">
          Added on {formatDate(student.created_at)}
        </p>
      </div>
    </div>
  );
};

export default StudentCard;