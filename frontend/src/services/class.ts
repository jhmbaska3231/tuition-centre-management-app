// frontend/src/services/class.ts

import type { Class, CreateClassRequest, UpdateClassRequest, ApiError } from '../types';
import AuthService from './auth';

class ClassService {
  // private static readonly API_BASE_URL = 'http://localhost:8080/api';
  private static readonly API_BASE_URL = '/api';

  private static getAuthHeaders() {
    const token = AuthService.getToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  static async getAllClasses(params?: {
    branchId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<Class[]> {
    try {
      const searchParams = new URLSearchParams();
      if (params?.branchId) searchParams.append('branchId', params.branchId);
      if (params?.startDate) searchParams.append('startDate', params.startDate);
      if (params?.endDate) searchParams.append('endDate', params.endDate);

      const queryString = searchParams.toString();
      const url = `${this.API_BASE_URL}/classes${queryString ? `?${queryString}` : ''}`;

      const response = await fetch(url, {
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
      throw new Error('An unexpected error occurred while fetching classes');
    }
  }

  static async getClass(classId: string): Promise<Class> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/classes/${classId}`, {
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
      throw new Error('An unexpected error occurred while fetching class');
    }
  }

  static async createClass(classData: CreateClassRequest): Promise<any> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/classes`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(classData),
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
      throw new Error('An unexpected error occurred while creating class');
    }
  }

  static async updateClass(classId: string, classData: UpdateClassRequest): Promise<any> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/classes/${classId}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(classData),
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
      throw new Error('An unexpected error occurred while updating class');
    }
  }

  static async deleteClass(classId: string): Promise<void> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/classes/${classId}`, {
        method: 'DELETE',
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
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('An unexpected error occurred while deleting class');
    }
  }
}

export default ClassService;