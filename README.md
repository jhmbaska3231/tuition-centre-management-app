# Tuition Centre Management System

A full-stack web application for managing tuition centres, this system enables efficient management of students, classes, enrollments, attendance tracking, and payment records across multiple branches

## Features

### For parents
- **student management**: add and manage children's profiles with grades and branch preferences
- **class operations**: browse available classes, enroll students, and manage enrollments
- **payment history**: track payment records and outstanding fees
- **profile management**: update personal information and account settings

### For staff/teachers
- **class management**: create, edit, and manage assigned classes with capacity and time conflict detection
- **attendance tracking**: mark attendance for students with detailed status options
- **student overview**: view enrolled students and their information

### For administrators
- **staff management**: create, edit, and manage staff accounts
- **branch & classroom management**: manage multiple branches and their classroom allocations
- **class assignment**: assign tutors to unassigned classes with automatic conflict resolution
- **system overview**: monitor user activities and system usage

## Tech stack

**frontend:**
- React 19 with TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- Lucide React for icons

**backend:**
- Node.js with Express
- TypeScript
- PostgreSQL database
- JWT authentication
- bcrypt for password hashing
- express-rate-limit for API protection
- Helmet for security headers
- isomorphic-dompurify for input sanitization
- CORS configuration for cross-origin requests

---

## Installation & setup

### 1. Install git

```bash
sudo apt update
sudo apt install git
git --version  # verify
```

### 2. Install node.js and npm

```bash
sudo apt update
sudo apt install nodejs npm
node -v  # verify
npm -v  # verify
```

### 3. Install postgresql

```bash
sudo apt update
sudo apt install postgresql
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 4. Clone the repository

```bash
git clone git@github.com:jhmbaska3231/tuition-centre-management-app.git
cd tuition-centre-management-app
```

### 5. Set up the database

```bash
sudo -u postgres psql
```

run the following in psql:

```sql
create user youruser with password 'yourpassword';
create database yourdbname owner youruser;
grant all privileges on database yourdbname to youruser;
\q
```

### 6. Configure environment variables

```bash
cp backend/.env.example backend/.env
vim backend/.env
```

fill in your env values:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=youruser
DB_PASSWORD=yourpassword
DB_NAME=yourdbname

JWT_SECRET=yourkey  # node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

PORT=8080
NODE_ENV=development

FRONTEND_URL=http://localhost:5173
```

### 7. Install dependencies

```bash
cd backend
npm install

cd ../frontend
npm install
```

### 8. Start the application

```bash
# terminal 1
cd backend
npm run dev
```

```bash
# terminal 2
cd frontend
npm run dev
```

> note: backend auto creates all database tables and seeds initial data upon each run (only in dev env)

---

## Default test accounts

test account password is password123

| role  | email                   |
|-------|-------------------------|
| admin | admin@tuition.com       |
| staff | hui.siew@tuition.com    |
| staff | zen.teo@tuition.com     |
| staff | mary.wong@tuition.com   |
| parent| jaytoh@gmail.com        |
| parent| alice.lim@gmail.com     |

> note: these only created in dev env