const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mammoth = require('mammoth');

const app = express();
app.use(bodyParser.json());
app.use(cors()); // 允许所有来源的请求

// 配置文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = './uploads/';
    if (!fs.existsSync(dir)){
      fs.mkdirSync(dir);
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // 重命名文件以避免冲突
  }
});

const upload = multer({ storage: storage });

// 初始化SQLite数据库
let db = new sqlite3.Database(':memory:');
db.serialize(() => {
  db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, password TEXT, role TEXT)");
  db.run("CREATE TABLE IF NOT EXISTS literatures (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, description TEXT, source TEXT, year TEXT, author TEXT, unit TEXT, file TEXT)");
  db.run("CREATE TABLE IF NOT EXISTS allocations (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER, literatureId INTEGER, meetingTime DATETIME, notes TEXT, slidesFilename TEXT, FOREIGN KEY(userId) REFERENCES users(id), FOREIGN KEY(literatureId) REFERENCES literatures(id))");

  // 插入一些初始数据
  db.run("INSERT INTO users (username, password, role) VALUES ('admin', 'admin123', 'admin')");
  db.run("INSERT INTO users (username, password, role) VALUES ('user', 'user123', 'user')");
});

// 用户登录
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  console.log('Received login request with:', username, password); // 调试信息
  db.get("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, row) => {
    if (row) {
      res.json({ success: true, user: row });
    } else {
      res.json({ success: false, message: 'Invalid credentials' });
    }
  });
});

// 用户注册
app.post('/register', (req, res) => {
  const { username, password, confirmPassword, role } = req.body;

  if (!username || !password || !confirmPassword) {
    return res.json({ success: false, message: 'All fields are required' });
  }

  if (password !== confirmPassword) {
    return res.json({ success: false, message: 'Passwords do not match' });
  }

  db.get("SELECT * FROM users WHERE username = ?", [username], (err, row) => {
    if (row) {
      return res.json({ success: false, message: 'Username already exists' });
    }

    db.run("INSERT INTO users (username, password, role) VALUES (?, ?, ?)", [username, password, role || 'user'], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID, message: 'User registered successfully' });
    });
  });
});

// 修改密码
app.post('/change-password', (req, res) => {
  const { userId, oldPassword, newPassword, confirmPassword } = req.body;

  if (!oldPassword || !newPassword || !confirmPassword) {
    return res.json({ success: false, message: 'All fields are required' });
  }

  if (newPassword !== confirmPassword) {
    return res.json({ success: false, message: 'New passwords do not match' });
  }

  db.get("SELECT * FROM users WHERE id = ? AND password = ?", [userId, oldPassword], (err, row) => {
    if (row) {
      db.run("UPDATE users SET password = ? WHERE id = ?", [newPassword, userId], function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.json({ success: true, message: 'Password changed successfully' });
      });
    } else {
      res.json({ success: false, message: 'Incorrect old password' });
    }
  });
});

// 添加文献
app.post('/upload-literature', upload.single('file'), (req, res) => {
  const { title, description, source, year, author, unit } = req.body;
  const filePath = req.file.path.replace(/\\/g, '/'); // 替换反斜杠为正斜杠以兼容不同操作系统
  const relativeFilePath = path.relative(path.join(__dirname, 'uploads'), filePath); // 存储相对路径

  console.warn("Path: ", relativeFilePath);

  db.run("INSERT INTO literatures (title, description, source, year, author, unit, file) VALUES (?, ?, ?, ?, ?, ?, ?)", 
         [title, description, source, year, author, unit, relativeFilePath], function(err) {
    if (err) {
      console.warn("111");

      res.status(500).json({ error: err.message });
      return;
    }
    console.warn("222");
    res.json({ id: this.lastID });
  });
});

// 获取所有文献
app.get('/literatures', (req, res) => {
  db.all("SELECT * FROM literatures", [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// 删除文献
app.delete('/literatures/:id', (req, res) => {
  const { id } = req.params;
  db.run("DELETE FROM literatures WHERE id = ?", [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ changes: this.changes });
  });
});

// 修改文献
app.put('/literatures/:id', (req, res) => {
  const { id } = req.params;
  const { title, description, source, year, author, unit, file } = req.body;
  db.run("UPDATE literatures SET title = ?, description = ?, source = ?, year = ?, author = ?, unit = ?, file = ? WHERE id = ?", 
         [title, description, source, year, author, unit, file, id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ changes: this.changes });
  });
});

// 提供文件下载
// app.use('/files', express.static(path.join(__dirname, 'uploads')));

// 提供文件内容（主要用于 DOCX 到 HTML 的转换）
app.get('/preview/:filename', (req, res) => {
    const { filename } = req.params;
    const filePath = path.join(__dirname, 'uploads', filename);
  
    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('File not found');
    }
  
    // 根据文件扩展名决定如何处理
    const ext = path.extname(filename).toLowerCase();
  
    if (ext === '.docx') {
      fs.readFile(filePath, (err, data) => {
        if (err) {
          return res.status(500).send('Error reading file');
        }
        mammoth.convertToHtml({ buffer: data })
          .then(result => {
            res.send(`<html><head><meta charset="utf-8"></head><body>${result.value}</body></html>`);
          })
          .catch(err => {
            res.status(500).send('Error converting file to HTML');
          });
      });
    } else {
      res.sendFile(filePath);
    }
});

// 文件预览
app.get('/preview/:filename', (req, res) => {
    const { filename } = req.params;
    const filePath = path.join(__dirname, 'uploads', filename);
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).send('文件未找到');
    }
});

// 文件下载
app.get('/files/:filename', (req, res) => {
    const { filename } = req.params;
    const filePath = path.join(__dirname, 'uploads', filename);
    if (fs.existsSync(filePath)) {
        res.download(filePath);
    } else {
        res.status(404).send('文件未找到');
    }
});


// 查询文献
app.get('/search', (req, res) => {
    const { title, author } = req.query;
    let query = 'SELECT * FROM literatures WHERE 1=1';
    let params = [];

    console.warn("search...");

    if (title) {
      query += ' AND lower(title) LIKE ?';
      params.push(`%${title.toLowerCase()}%`);
    }
  
    if (author) {
      query += ' AND lower(author) LIKE ?';
      params.push(`%${author.toLowerCase()}%`);
    }
  
    db.all(query, params, (err, rows) => {
      if (err) {
        return res.status(500).json({ success: false, message: err.message });
      }
      res.json(rows);
    });
});

app.post('/allocate-literature', (req, res) => {
    
    console.warn("Allocate literature!!!");
    
    const { userId, literatureId, meetingTime } = req.body;
    db.run("INSERT INTO allocations (userId, literatureId, meetingTime) VALUES (?, ?, ?)", [userId, literatureId, meetingTime], function(err) {
      if (err) {
        return res.status(500).json({ success: false, message: 'Server error' });
      }
    //   console.warn(userId, literatureId, meetingTime);
      res.json({ success: true, message: 'Literature allocated successfully' });
    });
});

app.get('/allocations', (req, res) => {
    console.warn("Allocate...");

    db.all("SELECT allocations.*, users.username AS userName, literatures.title AS literatureTitle, literatures.author AS literatureAuthor, literatures.year AS literatureYear FROM allocations JOIN users ON allocations.userId = users.id JOIN literatures ON allocations.literatureId = literatures.id", [], (err, rows) => {
      if (err) {
        return res.status(500).json({ message: 'Server error' });
      }
    //   console.warn(rows);
      res.json(rows);
    });
});

// 更新分配记录 (心得和总结)
app.put('/allocations/:id', upload.fields([{ name: 'notes', maxCount: 1 }, { name: 'slidesFile', maxCount: 1 }]), (req, res) => {
    console.warn("Allocate id");
    
    const { id } = req.params;
    const userId = req.user ? req.user.id : null;
  
    if (!id) {
      return res.status(400).json({ success: false, message: 'Allocation ID is required' });
    }

    db.get("SELECT * FROM allocations WHERE id = ? AND userId = ?", [id, userId], (err, allocation) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Server error' });
      }
      if (!allocation) {
        return res.status(403).json({ success: false, message: 'User does not have permission to update this allocation' });
      }
  
      let notesContent = undefined;
      if (req.files['notes'] && req.files['notes'].length > 0) {
        const notesFilePath = req.files['notes'][0].path;
        notesContent = fs.readFileSync(notesFilePath, 'utf8');
        fs.unlinkSync(notesFilePath); // Clean up temporary file
      }
  
      const slidesFilename = req.files['slidesFile'] ? req.files['slidesFile'][0].filename : undefined;
  
      let sql = "UPDATE allocations SET ";
      const params = [];
  
      if (notesContent !== undefined) {
        sql += "notes = ?, ";
        params.push(notesContent);
      }
      if (slidesFilename !== undefined) {
        sql += "slidesFilename = ?, ";
        params.push(slidesFilename);
      }
  
      // 移除字段中空格等字符
      sql = sql.slice(0, -2);
      sql += " WHERE id = ?";
      params.push(id);
  
      db.run(sql, params, function(err) {
        if (err) {
          console.error(err);
          return res.status(500).json({ success: false, message: 'Server error' });
        }
        res.json({ success: true, message: 'Allocation updated successfully' });
      });
    });
});

// 获取分配的详细信息（包括心得和总结）
app.get('/get-allocations', (req, res) => {
    console.warn("get allocations");

    db.all("SELECT allocations.*, users.username AS userName, literatures.title AS literatureTitle, literatures.author AS literatureAuthor, literatures.year AS literatureYear FROM allocations JOIN users JOIN literatures ON allocations.literatureId = literatures.id", [], (err, rows) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.json(rows);
    });
});

// 获取所有用户
app.get('/users', (req, res) => {
    console.warn("Get all users data...");
    db.all("SELECT id, username, role FROM users", [], (err, rows) => {
      if (err) {
        return res.status(500).json({ success: false, message: '服务器错误' });
      }
      res.json(rows);
    });
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});