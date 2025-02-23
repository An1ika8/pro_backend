const express = require('express');
const mysql = require('mysql');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt'); 
const jwt = require('jsonwebtoken');

const app = express();
const port = 5000;

app.use(express.static(path.join(__dirname, "public")));
app.use(cors());
app.use(express.json());

const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "projects"
});

db.connect((err) => {
    if (err) {
        console.error('Error connecting to the database:', err);
        return;
    }
    console.log('Connected to the database');
});

app.post('/api/v1/register', (req, res) => {
    const { username, email, password } = req.body;
    bcrypt.hash(password, 10, (err, hashedPassword) => {
      if (err) return res.status(500).send({ error: 'Error hashing password' });
  
      const query = 'INSERT INTO users (username, email, password) VALUES (?, ?, ?)';
      db.query(query, [username, email, hashedPassword], (err, result) => {
        if (err) return res.status(500).send({ error: 'Error creating user' });
        res.status(201).send({ message: 'User registered' });
      });
    });
});

app.post('/api/v1/login', (req, res) => {
    const { username, password } = req.body;
    const query = 'SELECT * FROM users WHERE username = ?';
    db.query(query, [username], (err, rows) => {
      if (err || rows.length === 0) return res.status(404).send({ error: 'User not found' });
  
      const user = rows[0];
      bcrypt.compare(password, user.password, (err, match) => {
        if (err || !match) return res.status(401).send({ error: 'Invalid credentials' });
  
        const token = jwt.sign({ userId: user.id, username: user.username }, process.env.JWT_SECRET_KEY);
        res.status(200).send({ token });
      });
    });
});

app.post('/add_project', (req, res) => {
    const sql = "INSERT INTO project_details (projects_name, intro, owner, status, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?)";
    const values = [
        req.body.project_name,
        req.body.intro,
        req.body.owner,
        req.body.status,
        req.body.start_time,
        req.body.end_time
    ];

    db.query(sql, values, (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            return res.status(500).send(err);
        }
        res.status(200).send('Project added successfully');
    });
});

app.get("/projects", (req, res) => {
    const sql = "SELECT * FROM project_details";
    db.query(sql, (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            return res.status(500).json({"message" : "Server error"});
        }
        res.status(200).json(result);
    });
});

app.get("/get_projects/:projects_name", (req, res) => {
    const sql = "SELECT * FROM project_details WHERE projects_name = ?";
    const values = [req.params.projects_name];
    db.query(sql, values, (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            return res.status(500).json({"message" : "Server error"});
        }
        res.status(200).json(result);
    });
});

app.put("/edit_user/:projects_name", (req, res) => {
    const sql = "UPDATE project_details SET projects_name=?, intro=?, owner=?, status=?, start_time=?, end_time=? WHERE projects_name=?";
    const values = [
        req.body.projects_name,
        req.body.intro,
        req.body.owner,
        req.body.status,
        req.body.start_time,
        req.body.end_time,
        req.params.projects_name
    ];
    db.query(sql, values, (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            return res.status(500).json({"message" : "Server error"});
        }
        res.status(200).json(result);
    });
});

app.delete("/delete/:projects_name", (req, res) => {
    const projects_name = req.params.projects_name;
    const sql = "DELETE FROM project_details WHERE projects_name=?";
    const values = [projects_name];
    db.query(sql, values, (err, result) => {
      if (err)
        return res.json({ message: "Something unexpected has occured" + err });
      return res.json({ success: "Project deleted successfully" });
    });
});

app.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
});