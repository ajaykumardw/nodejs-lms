# LMS Node.js API

Backend API for the Learning Management System (LMS), built with **Node.js**, **Express.js**, and **MySQL**. This service provides REST APIs for authentication, user management, courses, assignments, quizzes, notifications, and other LMS features.

---

## Features

- User Authentication & Authorization
- JWT Token Authentication
- Role-based Access Control (Admin, Instructor, Student)
- Course Management
- Lesson Management
- Assignment Management
- Quiz & Exam Management
- Student Enrollment
- Attendance Management
- Notifications
- File Upload Support
- RESTful APIs
- Input Validation
- Error Handling
- Logging
- MySQL Database Integration

---

## Tech Stack

- Node.js
- Express.js
- MySQL
- JWT Authentication
- bcrypt
- Multer
- dotenv
- CORS
- Express Validator
- Nodemon

---

## Project Structure

```
lms-nodejs/
│
├── config/
│   ├── database.js
│   └── jwt.js
│
├── controllers/
│
├── middleware/
│   ├── auth.js
│   ├── validation.js
│   └── upload.js
│
├── models/
│
├── routes/
│
├── services/
│
├── utils/
│
├── uploads/
│
├── logs/
│
├── app.js
├── server.js
├── package.json
└── .env
```

---

## Requirements

- Node.js >= 20.x
- npm >= 10.x
- MySQL >= 8.0

---

## Installation

Clone the repository:

```bash
git clone <repository-url>
```

Navigate to the project:

```bash
cd lms-nodejs
```

Install dependencies:

```bash
npm install
```

---

## Environment Variables

Create a `.env` file in the project root.

```env
PORT=3000

DB_HOST=localhost
DB_PORT=3306
DB_NAME=lms
DB_USER=root
DB_PASSWORD=password

JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d

CORS_ORIGIN=http://localhost:3000

UPLOAD_PATH=uploads
```

---

## Running the Project

### Development

```bash
npm run dev
```

### Production

```bash
npm start
```

The server will start at:

```
http://localhost:3000
```

---

## Available Scripts

| Command      | Description                |
| ------------ | -------------------------- |
| npm install  | Install dependencies       |
| npm run dev  | Run development server     |
| npm start    | Start production server    |
| npm run lint | Run ESLint (if configured) |

---

## API Modules

- Authentication
- Users
- Students
- Instructors
- Courses
- Lessons
- Enrollments
- Assignments
- Quizzes
- Attendance
- Notifications
- File Uploads

---

## Authentication

The API uses **JWT (JSON Web Token)** authentication.

Include the token in request headers:

```
Authorization: Bearer <your_token>
```

---

## Sample API Endpoints

### Authentication

```
POST   /api/auth/login
POST   /api/auth/register
POST   /api/auth/logout
GET    /api/auth/profile
```

### Courses

```
GET    /api/courses
POST   /api/courses
PUT    /api/courses/:id
DELETE /api/courses/:id
```

### Students

```
GET    /api/students
POST   /api/students
GET    /api/students/:id
PUT    /api/students/:id
DELETE /api/students/:id
```

### Assignments

```
GET    /api/assignments
POST   /api/assignments
```

---

## Database

Update your database configuration in the `.env` file.

Example:

```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=lms
DB_USER=root
DB_PASSWORD=password
```

---

## Error Handling

The API returns standard HTTP status codes.

Example:

```json
{
  "success": false,
  "message": "Unauthorized access"
}
```

---

## Security

- JWT Authentication
- Password Hashing (bcrypt)
- Input Validation
- CORS Protection
- Environment Variables
- SQL Injection Prevention
- Centralized Error Handling

---

## Deployment

Build and run the application:

```bash
npm install
npm start
```

Deploy on:

- AWS EC2
- DigitalOcean
- Azure
- Render
- Railway
- VPS with PM2
- Docker

Example with PM2:

```bash
pm install -g pm2
pm2 start server.js --name lms-api
pm2 save
```

---

## Logging

Application logs can be stored in the `logs/` directory or integrated with logging libraries such as Winston or Morgan.

---

## Contributing

1. Create a new branch.
2. Commit your changes.
3. Push the branch.
4. Create a Pull Request.

---

## License

This project is proprietary and intended for internal use unless otherwise specified.

---

## Author

Developed by the LMS Development Team.
