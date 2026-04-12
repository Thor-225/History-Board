// Load the sqlite3 library and enable verbose mode for better debugging.
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Define the path for the SQLite database file stored next to the application code.
const dbPath = path.join(__dirname, 'database.db');

// Open a connection to the SQLite database. The file is created if it does not exist.
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database.');
  }
});

// Enable foreign key support inside SQLite so related records are deleted correctly.
db.run('PRAGMA foreign_keys = ON');

// Create the database tables if they do not already exist.
// This ensures the app can start with a fresh database and still have the correct schema.
db.serialize(() => {
  // Users table stores login credentials and account creation timestamps.
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Posts table stores history boards created by users.
  // Each post references the user who created it.
  db.run(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  // Comments table stores user comments for each post.
  // Both the post and the comment author are enforced with foreign keys.
  db.run(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);
});

module.exports = db;