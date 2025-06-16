// frontend/src/types/index.ts

// Represents a user in the system (parent, staff, or admin)
export interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  role: 'parent' | 'staff' | 'admin';
  created_at: string;
  updated_at: string;
}

// Represents a student entity with academic and contact information
export interface Student {
  id: string;
  first_name: string;
  last_name: string;
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

// Represents a physical branch/location of the tutoring center
export interface Branch {
  id: string;
  name: string;
  address: string;
  phone?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

// Represents a physical classroom within a branch
export interface Classroom {
  id: string;
  room_name: string;
  description?: string;
  room_capacity: number;
  branch_id: string;
  branch_name?: string;
  active: boolean;
  active_classes_count?: number;
  created_at: string;
  updated_at: string;
}

// Represents a tutoring class with schedule and enrollment information
export interface Class {
  id: string;
  subject: string;
  description?: string;
  level?: string;
  tutor_id?: string;
  tutor_first_name?: string;
  tutor_last_name?: string;
  classroom_id?: string;
  classroom_name?: string;
  start_time: string;
  end_time?: string;
  duration_minutes: number;
  capacity: number;
  branch_id?: string;
  branch_name?: string;
  branch_address?: string;
  created_by?: string;
  active: boolean;
  enrolled_count: number;
  can_edit?: boolean;
  can_delete?: boolean;
  created_at: string;
  updated_at?: string;
}

// Represents a student's enrollment in a specific class
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
  classroom_name?: string;
  tutor_first_name?: string;
  tutor_last_name?: string;
}

// Represents a payment record for a student's monthly fees
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

// Represents a staff member who can be assigned as a tutor
export interface StaffMember {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
  class_count?: number;
  future_class_count?: number;
}

// Request payload for user login
export interface LoginRequest {
  email: string;
  password: string;
}

// Request payload for user registration
export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  password: string;
}

// Response from successful login
export interface LoginResponse {
  token: string;
  user: User;
  message: string;
}

// Response from successful registration
export interface RegisterResponse {
  token: string;
  user: User;
  message: string;
}

// Response from authentication verification
export interface AuthResponse {
  user: User;
}

// Standard API error response structure
export interface ApiError {
  error: string;
  message?: string;
}

// Authentication context type for React context
export interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (registrationData: RegisterRequest) => Promise<void>;
  logout: () => void;
  updateUserProfile?: (user: User) => void;
  loading: boolean;
  isAuthenticated: boolean;
}

// Request payload for creating a new student
export interface CreateStudentRequest {
  firstName: string;
  lastName: string;
  grade: string;
  dateOfBirth?: string;
  homeBranchId?: string;
}

// Request payload for creating a new branch
export interface CreateBranchRequest {
  name: string;
  address: string;
  phone?: string;
}

// Request payload for creating a new classroom
export interface CreateClassroomRequest {
  room_name: string;
  description?: string;
  room_capacity: number;
  branch_id: string;
}

// Request payload for creating a new class
export interface CreateClassRequest {
  subject: string;
  description?: string;
  level: string;
  startTime: string;
  durationMinutes: number;
  capacity: number;
  branchId: string;
  classroomId?: string;
}

// Request payload for creating a new enrollment
export interface CreateEnrollmentRequest {
  studentId: string;
  classId: string;
}

// Request payload for creating a new staff member
export interface CreateStaffRequest {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  password: string;
}

// Request payload for updating user profile information
export interface UserProfileUpdateRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
}

// Request payload for updating student information
export interface UpdateStudentRequest {
  firstName?: string;
  lastName?: string;
  grade?: string;
  dateOfBirth?: string;
  homeBranchId?: string;
}

// Request payload for updating branch information
export interface UpdateBranchRequest {
  name?: string;
  address?: string;
  phone?: string;
  active?: boolean;
}

// Request payload for updating classroom information
export interface UpdateClassroomRequest {
  room_name?: string;
  description?: string;
  room_capacity?: number;
  active?: boolean;
}

// Request payload for updating class information
export interface UpdateClassRequest {
  subject?: string;
  description?: string;
  level?: string;
  startTime?: string;
  durationMinutes?: number;
  capacity?: number;
  branchId?: string;
  classroomId?: string;
}

// Request payload for updating staff member information
export interface UpdateStaffRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
  active?: boolean;
}

// Analysis of impacts when deleting a branch
export interface BranchDeletionImpact {
  branch: {
    name: string;
    address: string;
  };
  impact: {
    studentsAffected: number;
    totalClasses: number;
    futureClasses: number;
    pastClasses: number;
    enrollmentsAffected: number;
    attendanceRecordsLost: number;
    paymentsAffected: number;
    warning?: string;
  };
}

// Analysis of impacts when deleting a classroom
export interface ClassroomDeletionImpact {
  classroom: {
    room_name: string;
    description?: string;
    room_capacity: number;
    branch_name: string;
  };
  impact: {
    totalClasses: number;
    futureClasses: number;
    pastClasses: number;
    enrollmentsAffected: number;
    attendanceRecordsAffected: number;
    warning?: string;
  };
}

// Analysis of impacts when deleting a staff member
export interface StaffDeletionImpact {
  staff: {
    first_name: string;
    last_name: string;
    email: string;
  };
  impact: {
    totalClasses: number;
    futureClasses: number;
    affectedClasses: Array<{
      id: string;
      subject: string;
      start_time: string;
      duration_minutes: number;
      branch_name: string;
      classroom_name?: string;
      enrolled_count: number;
    }>;
    warning?: string;
  };
}

// Represents an attendance record for a student in a class
export interface AttendanceRecord {
  id?: string;
  enrollment_id: string;
  student_id: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  notes?: string;
  marked_at?: string;
  first_name: string;
  last_name: string;
  grade: string;
}

// Request payload for marking attendance
export interface AttendanceMarkRequest {
  enrollmentId: string;
  studentId: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  notes?: string;
}

// Summary statistics for class attendance
export interface AttendanceSummary {
  classInfo: {
    id: string;
    subject: string;
    start_time: string;
  };
  summary: {
    present_count: number;
    absent_count: number;
    late_count: number;
    excused_count: number;
    total_records: number;
    days_recorded: number;
    unique_students: number;
  };
}

// Simplified class information for staff view
export interface StaffClass {
  class_id: string;
  subject: string;
  description?: string;
  level?: string;
  start_time: string;
  duration_minutes: number;
  branch_name: string;
  branch_address: string;
  enrolled_count: number;
}

// Student information with parent details for class management
export interface ClassStudent {
  enrollment_id: string;
  student_id: string;
  enrolled_at: string;
  first_name: string;
  last_name: string;
  grade: string;
  parent_first_name: string;
  parent_last_name: string;
  parent_email: string;
}

// Class that does not have an assigned tutor
export interface UnassignedClass {
  id: string;
  subject: string;
  description?: string;
  level?: string;
  start_time: string;
  duration_minutes: number;
  capacity: number;
  branch_name: string;
  branch_address: string;
  classroom_name?: string;
  enrolled_count: number;
}

// Classroom availability with occupied time slots
export interface ClassroomAvailability {
  classroom: {
    room_name: string;
    room_capacity: number;
    branch_id: string;
  };
  occupied_slots: Array<{
    id: string;
    subject: string;
    level?: string;
    start_time: string;
    end_time: string;
    capacity: number;
    tutor_name?: string;
  }>;
}

// Request payload for assigning a tutor to a class
export interface AssignTutorRequest {
  tutorId: string;
}

// Overview statistics for user types
export interface UserOverview {
  role: 'parent' | 'staff' | 'admin';
  total_count: number;
  active_count: number;
}