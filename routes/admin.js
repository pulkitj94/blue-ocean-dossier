const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { requireAdmin } = require('../middleware/auth');
const { getDB } = require('../db/database');

router.get('/login', (req, res) => {
  if (req.cookies.admin_token) { try { jwt.verify(req.cookies.admin_token, process.env.JWT_SECRET); return res.redirect('/admin'); } catch(e) { res.clearCookie('admin_token'); } }
  res.render('admin/login', { error: null });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const db = getDB();
  const user = await db.prepare('SELECT * FROM users WHERE username = ? AND role = ?').get(username, 'admin');
  if (!user || !bcrypt.compareSync(password, user.password_hash)) return res.render('admin/login', { error: 'Invalid admin credentials' });
  const token = jwt.sign({ userId: user.id, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '8h' });
  res.cookie('admin_token', token, { httpOnly: true, maxAge: 8*3600000, sameSite: 'lax' });
  res.redirect('/admin');
});

router.get('/logout', (req, res) => { res.clearCookie('admin_token'); res.redirect('/admin/login'); });

router.get('/', requireAdmin, async (req, res) => {
  const db = getDB();
  const uc = await db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'respondent'").get();
  const mc = await db.prepare('SELECT COUNT(*) as count FROM modules').get();
  const rc = await db.prepare('SELECT COUNT(*) as count FROM responses').get();
  res.render('admin/dashboard', { admin: req.admin, stats: { userCount: uc.count, moduleCount: mc.count, responseCount: rc.count } });
});

router.get('/users', requireAdmin, async (req, res) => {
  const db = getDB();
  const users = await db.prepare("SELECT u.*, (SELECT COUNT(*) FROM responses WHERE user_id = u.id) as response_count FROM users u WHERE u.role = 'respondent' ORDER BY u.created_at DESC").all();
  res.render('admin/users', { admin: req.admin, users });
});

router.post('/users/create', requireAdmin, async (req, res) => {
  const db = getDB();
  const { username, password, first_name, last_name, designation, organization, cohort, table_number } = req.body;
  const finalUsername = username || `BO-${String(Date.now()).slice(-6)}-2026`;
  const finalPassword = password || String(Math.floor(100000 + Math.random() * 900000));
  const hash = bcrypt.hashSync(finalPassword, 10);

  try {
    const result = await db.prepare("INSERT INTO users (username,password_hash,first_name,last_name,designation,organization,cohort,table_number,role) VALUES (?,?,?,?,?,?,?,?,'respondent')").run(finalUsername, hash, first_name||'', last_name||'', designation||'', organization||'', cohort||'', table_number||'');
    const modules = await db.prepare('SELECT id, is_default_unlocked FROM modules ORDER BY module_number').all();
    for (const mod of modules) {
      try { await db.prepare('INSERT INTO user_module_status (user_id,module_id,status) VALUES (?,?,?)').run(result.lastInsertRowid, mod.id, mod.is_default_unlocked ? 'unlocked' : 'locked'); } catch(e){}
    }
    res.json({ success: true, user: { id: result.lastInsertRowid, username: finalUsername, password: finalPassword, first_name, last_name } });
  } catch(err) {
    if (err.message && (err.message.includes('unique') || err.message.includes('duplicate'))) res.status(400).json({ error: 'Username already exists' });
    else res.status(500).json({ error: err.message });
  }
});

router.delete('/users/:id', requireAdmin, async (req, res) => {
  const db = getDB();
  await db.prepare('DELETE FROM responses WHERE user_id = ?').run(parseInt(req.params.id));
  await db.prepare('DELETE FROM user_module_status WHERE user_id = ?').run(parseInt(req.params.id));
  await db.prepare("DELETE FROM users WHERE id = ? AND role = 'respondent'").run(parseInt(req.params.id));
  res.json({ success: true });
});

router.get('/questions', requireAdmin, async (req, res) => {
  const db = getDB();
  const modules = await db.prepare('SELECT * FROM modules ORDER BY module_number').all();
  const questions = await db.prepare('SELECT q.*, m.title as module_title FROM questions q JOIN modules m ON q.module_id = m.id ORDER BY q.module_id, q.sort_order').all();
  questions.forEach(q => { try { q.parsedOptions = JSON.parse(q.options); } catch(e) { q.parsedOptions = []; } });
  res.render('admin/questions', { admin: req.admin, modules, questions });
});

router.post('/questions/create', requireAdmin, async (req, res) => {
  const db = getDB();
  const { module_id, question_number, pillar, question_text, response_type, options, scoring_logic } = req.body;
  try {
    const optionsStr = typeof options === 'string' ? options : JSON.stringify(options || []);
    await db.prepare('INSERT INTO questions (module_id,question_number,pillar,question_text,response_type,options,scoring_logic,sort_order) VALUES (?,?,?,?,?,?,?,?)').run(module_id, question_number, pillar, question_text, response_type, optionsStr, scoring_logic||'', question_number);
    res.json({ success: true });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

router.put('/questions/:id', requireAdmin, async (req, res) => {
  const db = getDB();
  const { pillar, question_text, response_type, options, scoring_logic, is_active } = req.body;
  try {
    if (is_active !== undefined && !question_text) {
      await db.prepare('UPDATE questions SET is_active = ? WHERE id = ?').run(is_active, parseInt(req.params.id));
    } else {
      const optionsStr = typeof options === 'string' ? options : JSON.stringify(options || []);
      await db.prepare('UPDATE questions SET pillar=?, question_text=?, response_type=?, options=?, scoring_logic=?, is_active=? WHERE id=?').run(pillar, question_text, response_type, optionsStr, scoring_logic||'', is_active !== undefined ? is_active : 1, parseInt(req.params.id));
    }
    res.json({ success: true });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

router.delete('/questions/:id', requireAdmin, async (req, res) => {
  const db = getDB();
  await db.prepare('DELETE FROM questions WHERE id = ?').run(parseInt(req.params.id));
  res.json({ success: true });
});

router.get('/modules', requireAdmin, async (req, res) => {
  const db = getDB();
  const modules = await db.prepare('SELECT * FROM modules ORDER BY module_number').all();
  const rules = await db.prepare('SELECT r.*, m.title as module_title, dm.title as depends_on_title FROM module_unlock_rules r JOIN modules m ON r.module_id = m.id LEFT JOIN modules dm ON r.depends_on_module_id = dm.id').all();
  res.render('admin/modules', { admin: req.admin, modules, rules });
});

router.post('/modules/rules', requireAdmin, async (req, res) => {
  const db = getDB();
  const { module_id, rule_type, depends_on_module_id, unlock_date } = req.body;
  try {
    await db.prepare('DELETE FROM module_unlock_rules WHERE module_id = ?').run(module_id);
    await db.prepare('INSERT INTO module_unlock_rules (module_id,rule_type,depends_on_module_id,unlock_date,is_active) VALUES (?,?,?,?,1)').run(module_id, rule_type, depends_on_module_id||null, unlock_date||null);
    res.json({ success: true });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

router.get('/responses', requireAdmin, async (req, res) => {
  const db = getDB();
  const respondents = await db.prepare("SELECT u.id, u.username, u.first_name, u.last_name, u.organization, (SELECT COUNT(*) FROM responses WHERE user_id = u.id) as response_count, (SELECT MAX(submitted_at) FROM responses WHERE user_id = u.id) as last_response FROM users u WHERE u.role = 'respondent' AND u.id IN (SELECT DISTINCT user_id FROM responses) ORDER BY last_response DESC").all();
  res.render('admin/responses', { admin: req.admin, respondents });
});

router.get('/responses/:userId', requireAdmin, async (req, res) => {
  const db = getDB();
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(parseInt(req.params.userId));
  if (!user) return res.status(404).json({ error: 'User not found' });
  const responses = await db.prepare('SELECT r.*, q.question_text, q.pillar, q.response_type, q.question_number FROM responses r JOIN questions q ON r.question_id = q.id WHERE r.user_id = ? ORDER BY q.sort_order').all(parseInt(req.params.userId));
  res.json({ user: { first_name: user.first_name, last_name: user.last_name, organization: user.organization }, responses });
});

module.exports = router;
