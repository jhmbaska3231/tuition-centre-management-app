// frontend/src/services/enrollment.ts

import type { Enrollment, CreateEnrollmentRequest, ApiError } from '../types';
import AuthService from './auth';

class EnrollmentService {
  private static readonly API_BASE_URL = 'http://localhost:8080/api';

  private static getAuthHeaders() {
    const token = AuthService.getToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  static async getMyStudentsEnrollments(): Promise<Enrollment[]> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/enrollments/my-students`, {
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
      throw new Error('An unexpected error occurred while fetching enrollments');
    }
  }

  static async createEnrollment(enrollmentData: CreateEnrollmentRequest): Promise<any> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/enrollments`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(enrollmentData),
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
      throw new Error('An unexpected error occurred while creating enrollment');
    }
  }

  static async cancelEnrollment(enrollmentId: string): Promise<void> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/enrollments/${enrollmentId}`, {
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
      throw new Error('An unexpected error occurred while cancelling enrollment');
    }
  }

  static async getEnrollment(enrollmentId: string): Promise<Enrollment> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/enrollments/${enrollmentId}`, {
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
      throw new Error('An unexpected error occurred while fetching enrollment');
    }
  }
}

export default EnrollmentService;