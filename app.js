const express = require('express');
const app = express();
const mysql = require('mysql2');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');

// Set up EJS
app.set('view engine', 'ejs');

// Set up middleware
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Session setup
app.use(session({
  secret: 'brichas_secret_key',
  resave: false,
  saveUninitialized: true
}));

// Database connection
const db = mysql.createConnection({
  host: 'sql212.byetcluster.com',
  user: 'if0_37319705',
  password: 'TBjptHBN4Vkn',
  database: 'if0_37319705_ajira',
  connectTimeout: 20000 // Set timeout to 20 seconds
});


db.connect((err) => {
  if (err) throw err;
  console.log('Connected to database');
});

// Set up storage engine for multer
const storage = multer.diskStorage({
  destination: './public/uploads/',
  filename: function(req, file, cb){
    cb(null, file.fieldname + '_' + Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Routes
// GET - Home page (Sign In)
app.get('/', (req, res) => {
  res.render('login', { message: '' });
});

// POST - Sign In
app.post('/login', (req, res) => {
  const username = req.body.fullname;
  const password = req.body.password;

  if (username === 'ADMIN' && password === '12345') {
    // Admin login
    req.session.admin = true;
    res.redirect('/admin/dashboard');
  } else {
    // Customer login
    const sql = 'SELECT * FROM customers WHERE fullname = ?';
    db.query(sql, [username], (err, results) => {
      if (err) throw err;
      if (results.length > 0) {
        const user = results[0];
        if (bcrypt.compareSync(password, user.password)) {
          req.session.customerId = user.id;
          res.redirect('/application');
        } else {
          res.render('login', { message: 'Incorrect username or password' });
        }
      } else {
        res.render('login', { message: 'Incorrect username or password' });
      }
    });
  }
});

// GET - Sign Up page
app.get('/signup', (req, res) => {
  res.render('signup', { message: '' });
});

// POST - Sign Up
app.post('/signup', (req, res) => {
  const { fullname, email, phone, password } = req.body;
  const hashedPassword = bcrypt.hashSync(password, 10);
  const sql = 'INSERT INTO customers (fullname, email, phone, password) VALUES (?, ?, ?, ?)';
  db.query(sql, [fullname, email, phone, hashedPassword], (err, result) => {
    if (err) throw err;
    res.render('login', { message: 'Account created successfully. Please log in.' });
  });
});

// GET - Application form
app.get('/application', (req, res) => {
  if (req.session.customerId) {
    res.render('application', { message: '' });
  } else {
    res.redirect('/customer-dashboard');
  }
});

// POST - Submit application form
app.post('/application', upload.fields([{ name: 'certificate', maxCount: 1 }, { name: 'cv', maxCount: 1 }]), (req, res) => {
  const customerId = req.session.customerId;
  const { fullname, age, gender, address, education_level, first_job_type, second_job_type } = req.body;
  const certificate = req.files['certificate'] ? req.files['certificate'][0].filename : null;
  const cv = req.files['cv'] ? req.files['cv'][0].filename : null;

  const sql = 'INSERT INTO applications (customer_id, fullname, age, gender, address, education_level, certificate, cv, first_job_type, second_job_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
  db.query(sql, [customerId, fullname, age, gender, address, education_level, certificate, cv, first_job_type, second_job_type], (err, result) => {
    if (err) throw err;
    res.render('application', { message: 'Application submitted successfully!' });
    res.redirect('/customer-dashboard');
  });
});

// Admin Routes
// GET - Admin Dashboard
app.get('/admin/dashboard', (req, res) => {
  if (req.session.admin) {
    const sql = 'SELECT * FROM applications';
    db.query(sql, (err, results) => {
      if (err) throw err;
      res.render('admin_dashboard', { applications: results });
    });
  } else {
    res.redirect('/');
  }
});

// GET - Admin Edit Application
app.get('/admin/edit/:id', (req, res) => {
  if (req.session.admin) {
    const id = req.params.id;
    const sql = 'SELECT * FROM applications WHERE id = ?';
    db.query(sql, [id], (err, result) => {
      if (err) throw err;
      res.render('admin_edit', { application: result[0] });
    });
  } else {
    res.redirect('/');
  }
});

// POST - Admin Update Application
app.post('/admin/update/:id', upload.fields([{ name: 'certificate', maxCount: 1 }, { name: 'cv', maxCount: 1 }]), (req, res) => {
  if (req.session.admin) {
    const id = req.params.id;
    const { fullname, age, gender, address, education_level, first_job_type, second_job_type } = req.body;
    const certificate = req.files['certificate'] ? req.files['certificate'][0].filename : req.body.old_certificate;
    const cv = req.files['cv'] ? req.files['cv'][0].filename : req.body.old_cv;

    const sql = 'UPDATE applications SET fullname = ?, age = ?, gender = ?, address = ?, education_level = ?, certificate = ?, cv = ?, first_job_type = ?, second_job_type = ? WHERE id = ?';
    db.query(sql, [fullname, age, gender, address, education_level, certificate, cv, first_job_type, second_job_type, id], (err, result) => {
      if (err) throw err;
      res.redirect('/admin/dashboard');
    });
  } else {
    res.redirect('/');
  }
});

// GET - Admin Delete Application
app.get('/admin/delete/:id', (req, res) => {
  if (req.session.admin) {
    const id = req.params.id;
    const sql = 'DELETE FROM applications WHERE id = ?';
    db.query(sql, [id], (err, result) => {
      if (err) throw err;
      res.redirect('/admin/dashboard');
    });
  } else {
    res.redirect('/');
  }
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});
app.use(express.static('public'));

// Customer Dashboard route
app.get('/customer-dashboard', (req, res) => {
  if (req.session.user) {
      res.render('customer-dashboard', { user: req.session.user });
  } else {
      res.redirect('/login');
  }
});
app.get('/about', (req, res) => {
  res.render('about');
});

app.get('/support', (req, res) => {
  res.render('support');
});

app.get('/profile', (req, res) => {
  if (req.session.user) {
      res.render('profile', { user: req.session.user });
  } else {
      res.redirect('/login');
  }
});


// Start the server
app.listen(7100, () => {
  console.log('Server started on port 7100');
});
