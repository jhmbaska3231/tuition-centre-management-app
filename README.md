# Tuition Centre Management System

A full-stack web application for managing tuition centres, this system enables efficient management of students, classes, enrollments, attendance tracking, and payment records across multiple branches.

## Features

### For Parents
- **Student Management**: Add and manage children's profiles with grades and branch preferences
- **Class Operations**: Browse available classes, enroll students, and manage enrollments
- **Payment History**: Track payment records and outstanding fees
- **Profile Management**: Update personal information and account settings

### For Staff/Teachers
- **Class Management**: Create, edit, and manage assigned classes
- **Attendance Tracking**: Mark attendance for students with detailed status options
- **Student Overview**: View enrolled students and their information

### For Administrators
- **Staff Management**: Create, edit, and manage staff accounts
- **Class Assignment**: Assign tutors to unassigned classes
- **System Overview**: Monitor user activities and system usage

## Tech Stack

**Frontend:**
- React 19 with TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- Lucide React for icons

**Backend:**
- Node.js with Express
- TypeScript
- PostgreSQL database
- JWT authentication
- bcrypt for password hashing

## Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- npm package manager

## Installation & Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/jhmbaska3231/tuition-centre-management-app.git
   cd tuition-centre-management
   ```

2. **Install dependencies**
   ```bash
   # Install backend dependencies
   cd backend
   npm install
   
   # Install frontend dependencies
   cd ../frontend
   npm install
   ```

3. **Database Setup**
   - Create a PostgreSQL database
   - Update the database configuration in `backend/.env`
   - The application automatically creates the database schema and seeds initial data upon each run

4. **Start the application**
   ```bash
   # Start backend server (from backend directory)
   npm run dev
   
   # Start frontend development server (from frontend directory)
   npm run dev
   ```
