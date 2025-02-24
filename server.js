const express = require('express');
const mysql = require('mysql');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt'); 
const jwt = require('jsonwebtoken');
const PDFDocument = require('pdfkit');


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
        
  
        const token = jwt.sign({ userId: user.id, username: user.username }, 'tdghutdfgtwegbhhder', { expiresIn: '1h' });
        
        
        res.status(200).send({ token });
      });
    });
});



app.post('/add_project', (req, res) => {
    const token = req.headers.authorization; 

    if (!token) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    try {
        const decoded = jwt.verify(token.split(" ")[1], 'tdghutdfgtwegbhhder'); 
        const owner = decoded.username; 

        const { project_name, intro, status, start_time, end_time } = req.body;
        
        const sql = "INSERT INTO project_details (projects_name, intro, owner, status, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?)";
        const values = [project_name, intro, owner, status, start_time, end_time];

        db.query(sql, values, (err, result) => {
            if (err) {
                console.error('Error executing query:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            res.status(200).json({ message: 'Project added successfully' });
        });
    } catch (error) {
        return res.status(403).json({ error: 'Unauthorized: Invalid token' });
    }
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
    const token = req.headers.authorization; 

    if (!token) {
        console.error("No token provided.");
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    try {
        
        const decoded = jwt.verify(token.split(" ")[1], 'tdghutdfgtwegbhhder');
        const loggedInUser = decoded.username; 

        console.log("✅ Logged-in user:", loggedInUser);

        const { projects_name, intro, owner, status, start_time, end_time } = req.body;

        const verifySql = "SELECT owner FROM project_details WHERE projects_name = ?";
        db.query(verifySql, [req.params.projects_name], (err, result) => {
            if (err) {
                console.error("Database error:", err);
                return res.status(500).json({ error: 'Database error' });
            }
            if (result.length === 0) {
                console.error("Project not found.");
                return res.status(404).json({ error: 'Project not found' });
            }

            const projectOwner = result[0].owner;
            console.log("Project Owner:", projectOwner);

            if (projectOwner !== loggedInUser) { 
                console.error("Unauthorized attempt to edit project.");
                return res.status(403).json({ error: 'You can only edit your own projects' });
            }

            
            const updateSql = "UPDATE project_details SET projects_name = ?, intro = ?, owner = ?, status = ?, start_time = ?, end_time = ? WHERE projects_name = ?";
            const values = [projects_name, intro, owner, status, start_time, end_time, req.params.projects_name];
            db.query(updateSql, values, (err, result) => {
                if (err) {
                    console.error("Error updating project:", err);
                    return res.status(500).json({ error: "Server error while updating" });
                }
                console.log("✅ Project updated successfully!");
                return res.status(200).json({ success: "Project updated successfully" });
            });
        });
    } catch (error) {
        console.error("Token error:", error);
        return res.status(403).json({ error: 'Unauthorized: Invalid token' });
    }
});




app.delete("/delete/:projects_name", (req, res) => {
    const token = req.headers.authorization; 

    if (!token) {
        console.error("No token provided.");
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    try {
        
        const decoded = jwt.verify(token.split(" ")[1], 'tdghutdfgtwegbhhder');
        const loggedInUser = decoded.username; 

        console.log("✅ Logged-in user:", loggedInUser); 

        
        const verifySql = "SELECT owner FROM project_details WHERE projects_name = ?";
        db.query(verifySql, [req.params.projects_name], (err, result) => {
            if (err) {
                console.error("Database error:", err);
                return res.status(500).json({ error: 'Database error' });
            }
            if (result.length === 0) {
                console.error(" Project not found.");
                return res.status(404).json({ error: 'Project not found' });
            }

            const projectOwner = result[0].owner;
            console.log("Project Owner:", projectOwner);

            if (projectOwner !== loggedInUser) { //not match then
                console.error("Unauthorized attempt to delete project.");
                return res.status(403).json({ error: 'You can only delete your own projects' });
            }

            
            const deleteSql = "DELETE FROM project_details WHERE projects_name = ?";
            db.query(deleteSql, [req.params.projects_name], (err, result) => {
                if (err) {
                    console.error("Error deleting project:", err);
                    return res.status(500).json({ error: "Server error while deleting" });
                }
                console.log("✅ Project deleted successfully!");
                return res.status(200).json({ success: "Project deleted successfully" });
            });
        });
    } catch (error) {
        console.error("Token error:", error);
        return res.status(403).json({ error: 'Unauthorized: Invalid token' });
    }
});

app.get('/generate_report', (req, res) => {
    const { start_date, end_date } = req.query;

    const sql = "SELECT * FROM project_details WHERE start_time >= ? AND end_time <= ?";
    const values = [start_date, end_date];

    db.query(sql, values, (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        const doc = new PDFDocument();
        let filename = `Project_Report_${start_date}_to_${end_date}.pdf`;
        filename = encodeURIComponent(filename);
        
        res.setHeader('Content-disposition', 'attachment; filename="' + filename + '"');
        res.setHeader('Content-type', 'application/pdf');

        doc.pipe(res);

        doc.fontSize(20).text('Project Report', { align: 'center' });
        doc.fontSize(12).text(`From: ${start_date} To: ${end_date}`, { align: 'center' });
        doc.moveDown();

        result.forEach(project => {
            doc.fontSize(14).text(`Project Name: ${project.projects_name}`);
            doc.fontSize(12).text(`Intro: ${project.intro}`);
            doc.fontSize(12).text(`Owner: ${project.owner}`);
            doc.fontSize(12).text(`Status: ${project.status}`);
            doc.fontSize(12).text(`Start Time: ${project.start_time}`);
            doc.fontSize(12).text(`End Time: ${project.end_time}`);
            doc.moveDown();
        });

        doc.end();
    });
});

app.get('/report', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'report.html'));
});






app.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
});