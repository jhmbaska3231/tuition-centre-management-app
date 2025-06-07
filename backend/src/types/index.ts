// backend/src/types/index.ts

export interface User {
  id: string;
  email: string;
  password: string;
  role: 'parent' | 'staff';
  first_name: string;
  last_name: string;
  phone?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Student {
  id: string;
  name: string;
  grade: string;
  date_of_birth?: Date;
  parent_id?: string;
  home_branch_id?: string;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Branch {
  id: string;
  name: string;
  address: string;
  phone?: string;
  active: boolean;
  created_at: Date;
}

export interface Class {
  id: string;
  subject: string;
  tutor_id?: string;
  start_time: Date;
  duration_minutes: number;
  capacity: number;
  branch_id?: string;
  created_by?: string;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Enrollment {
  id: string;
  student_id: string;
  class_id: string;
  enrolled_at: Date;
  enrolled_by?: string;
  status: 'enrolled' | 'cancelled' | 'completed';
  cancelled_at?: Date;
}

export interface Payment {
  id: string;
  student_id: string;
  month: string;
  amount: number;
  paid: boolean;
  payment_date?: Date;
  payment_method?: 'cash' | 'card' | 'bank_transfer' | 'online';
  notes?: string;
  created_at: Date;
}

export interface Attendance {
  id: string;
  student_id: string;
  class_id: string;
  date: Date;
  status: 'present' | 'absent' | 'late';
  marked_by?: string;
  marked_at: Date;
}