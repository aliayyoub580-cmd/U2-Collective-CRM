const path = require('path');
const os = require('os');

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const runtimeRoot = isServerless ? path.join(os.tmpdir(), 'u2-crm') : path.join(__dirname, '..');

function uploadsPath(...segments) {
  return path.join(process.env.UPLOADS_DIR || path.join(runtimeRoot, 'uploads'), ...segments);
}

function backupsPath(...segments) {
  return path.join(process.env.BACKUPS_DIR || path.join(runtimeRoot, 'backups'), ...segments);
}

module.exports = {
  isServerless,
  uploadsPath,
  backupsPath
};
