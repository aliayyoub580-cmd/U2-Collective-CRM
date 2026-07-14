const express = require('express');
const cors = require('cors');
const fs = require('fs');
require('./utils/loadEnv')();
const seedSupabase = require('./database/seedSupabase');
const { uploadsPath, backupsPath } = require('./utils/runtimePaths');
const { authenticateToken, requireModule } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '127.0.0.1';
const uploadsDir = uploadsPath();
const backupsDir = backupsPath();

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

const seedReady = seedSupabase().catch((err) => {
  console.error('Supabase startup seed skipped:', err.message);
});

// Routes
// Prevent the first login request from racing startup account initialization.
app.use('/api/auth', async (req, res, next) => {
  await seedReady;
  next();
}, require('./routes/auth.routes'));
app.use('/api/dashboard', authenticateToken, requireModule('dashboard'), require('./routes/dashboard.routes'));
app.use('/api/leads', authenticateToken, requireModule('leads'), require('./routes/leads.routes'));
app.use('/api/followups', authenticateToken, requireModule('followups'), require('./routes/followups.routes'));
app.use('/api/communications', authenticateToken, requireModule('communications'), require('./routes/communications.routes'));
app.use('/api/tasks', authenticateToken, requireModule('tasks'), require('./routes/tasks.routes'));
app.use('/api/proposals', authenticateToken, requireModule('proposals'), require('./routes/proposals.routes'));
app.use('/api/clients', authenticateToken, requireModule('clients'), require('./routes/clients.routes'));
app.use('/api/employees', require('./routes/employees.routes'));
app.use('/api/reports', authenticateToken, requireModule('reports'), require('./routes/reports.routes'));
app.use('/api/users', require('./routes/users.routes'));
app.use('/api/notifications', require('./routes/notifications.routes'));
app.use('/api/manager', require('./routes/manager.routes'));
app.use('/api/admin', require('./routes/admin.routes'));
app.use('/api/caller', require('./routes/caller.routes'));

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : 'Internal server error', message: err.message });
});

if (require.main === module) {
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
}

module.exports = app;
