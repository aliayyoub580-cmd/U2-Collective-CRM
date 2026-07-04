const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('./utils/loadEnv')();
const seedSupabase = require('./database/seedSupabase');

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '127.0.0.1';
const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads');
const backupsDir = process.env.BACKUPS_DIR || path.join(__dirname, 'backups');

[uploadsDir, backupsDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check must stay lightweight so Electron can detect that Express is up.
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'U2 Collective CRM'
  });
});

// Serve uploaded files
app.use('/uploads', express.static(uploadsDir));
app.use('/api/quran', require('./routes/quran.routes'));

seedSupabase().catch((err) => {
  console.error('Supabase startup seed skipped:', err.message);
});

// Routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/dashboard', require('./routes/dashboard.routes'));
app.use('/api/leads', require('./routes/leads.routes'));
app.use('/api/followups', require('./routes/followups.routes'));
app.use('/api/communications', require('./routes/communications.routes'));
app.use('/api/tasks', require('./routes/tasks.routes'));
app.use('/api/proposals', require('./routes/proposals.routes'));
app.use('/api/clients', require('./routes/clients.routes'));
app.use('/api/employees', require('./routes/employees.routes'));
app.use('/api/reports', require('./routes/reports.routes'));
app.use('/api/users', require('./routes/users.routes'));

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

const server = app.listen(PORT, HOST, () => {
  console.log(`U2 CRM Server running on http://${HOST}:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`U2 CRM Server could not start: http://${HOST}:${PORT} is already in use.`);
    process.exit(1);
  }
  console.error('U2 CRM Server failed to start:', err);
  process.exit(1);
});

module.exports = app;
