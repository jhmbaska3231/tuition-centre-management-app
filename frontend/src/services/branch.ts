// src/services/branch.ts

import type { Branch, ApiError } from '../types';

class BranchService {
  private static readonly API_BASE_URL = 'http://localhost:3001/api';

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
}

export default BranchService;