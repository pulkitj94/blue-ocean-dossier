const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDB } = require('../db/database');

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/login', (req, res) => {
  if (req.cookies.token) { try { jwt.verify(req.cookies.token, process.env.JWT_SECRET); return res.redirect(303, '/dashboard'); } catch(e) { res.clearCookie('token'); } }
  res.render('login', { error: null });
});

router.post('/login', asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  const db = getDB();
  const user = await db.prepare('SELECT * FROM users WHERE username = ? AND role = ?').get(username, 'respondent');
  if (!user) return res.render('login', { error: 'Invalid credentials. Please check your username and passcode.' });
  if (!bcrypt.compareSync(password, user.password_hash)) return res.render('login', { error: 'Invalid credentials. Please check your username and passcode.' });
  
  await db.prepare('UPDATE users SET last_login = NOW() WHERE id = ?').run(user.id);
  const token = jwt.sign({ userId: user.id, username: user.username, role: user.role }, process.env.JWT_SECRET, { expiresIn: `${process.env.SESSION_DURATION_HOURS || 24}h` });
  res.cookie('token', token, { httpOnly: true, maxAge: (process.env.SESSION_DURATION_HOURS || 24) * 3600000, sameSite: 'lax' });
  res.redirect(303, '/dashboard');
}));

router.get('/logout', (req, res) => { res.clearCookie('token'); res.redirect('/login'); });

module.exports = router;