// Import required libraries for web server, session handling, password hashing, database access, and file paths.
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const db = require('./database');
const path = require('path');

// Create the Express application and set the port number for the server.
const app = express();
const PORT = 3000;

// Middleware configuration
// - bodyParser parses data submitted from forms as well as JSON payloads.
// - express.static serves static assets like CSS and client-side JavaScript.
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration for user login state.
// The session is stored using a cookie, and it is not re-saved unless modified.
// In production, the secret should be moved to environment variables.
app.use(session({
  secret: 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // Set this to true when serving over HTTPS.
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 // Session lasts for 24 hours.
  }
}));

// Configure EJS as the view engine and set the folder for template files.
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware to verify that a user is logged in before allowing access to protected routes.
const checkAuth = (req, res, next) => {
  if (req.session.userId) {
    next();
  } else {
    // If the user is not authenticated, redirect them to the login page.
    res.redirect('/login');
  }
};

// Middleware to make the current user available inside all views.
// This allows EJS templates to show the username and conditionally display content.
app.use((req, res, next) => {
  res.locals.user = req.session.userId;
  res.locals.username = req.session.username;
  next();
});

// Routes

// Home page route: display all history boards to a logged-in user.
// If the user is not logged in, they are redirected to the login page.
app.get('/', (req, res) => {
  if (req.session.userId) {
    // Query the database for all posts and their author username.
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
      // Render the index page with the retrieved posts list.
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

// Signup POST route: register a new user account.
app.post('/signup', (req, res) => {
  const { username, password, confirmPassword } = req.body;

  // Validate that all fields are present.
  if (!username || !password || !confirmPassword) {
    return res.render('signup', { error: 'All fields are required' });
  }

  // Check that password and confirmation match.
  if (password !== confirmPassword) {
    return res.render('signup', { error: 'Passwords do not match' });
  }

  // Enforce a minimum password length for basic security.
  if (password.length < 6) {
    return res.render('signup', { error: 'Password must be at least 6 characters' });
  }

  // Hash the password before saving it to the database.
  bcrypt.hash(password, 10, (err, hash) => {
    if (err) {
      return res.render('signup', { error: 'Error processing password' });
    }

    // Insert the new user into the users table.
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

        // Save the new user's ID and username in the session,
        // then redirect to the home page.
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

// Login POST route: authenticate a user by username and password.
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  // Ensure both username and password are provided.
  if (!username || !password) {
    return res.render('login', { error: 'Username and password are required' });
  }

  // Retrieve the user from the database using the supplied username.
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) {
      return res.render('login', { error: 'Database error' });
    }

    if (!user) {
      return res.render('login', { error: 'Invalid username or password' });
    }

    // Compare the supplied password with the stored hashed password.
    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (err) {
        return res.render('login', { error: 'Authentication error' });
      }

      if (!isMatch) {
        return res.render('login', { error: 'Invalid username or password' });
      }

      // Save user data in the session and redirect to the home page.
      req.session.userId = user.id;
      req.session.username = user.username;
      res.redirect('/');
    });
  });
});

// Logout route: clear the user's session and redirect them to the login page.
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.send('Error logging out');
    }
    res.redirect('/login');
  });
});

// Create post page: show the form for a logged-in user to create a new history board.
app.get('/create-post', checkAuth, (req, res) => {
  res.render('create-post');
});

// Create post POST route: save a new history board to the database.
app.post('/create-post', checkAuth, (req, res) => {
  const { title, content } = req.body;

  // Ensure both title and content are provided.
  if (!title || !content) {
    return res.render('create-post', { error: 'Title and content are required' });
  }

  // Insert the new post into the posts table.
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

// View single post route: show a single history board and its associated comments.
app.get('/post/:id', (req, res) => {
  const postId = req.params.id;

  // Load the selected post and include the author's username.
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

    // Load all comments for the post and include each comment author's username.
    db.all(`
      SELECT comments.*, users.username 
      FROM comments 
      JOIN users ON comments.user_id = users.id 
      WHERE comments.post_id = ? 
      ORDER BY comments.created_at ASC
    `, [postId], (err, comments) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Database error');
      }

      // Render the view page with both the post and its comments.
      res.render('view-post', { post: post, comments: comments || [] });
    });
  });
});

// Delete post route: allow the owner of a history board to delete it.
app.post('/delete-post/:id', checkAuth, (req, res) => {
  const postId = req.params.id;

  // Verify the post exists and that the user owns it.
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

// Add comment route: save a new comment for the specified post.
app.post('/add-comment/:postId', checkAuth, (req, res) => {
  const postId = req.params.postId;
  const { content } = req.body;

  // Prevent empty comment submissions.
  if (!content || !content.trim()) {
    return res.redirect(`/post/${postId}`);
  }

  // Confirm the post exists before saving the comment.
  db.get('SELECT id FROM posts WHERE id = ?', [postId], (err, post) => {
    if (err || !post) {
      return res.status(404).send('Post not found');
    }

    // Insert the comment into the comments table.
    db.run(
      'INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)',
      [postId, req.session.userId, content.trim()],
      function(err) {
        if (err) {
          console.error(err);
          return res.status(500).send('Error adding comment');
        }
        res.redirect(`/post/${postId}`);
      }
    );
  });
});

// Edit post page: display the edit form for the post owner.
app.get('/edit-post/:id', checkAuth, (req, res) => {
  const postId = req.params.id;

  // Retrieve the post so the form can be pre-filled with current values.
  db.get('SELECT * FROM posts WHERE id = ?', [postId], (err, post) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Database error');
    }

    if (!post) {
      return res.status(404).send('Post not found');
    }

    // Only the original author may edit the post.
    if (post.user_id !== req.session.userId) {
      return res.status(403).send('Unauthorized');
    }

    res.render('edit-post', { post: post });
  });
});

// Edit post POST route: update the title and content of an existing history board.
app.post('/edit-post/:id', checkAuth, (req, res) => {
  const postId = req.params.id;
  const { title, content } = req.body;

  // Ensure the updated title and content are not empty.
  if (!title || !content) {
    return res.render('edit-post', { post: { id: postId, title, content }, error: 'Title and content are required' });
  }

  // Verify ownership before updating the post.
  db.get('SELECT user_id FROM posts WHERE id = ?', [postId], (err, post) => {
    if (err || !post) {
      return res.status(404).send('Post not found');
    }

    if (post.user_id !== req.session.userId) {
      return res.status(403).send('Unauthorized');
    }

    // Save the updated title and content to the database.
    db.run(
      'UPDATE posts SET title = ?, content = ? WHERE id = ?',
      [title, content, postId],
      function(err) {
        if (err) {
          console.error(err);
          return res.render('edit-post', { post: { id: postId, title, content }, error: 'Error updating post' });
        }
        res.redirect(`/post/${postId}`);
      }
    );
  });
});

// Edit comment page: display the edit form for a comment owner.
app.get('/edit-comment/:id', checkAuth, (req, res) => {
  const commentId = req.params.id;

  // Load the comment and the associated post details.
  db.get(`
    SELECT comments.*, posts.id as post_id, posts.title as post_title
    FROM comments 
    JOIN posts ON comments.post_id = posts.id
    WHERE comments.id = ?
  `, [commentId], (err, comment) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Database error');
    }

    if (!comment) {
      return res.status(404).send('Comment not found');
    }

    if (comment.user_id !== req.session.userId) {
      return res.status(403).send('Unauthorized');
    }

    res.render('edit-comment', { comment: comment });
  });
});

// Edit comment POST route: save updates to an existing comment.
app.post('/edit-comment/:id', checkAuth, (req, res) => {
  const commentId = req.params.id;
  const { content } = req.body;

  // Prevent the user from saving an empty comment.
  if (!content || !content.trim()) {
    return res.redirect(`/edit-comment/${commentId}`);
  }

  // Verify that the comment exists and the current user owns it.
  db.get('SELECT user_id, post_id FROM comments WHERE id = ?', [commentId], (err, comment) => {
    if (err || !comment) {
      return res.status(404).send('Comment not found');
    }

    if (comment.user_id !== req.session.userId) {
      return res.status(403).send('Unauthorized');
    }

    // Update the comment content in the database.
    db.run(
      'UPDATE comments SET content = ? WHERE id = ?',
      [content.trim(), commentId],
      function(err) {
        if (err) {
          console.error(err);
          return res.status(500).send('Error updating comment');
        }
        res.redirect(`/post/${comment.post_id}`);
      }
    );
  });
});

// Delete comment route: remove a comment if the current user is its owner.
app.post('/delete-comment/:id', checkAuth, (req, res) => {
  const commentId = req.params.id;

  // Load the comment to verify ownership and know which post to return to.
  db.get('SELECT user_id, post_id FROM comments WHERE id = ?', [commentId], (err, comment) => {
    if (err || !comment) {
      return res.status(404).send('Comment not found');
    }

    if (comment.user_id !== req.session.userId) {
      return res.status(403).send('Unauthorized');
    }

    // Delete the comment from the database.
    db.run('DELETE FROM comments WHERE id = ?', [commentId], function(err) {
      if (err) {
        return res.status(500).send('Error deleting comment');
      }
      res.redirect(`/post/${comment.post_id}`);
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
