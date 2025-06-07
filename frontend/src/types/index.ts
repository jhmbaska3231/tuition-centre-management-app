// src/types/index.ts

export interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  role: 'parent' | 'staff';
  created_at?: string;
  updated_at?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
  message: string;
}

export interface RegisterResponse {
  token: string;
  user: User;
  message: string;
}

export interface AuthResponse {
  user: User;
}

export interface ApiError {
  error: string;
  message?: string;
}

export interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (registrationData: RegisterRequest) => Promise<void>;
  logout: () => void;
  updateUserProfile?: (user: User) => void;
  loading: boolean;
  isAuthenticated: boolean;
}

export interface UserProfileUpdateRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export interface Branch {
  id: string;
  name: string;
  address: string;
  phone?: string;
  active: boolean;
  created_at: string;
}

export interface Student {
  id: string;
  name: string;
  grade: string;
  date_of_birth?: string;
  parent_id?: string;
  home_branch_id?: string;
  home_branch_name?: string;
  home_branch_address?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateStudentRequest {
  name: string;
  grade: string;
  dateOfBirth?: string;
  homeBranchId?: string;
}

export interface UpdateStudentRequest {
  name?: string;
  grade?: string;
  dateOfBirth?: string;
  homeBranchId?: string;
}

export interface Payment {
  id: string;
  student_id: string;
  student_name: string;
  month: string;
  amount: number | string; // Can be string from database
  paid: boolean;
  payment_date?: string;
  payment_method?: 'cash' | 'card' | 'bank_transfer' | 'online';
  notes?: string;
  created_at: string;
}

export interface Class {
  id: string;
  subject: string;
  start_time: string;
  duration_minutes: number;
  capacity: number;
  active: boolean;
  created_at: string;
  branch_name: string;
  branch_address: string;
  tutor_first_name?: string;
  tutor_last_name?: string;
  enrolled_count: number;
}

export interface Enrollment {
  id: string;
  student_id: string;
  class_id: string;
  enrolled_at: string;
  status: 'enrolled' | 'cancelled' | 'completed';
  cancelled_at?: string;
  student_name: string;
  subject: string;
  start_time: string;
  duration_minutes: number;
  branch_name: string;
  branch_address: string;
  tutor_first_name?: string;
  tutor_last_name?: string;
}

export interface CreateEnrollmentRequest {
  studentId: string;
  classId: string;
}