// src/services/admin.ts

import type { 
  StaffMember, 
  CreateStaffRequest, 
  UpdateStaffRequest, 
  StaffDeletionImpact,
  UnassignedClass,
  AssignTutorRequest,
  UserOverview,
  ApiError 
} from '../types';
import AuthService from './auth';

class AdminService {
  private static readonly API_BASE_URL = 'http://localhost:3001/api';

  private static getAuthHeaders() {
    const token = AuthService.getToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  // Staff Management
  static async getAllStaff(): Promise<StaffMember[]> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/admin/staff`, {
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
      throw new Error('An unexpected error occurred while fetching staff');
    }
  }

  static async getStaffMember(staffId: string): Promise<StaffMember> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/admin/staff/${staffId}`, {
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
      throw new Error('An unexpected error occurred while fetching staff member');
    }
  }

  static async createStaffMember(staffData: CreateStaffRequest): Promise<any> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/admin/staff`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(staffData),
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
      throw new Error('An unexpected error occurred while creating staff member');
    }
  }

  static async updateStaffMember(staffId: string, staffData: UpdateStaffRequest): Promise<any> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/admin/staff/${staffId}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(staffData),
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
      throw new Error('An unexpected error occurred while updating staff member');
    }
  }

  static async getStaffDeletionImpact(staffId: string): Promise<StaffDeletionImpact> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/admin/staff/${staffId}/deletion-impact`, {
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

  static async deleteStaffMember(staffId: string, acknowledged: boolean = false): Promise<any> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/admin/staff/${staffId}`, {
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
      throw new Error('An unexpected error occurred while deleting staff member');
    }
  }

  // Class Management
  static async getUnassignedClasses(): Promise<UnassignedClass[]> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/admin/classes/unassigned`, {
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
      throw new Error('An unexpected error occurred while fetching unassigned classes');
    }
  }

  static async assignTutorToClass(classId: string, assignData: AssignTutorRequest): Promise<any> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/admin/classes/${classId}/assign-tutor`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(assignData),
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
      throw new Error('An unexpected error occurred while assigning tutor');
    }
  }

  // Analytics
  static async getUsersOverview(): Promise<UserOverview[]> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/admin/users/overview`, {
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
      throw new Error('An unexpected error occurred while fetching users overview');
    }
  }
}

export default AdminService;