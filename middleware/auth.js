const jwt = require('jsonwebtoken');
const { getDB } = require('../db/database');

async function requireAuth(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.redirect('/login');
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const db = getDB();
    const user = await db.prepare('SELECT id,username,first_name,last_name,designation,organization,cohort,table_number,role,custom_fields FROM users WHERE id = ?').get(decoded.userId);
    if (!user) { res.clearCookie('token'); return res.redirect('/login'); }
    req.user = user;
    next();
  } catch(e) { res.clearCookie('token'); res.redirect('/login'); }
}

async function requireAdmin(req, res, next) {
  const token = req.cookies.admin_token;
  if (!token) return res.redirect('/admin/login');
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const db = getDB();
    const user = await db.prepare('SELECT * FROM users WHERE id = ? AND role = ?').get(decoded.userId, 'admin');
    if (!user) { res.clearCookie('admin_token'); return res.redirect('/admin/login'); }
    req.admin = user;
    next();
  } catch(e) { res.clearCookie('admin_token'); res.redirect('/admin/login'); }
}

module.exports = { requireAuth, requireAdmin };
