// frontend/src/services/student.ts

import type { Student, CreateStudentRequest, UpdateStudentRequest, ApiError } from '../types';
import AuthService from './auth';

class StudentService {
  private static readonly API_BASE_URL = 'http://localhost:8080/api';

  private static getAuthHeaders() {
    const token = AuthService.getToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  static async getMyStudents(): Promise<Student[]> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/students/my-students`, {
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        if (response.status === 401) {
          AuthService.removeToken();
          throw new Error('Session expired. Please login again.');
        }
        const errorData: ApiError = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('An unexpected error occurred while fetching students');
    }
  }

  static async createStudent(studentData: CreateStudentRequest): Promise<Student> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/students`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(studentData),
      });

      if (!response.ok) {
        const errorData: ApiError = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result.student;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('An unexpected error occurred while creating student');
    }
  }

  static async updateStudent(studentId: string, studentData: UpdateStudentRequest): Promise<Student> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/students/${studentId}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(studentData),
      });

      if (!response.ok) {
        const errorData: ApiError = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result.student;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('An unexpected error occurred while updating student');
    }
  }

  static async deleteStudent(studentId: string): Promise<void> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/students/${studentId}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData: ApiError = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('An unexpected error occurred while deleting student');
    }
  }

  static async getStudent(studentId: string): Promise<Student> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/students/${studentId}`, {
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData: ApiError = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('An unexpected error occurred while fetching student');
    }
  }
}

export default StudentService;