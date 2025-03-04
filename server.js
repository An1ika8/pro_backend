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
    // host: "192.168.78.157",
    host: "localhost",
    user: "root",
    password: "",
    database: "project2"
});

db.connect((err) => {
    if (err) {
        console.error('Error connecting to the database:', err);
        return;
    }
    console.log('Connected to the database');
});

app.post('/api/v1/register', (req, res) => {
    const { user_id, username, email, password } = req.body;

    console.log("Received Data:", req.body); 

    if (!user_id || !username || !email || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) return res.status(500).send({ error: 'Error hashing password' });

        const query = 'INSERT INTO users (user_id, username, email, password) VALUES (?, ?, ?, ?)';
        db.query(query, [user_id, username, email, hashedPassword], (err, result) => {
            if (err) return res.status(500).send({ error: 'Error creating user' });
            res.status(201).send({ message: 'User registered' });
        });
    });
});


app.post('/api/v1/login', (req, res) => {
    const { user_id, username, password } = req.body; 
    const query = 'SELECT * FROM users WHERE user_id = ?';
    db.query(query, [user_id], (err, rows) => {
      if (err || rows.length === 0) return res.status(404).send({ error: 'User not found' });
  
      const user = rows[0];
      bcrypt.compare(password, user.password, (err, match) => {
        if (err || !match) return res.status(401).send({ error: 'Invalid credentials' });
        
        const token = jwt.sign({ user_id: user.user_id, username: user.username }, 'tdghutdfgtwegbhhder', { expiresIn: '1h' });
        
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

        const { project_id, project_name, intro, status, start_time, end_time } = req.body;
        
        const sql = "INSERT INTO project_detailss (project_id, projects_name, intro, owner, status, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?, ?)";
        const values = [project_id, project_name, intro, owner, status, start_time, end_time];

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
    const sql = "SELECT * FROM project_detailss";
    db.query(sql, (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            return res.status(500).json({"message" : "Server error"});
        }
        res.status(200).json(result);
    });
});

app.get("/get_projects/:project_id", (req, res) => {
    const sql = "SELECT * FROM project_detailss WHERE project_id = ?";
    const values = [req.params.project_id];

    db.query(sql, values, (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            return res.status(500).json({ "message": "Server error" });
        }

        if (result.length === 0) {
            return res.status(404).json({ "message": "Project not found" });
        }

        res.status(200).json(result);
    });
});


const secretKey ='tdghutdfgtwegbhhder';

app.put("/edit_user/:project_id", (req, res) => {
    const token = req.headers.authorization;

    if (!token) {
        console.error("No token provided.");
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    try {
        
        const decoded = jwt.verify(token.split(" ")[1], secretKey);
        const loggedInUser = decoded.username; 

        
        const { project_id, projects_name, intro, owner, status, start_time, end_time } = req.body;

        
        const verifySql = "SELECT owner FROM project_detailss WHERE project_id = ?";
        db.query(verifySql, [req.params.project_id], (err, result) => {
            if (err) {
                console.error("Database error:", err);
                return res.status(500).json({ error: 'Database error' });
            }
            if (result.length === 0) {
                console.error("Project not found.");
                return res.status(404).json({ error: 'Project not found' });
            }

            const projectOwner = result[0].owner;

            if (projectOwner !== loggedInUser) {
                console.error("Unauthorized attempt to edit project.");
                return res.status(403).json({ error: 'You can only edit your own projects' });
            }

            
            const updateSql = "UPDATE project_detailss SET project_id = ?, projects_name = ?, intro = ?, owner = ?, status = ?, start_time = ?, end_time = ? WHERE project_id = ?";
            const values = [project_id, projects_name, intro, owner, status, start_time, end_time, req.params.project_id];

            db.query(updateSql, values, (err, result) => {
                if (err) {
                    console.error("Error updating project:", err);
                    return res.status(500).json({ error: "Server error while updating" });
                }
                res.status(200).json({ success: "Project updated successfully" });
            });
        });
    } catch (error) {
        console.error("Token error:", error);
        return res.status(403).json({ error: 'Unauthorized: Invalid token' });
    }
});




app.delete("/delete/:project_id", (req, res) => {
    const token = req.headers.authorization;

    if (!token) {
        console.error("No token provided.");
        return res.status(401).json({ error: "Unauthorized: No token provided" });
    }

    try {
        const decoded = jwt.verify(token.split(" ")[1], "tdghutdfgtwegbhhder");
        const loggedInUser = decoded.username;

        console.log("Logged-in user:", loggedInUser);

        const verifySql = "SELECT owner FROM project_detailss WHERE project_id = ?";
        db.query(verifySql, [req.params.project_id], (err, result) => {
            if (err) {
                console.error("Database error:", err);
                return res.status(500).json({ error: "Database error" });
            }
            if (result.length === 0) {
                console.error("Project not found.");
                return res.status(404).json({ error: "Project not found" });
            }

            const projectOwner = result[0].owner;
            console.log("Project Owner:", projectOwner);

            if (projectOwner !== loggedInUser) {
                console.error("Unauthorized attempt to delete project.");
                return res.status(403).json({ error: "You can only delete your own projects" });
            }

            
            const deleteMembersSql = "DELETE FROM project_members WHERE project_id = ?";
            db.query(deleteMembersSql, [req.params.project_id], (err, result) => {
                if (err) {
                    console.error("Error deleting project members:", err);
                    return res.status(500).json({ error: "Server error while deleting members" });
                }

                
                const deleteSql = "DELETE FROM project_detailss WHERE project_id = ?";
                db.query(deleteSql, [req.params.project_id], (err, result) => {
                    if (err) {
                        console.error("Error deleting project:", err);
                        return res.status(500).json({ error: "Server error while deleting project" });
                    }
                    console.log("Project deleted successfully!");
                    return res.status(200).json({ success: "Project deleted successfully" });
                });
            });
        });
    } catch (error) {
        console.error("Token error:", error);
        return res.status(403).json({ error: "Unauthorized: Invalid token" });
    }
});





app.get("/generate_report", (req, res) => {
    const { start_date, end_date } = req.query;

    const sql = "SELECT * FROM project_detailss WHERE start_time >= ? AND end_time <= ?";
    const values = [start_date, end_date];

    db.query(sql, values, (err, result) => {
        if (err) {
            console.error("Error executing query:", err);
            return res.status(500).json({ error: "Database error" });
        }

        const doc = new PDFDocument({ margin: 30, size: "A4" });
        let filename = `Project_Report_${start_date}_to_${end_date}.pdf`;
        filename = encodeURIComponent(filename);

        res.setHeader("Content-disposition", `attachment; filename="${filename}"`);
        res.setHeader("Content-type", "application/pdf");

        doc.pipe(res);

        // Title
        doc.fontSize(20).font("Helvetica-Bold").text("Project Report", { align: "center" });
        doc.moveDown(0.5);
        doc.fontSize(12).text(`From: ${start_date} To: ${end_date}`, { align: "center" });
        doc.moveDown(1);

        // Table Headers
        const headers = ["Name", "Intro", "Owner", "Status", "Start Time", "End Time"];
        const columnWidths = [80, 100, 80, 70, 80, 80]; // Adjust widths

        doc.font("Helvetica-Bold");
        let x = 50;
        let y = doc.y;
        headers.forEach((header, index) => {
            doc.text(header, x, y, { width: columnWidths[index], align: "left" });
            x += columnWidths[index];
        });
        doc.moveDown(0.5);

        // Draw a line under headers
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown(0.5);

        // Table Rows
        doc.font("Helvetica").fontSize(10);
        result.forEach((project) => {
            let x = 50;
            y = doc.y;
            const rowData = [
                project.projects_name,
                project.intro,
                project.owner,
                project.status,
                project.start_time,
                project.end_time,
            ];

            rowData.forEach((data, index) => {
                doc.text(data.toString(), x, y, { width: columnWidths[index], align: "left" });
                x += columnWidths[index];
            });

            doc.moveDown(0.5);
        });

        doc.end();
    });
});

app.get('/report', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'report.html'));
});



app.get("/get_users", (req, res) => {
    const sql = "SELECT user_id, username FROM users";
    
    db.query(sql, (err, result) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ error: "Database error" });
        }
        res.status(200).json(result);
    });
});








const verifyToken = (req, res, next) => {
    const token = req.headers.authorization;

    if (!token) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    try {
        const decoded = jwt.verify(token.split(" ")[1], 'tdghutdfgtwegbhhder');
        req.user = decoded; 
        next();
    } catch (error) {
        console.error("Token error:", error);
        return res.status(403).json({ error: 'Unauthorized: Invalid token' });
    }
};



app.route("/user_profile")
    .get(verifyToken, (req, res) => {
        const userId = req.user.user_id;

        db.query(
            "SELECT username, email FROM users WHERE user_id = ?",
            [userId],
            (err, result) => {
                if (err) return res.status(500).json({ error: err.message });

                if (result.length > 0) {
                    res.json(result[0]);  // Send the user profile data
                } else {
                    res.status(404).json({ message: "User not found" });
                }
            }
        );
    })
    .put(verifyToken, (req, res) => {
        const userId = req.user.user_id;
        const { username, email } = req.body;
    
        if (!username || !email) {
            return res.status(400).json({ message: "Username and email are required" });
        }
    
        // Step 1: first current user name k anbo
        db.query(
            "SELECT username FROM users WHERE user_id = ?",
            [userId],
            (err, result) => {
                if (err) return res.status(500).json({ error: err.message });
    
                if (result.length > 0) {
                    const oldUsername = result[0].username;
    
                    // Step 2: Update username & email in the user table
                    db.query(
                        "UPDATE users SET username = ?, email = ? WHERE user_id = ?",
                        [username, email, userId],
                        (err, updateResult) => {
                            if (err) return res.status(500).json({ error: err.message });
    
                            if (updateResult.affectedRows > 0) {
                                // Step 3: Update korbo project details owner k
                                db.query(
                                    "UPDATE project_detailss SET owner = ? WHERE owner = ?",
                                    [username, oldUsername], // Replace the old username with the new one
                                    (err, updateOwnerResult) => {
                                        if (err) return res.status(500).json({ error: err.message });
    
                                        res.json({
                                            message: "Profile updated successfully",
                                            username,
                                            email
                                        });
                                    }
                                );
                            } else {
                                res.status(404).json({ message: "User not found" });
                            }
                        }
                    );
                } else {
                    res.status(404).json({ message: "User not found" });
                }
            }
        );
    });












app.get("/project_members/:project_id", verifyToken, (req, res) => {
    const project_id = req.params.project_id;
    const added_by = req.user.username; 

    const query = `
      SELECT u.user_id, u.username, pm.role 
      FROM project_members pm
      JOIN users u ON pm.user_id = u.user_id
      WHERE pm.project_id = ? AND pm.added_by = ?;
    `;

    db.query(query, [project_id, added_by], (err, results) => {
        if (err) {
            console.error("Error fetching project members:", err);
            return res.status(500).json({ error: "Internal Server Error" });
        }

        res.json(results);
    });
});

app.post("/add_project_member", verifyToken, (req, res) => {
    const { project_id, user_id, role } = req.body;
    const added_by = req.user.username; 

    console.log("Adding member:", req.body, "Added by:", added_by);

    if (!project_id || !user_id || !role) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    
    const checkQuery = "SELECT * FROM project_members WHERE project_id = ? AND user_id = ?";
    db.query(checkQuery, [project_id, user_id], (err, results) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ error: "Database error" });
        }

        if (results.length > 0) {
            return res.status(400).json({ error: "User is already a member of this project" });
        }

        
        const insertQuery = "INSERT INTO project_members (project_id, user_id, role, added_by) VALUES (?, ?, ?, ?)";
        db.query(insertQuery, [project_id, user_id, role, added_by], (err, result) => {
            if (err) {
                console.error("Database error:", err);
                return res.status(500).json({ error: "Error adding project member" });
            }
            res.status(201).json({ success: "User added as project member" });
        });
    });
});

  


app.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
});