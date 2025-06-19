// frontend/src/services/branch.ts

import type { Branch, ApiError, CreateBranchRequest, UpdateBranchRequest, BranchDeletionImpact } from '../types';
import AuthService from './auth';

class BranchService {
  // private static readonly API_BASE_URL = 'http://localhost:8080/api';
  private static readonly API_BASE_URL = '/api';

  private static getAuthHeaders() {
    const token = AuthService.getToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  static async getAllBranches(): Promise<Branch[]> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/branches`);

      if (!response.ok) {
        const errorData: ApiError = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('An unexpected error occurred while fetching branches');
    }
  }

  static async getAllBranchesAdmin(): Promise<Branch[]> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/branches/all`, {
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
      throw new Error('An unexpected error occurred while fetching all branches');
    }
  }

  static async getBranch(branchId: string): Promise<Branch> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/branches/${branchId}`, {
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
      throw new Error('An unexpected error occurred while fetching branch');
    }
  }

  static async createBranch(branchData: CreateBranchRequest): Promise<any> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/branches`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(branchData),
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
      throw new Error('An unexpected error occurred while creating branch');
    }
  }

  static async updateBranch(branchId: string, branchData: UpdateBranchRequest): Promise<any> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/branches/${branchId}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(branchData),
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
      throw new Error('An unexpected error occurred while updating branch');
    }
  }

  static async getBranchDeletionImpact(branchId: string): Promise<BranchDeletionImpact> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/branches/${branchId}/deletion-impact`, {
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

  static async deleteBranch(branchId: string, acknowledged: boolean = false): Promise<any> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/branches/${branchId}`, {
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
      throw new Error('An unexpected error occurred while deleting branch');
    }
  }
}

export default BranchService;