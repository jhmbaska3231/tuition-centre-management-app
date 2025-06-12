// frontend/src/services/payment.ts

import type { Payment, ApiError } from '../types';
import AuthService from './auth';

class PaymentService {
  private static readonly API_BASE_URL = 'http://localhost:3001/api';

  private static getAuthHeaders() {
    const token = AuthService.getToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  static async getMyStudentsPayments(): Promise<Payment[]> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/payments/my-students`, {
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
      throw new Error('An unexpected error occurred while fetching payments');
    }
  }

  static async getStudentPaymentHistory(studentId: string): Promise<Payment[]> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/payments/${studentId}/history`, {
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
      throw new Error('An unexpected error occurred while fetching payment history');
    }
  }
}

export default PaymentService;