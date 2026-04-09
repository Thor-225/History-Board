# EJS Blog Application

A simple blog application built with Node.js, Express, EJS, and SQLite.

## Features

- **User Authentication**
  - Sign up with username and password
  - Secure login with bcrypt password hashing
  - Session management
  - Logout functionality

- **Post Management**
  - Create new blog posts
  - View all posts
  - View individual post details
  - Delete your own posts
  - Posts display author name and creation date

- **Database**
  - SQLite database with users and posts tables
  - Secure password storage with bcryptjs
  - Foreign key relationships

## Installation

1. **Clone or download the project**

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the server**
   ```bash
   npm start
   ```
   
   For development with auto-reload:
   ```bash
   npm run dev
   ```

4. **Open in browser**
   Navigate to `http://localhost:3000`

## Usage

1. **Sign Up**: Create a new account with username and password
2. **Login**: Log in with your credentials
3. **Create Posts**: Click "+ New Post" to create a new blog post
4. **View Posts**: Browse all posts on the home page
5. **Delete Posts**: Delete only your own posts
6. **Logout**: Sign out from your account

## Project Structure

```
.
├── app.js                 # Main application file
├── database.js            # Database initialization and setup
├── package.json           # Dependencies and scripts
├── views/                 # EJS templates
│   ├── layout.ejs        # Main layout (used as reference)
│   ├── index.ejs         # Home page
│   ├── login.ejs         # Login page
│   ├── signup.ejs        # Sign up page
│   ├── create-post.ejs   # Create post page
│   ├── view-post.ejs     # Single post view
│   └── 404.ejs           # Error page
└── public/               # Static assets
```

## Technology Stack

- **Runtime**: Node.js
- **Web Framework**: Express.js
- **Template Engine**: EJS
- **Database**: SQLite3
- **Authentication**: bcryptjs, express-session
- **Password Parsing**: body-parser

## Security Notes

⚠️ **Important**: This is a basic application for learning purposes. For production:

1. Change the session secret in `app.js` to a strong, random string
2. Set `cookie.secure` to `true` if using HTTPS
3. Add input validation and sanitization
4. Implement CSRF protection
5. Add rate limiting
6. Use environment variables for configuration
7. Add proper error logging

## Default Port

The application runs on `http://localhost:3000` by default.

## License

MIT
