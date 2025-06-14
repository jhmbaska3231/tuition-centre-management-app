// frontend/src/services/classroom.ts

import type { Classroom, ApiError, CreateClassroomRequest, UpdateClassroomRequest, ClassroomDeletionImpact, ClassroomAvailability } from '../types';
import AuthService from './auth';

class ClassroomService {
  private static readonly API_BASE_URL = 'http://localhost:3001/api';

  private static getAuthHeaders() {
    const token = AuthService.getToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  static async getClassroomsByBranch(branchId: string): Promise<Classroom[]> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/classrooms/branch/${branchId}`, {
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
      throw new Error('An unexpected error occurred while fetching classrooms');
    }
  }

  static async getAllClassrooms(): Promise<Classroom[]> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/classrooms/all`, {
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
      throw new Error('An unexpected error occurred while fetching all classrooms');
    }
  }

  static async getClassroom(classroomId: string): Promise<Classroom> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/classrooms/${classroomId}`, {
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
      throw new Error('An unexpected error occurred while fetching classroom');
    }
  }

  static async getClassroomAvailability(classroomId: string, date: string, excludeClassId?: string): Promise<ClassroomAvailability> {
    try {
      const params = new URLSearchParams({ date });
      if (excludeClassId) {
        params.append('exclude_class_id', excludeClassId);
      }

      const response = await fetch(`${this.API_BASE_URL}/classrooms/${classroomId}/availability?${params}`, {
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
      throw new Error('An unexpected error occurred while checking classroom availability');
    }
  }

  static async createClassroom(classroomData: CreateClassroomRequest): Promise<any> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/classrooms`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(classroomData),
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
      throw new Error('An unexpected error occurred while creating classroom');
    }
  }

  static async updateClassroom(classroomId: string, classroomData: UpdateClassroomRequest): Promise<any> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/classrooms/${classroomId}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(classroomData),
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
      throw new Error('An unexpected error occurred while updating classroom');
    }
  }

  static async getClassroomDeletionImpact(classroomId: string): Promise<ClassroomDeletionImpact> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/classrooms/${classroomId}/deletion-impact`, {
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
      throw new Error('An unexpected error occurred while checking deletion impact');
    }
  }

  static async deleteClassroom(classroomId: string, acknowledged: boolean = false): Promise<any> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/classrooms/${classroomId}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ acknowledged }),
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
      throw new Error('An unexpected error occurred while deleting classroom');
    }
  }
}

export default ClassroomService;