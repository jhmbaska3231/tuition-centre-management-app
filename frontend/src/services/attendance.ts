// frontend/src/services/attendance.ts

import type { 
  StaffClass, 
  ClassStudent, 
  AttendanceRecord, 
  AttendanceMarkRequest, 
  AttendanceSummary,
  ApiError 
} from '../types';
import AuthService from './auth';

class AttendanceService {
  // private static readonly API_BASE_URL = 'http://localhost:8080/api';
  private static readonly API_BASE_URL = '/api';

  private static getAuthHeaders() {
    const token = AuthService.getToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  static async getMyClasses(): Promise<StaffClass[]> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/attendance/my-classes`, {
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

  static async getClassStudents(classId: string): Promise<ClassStudent[]> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/attendance/class/${classId}/students`, {
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
      throw new Error('An unexpected error occurred while fetching class students');
    }
  }

  static async getAttendanceRecords(classId: string, date: string): Promise<AttendanceRecord[]> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/attendance/class/${classId}/date/${date}`, {
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
      throw new Error('An unexpected error occurred while fetching attendance records');
    }
  }

  static async markAttendance(classId: string, date: string, attendanceRecords: AttendanceMarkRequest[]): Promise<any> {
    try {
      const requestBody = { attendanceRecords };
      
      const response = await fetch(`${this.API_BASE_URL}/attendance/class/${classId}/date/${date}/mark`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        if (response.status === 401) {
          AuthService.removeToken();
          throw new Error('Session expired. Please login again.');
        }
        
        // Try to get detailed error from response
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData: ApiError = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (parseError) {
          console.error('Could not parse error response:', parseError);
        }
        
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('An unexpected error occurred while marking attendance');
    }
  }

  static async getAttendanceSummary(classId: string, startDate?: string, endDate?: string): Promise<AttendanceSummary> {
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      
      const queryString = params.toString();
      const url = `${this.API_BASE_URL}/attendance/class/${classId}/summary${queryString ? `?${queryString}` : ''}`;

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
      throw new Error('An unexpected error occurred while fetching attendance summary');
    }
  }
}

export default AttendanceService;