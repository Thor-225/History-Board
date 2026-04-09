const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const db = require('./database');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(session({
  secret: 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // Set to true if using HTTPS
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 // 24 hours
  }
}));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware to check if user is logged in
const checkAuth = (req, res, next) => {
  if (req.session.userId) {
    next();
  } else {
    res.redirect('/login');
  }
};

// Middleware to pass user info to views
app.use((req, res, next) => {
  res.locals.user = req.session.userId;
  res.locals.username = req.session.username;
  next();
});

// Routes

// Home page
app.get('/', (req, res) => {
  if (req.session.userId) {
    // Get all posts with author info
    db.all(`
      SELECT posts.*, users.username 
      FROM posts 
      JOIN users ON posts.user_id = users.id 
      ORDER BY posts.created_at DESC
    `, (err, posts) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Database error');
      }
      res.render('index', { posts: posts });
    });
  } else {
    res.redirect('/login');
  }
});

// Signup page
app.get('/signup', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/');
  }
  res.render('signup');
});

// Signup POST
app.post('/signup', (req, res) => {
  const { username, password, confirmPassword } = req.body;

  // Validation
  if (!username || !password || !confirmPassword) {
    return res.render('signup', { error: 'All fields are required' });
  }

  if (password !== confirmPassword) {
    return res.render('signup', { error: 'Passwords do not match' });
  }

  if (password.length < 6) {
    return res.render('signup', { error: 'Password must be at least 6 characters' });
  }

  // Hash password
  bcrypt.hash(password, 10, (err, hash) => {
    if (err) {
      return res.render('signup', { error: 'Error processing password' });
    }

    // Insert user
    db.run(
      'INSERT INTO users (username, password) VALUES (?, ?)',
      [username, hash],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.render('signup', { error: 'Username already exists' });
          }
          return res.render('signup', { error: 'Error creating account' });
        }

        req.session.userId = this.lastID;
        req.session.username = username;
        res.redirect('/');
      }
    );
  });
});

// Login page
app.get('/login', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/');
  }
  res.render('login');
});

// Login POST
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.render('login', { error: 'Username and password are required' });
  }

  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) {
      return res.render('login', { error: 'Database error' });
    }

    if (!user) {
      return res.render('login', { error: 'Invalid username or password' });
    }

    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (err) {
        return res.render('login', { error: 'Authentication error' });
      }

      if (!isMatch) {
        return res.render('login', { error: 'Invalid username or password' });
      }

      req.session.userId = user.id;
      req.session.username = user.username;
      res.redirect('/');
    });
  });
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.send('Error logging out');
    }
    res.redirect('/login');
  });
});

// Create post page
app.get('/create-post', checkAuth, (req, res) => {
  res.render('create-post');
});

// Create post POST
app.post('/create-post', checkAuth, (req, res) => {
  const { title, content } = req.body;

  if (!title || !content) {
    return res.render('create-post', { error: 'Title and content are required' });
  }

  db.run(
    'INSERT INTO posts (user_id, title, content) VALUES (?, ?, ?)',
    [req.session.userId, title, content],
    function(err) {
      if (err) {
        console.error(err);
        return res.render('create-post', { error: 'Error creating post' });
      }
      res.redirect('/');
    }
  );
});

// View single post
app.get('/post/:id', (req, res) => {
  const postId = req.params.id;

  db.get(`
    SELECT posts.*, users.username 
    FROM posts 
    JOIN users ON posts.user_id = users.id 
    WHERE posts.id = ?
  `, [postId], (err, post) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Database error');
    }

    if (!post) {
      return res.status(404).send('Post not found');
    }

    res.render('view-post', { post: post });
  });
});

// Delete post
app.post('/delete-post/:id', checkAuth, (req, res) => {
  const postId = req.params.id;

  db.get('SELECT user_id FROM posts WHERE id = ?', [postId], (err, post) => {
    if (err || !post) {
      return res.status(404).send('Post not found');
    }

    if (post.user_id !== req.session.userId) {
      return res.status(403).send('Unauthorized');
    }

    db.run('DELETE FROM posts WHERE id = ?', [postId], function(err) {
      if (err) {
        return res.status(500).send('Error deleting post');
      }
      res.redirect('/');
    });
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('404');
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
