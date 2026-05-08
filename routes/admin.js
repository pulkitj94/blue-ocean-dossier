const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { requireAdmin } = require('../middleware/auth');
const { getDB } = require('../db/database');
const { Resend } = require('resend');

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const resend = new Resend(process.env.RESEND_API_KEY);

router.get('/login', (req, res) => {
  if (req.cookies.admin_token) { try { jwt.verify(req.cookies.admin_token, process.env.JWT_SECRET); return res.redirect(303, '/admin'); } catch(e) { res.clearCookie('admin_token'); } }
  res.render('admin/login', { error: null });
});

router.post('/login', asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  const db = getDB();
  const user = await db.prepare('SELECT * FROM users WHERE username = ? AND role = ?').get(username, 'admin');
  if (!user || !bcrypt.compareSync(password, user.password_hash)) return res.render('admin/login', { error: 'Invalid admin credentials' });
  const token = jwt.sign({ userId: user.id, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '8h' });
  res.cookie('admin_token', token, { httpOnly: true, maxAge: 8*3600000, sameSite: 'lax' });
  res.redirect(303, '/admin');
}));

router.get('/logout', (req, res) => { res.clearCookie('admin_token'); res.redirect('/admin/login'); });

router.get('/', requireAdmin, asyncHandler(async (req, res) => {
  const db = getDB();
  const uc = await db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'respondent'").get();
  const mc = await db.prepare('SELECT COUNT(*) as count FROM modules').get();
  const rc = await db.prepare('SELECT COUNT(DISTINCT user_id) as count FROM responses').get();
  res.render('admin/dashboard', { admin: req.admin, stats: { userCount: uc.count, moduleCount: mc.count, responseCount: rc.count } });
}));

router.get('/users', requireAdmin, asyncHandler(async (req, res) => {
  const db = getDB();
  const users = await db.prepare("SELECT u.*, (SELECT COUNT(*) FROM responses WHERE user_id = u.id) as response_count FROM users u WHERE u.role = 'respondent' ORDER BY u.created_at DESC").all();
  res.render('admin/users', { admin: req.admin, users });
}));

router.post('/users/create', requireAdmin, asyncHandler(async (req, res) => {
  const db = getDB();
  const { password, first_name, last_name, designation, organization, email } = req.body;
  
  const num = String(Math.floor(Math.random() * 900) + 100);
  const finalUsername = 'BO-' + num + '-2026';
  const finalPassword = password || String(Math.floor(100000 + Math.random() * 900000));
  const hash = bcrypt.hashSync(finalPassword, 10);

  try {
    const result = await db.prepare("INSERT INTO users (username,password_hash,first_name,last_name,designation,organization,email,role) VALUES (?,?,?,?,?,?,?,'respondent')").run(finalUsername, hash, first_name||'', last_name||'', designation||'', organization||'', email||'');
    const modules = await db.prepare('SELECT id, is_default_unlocked FROM modules ORDER BY module_number').all();
    for (const mod of modules) {
      try { await db.prepare('INSERT INTO user_module_status (user_id,module_id,status) VALUES (?,?,?)').run(result.lastInsertRowid, mod.id, mod.is_default_unlocked ? 'unlocked' : 'locked'); } catch(e){}
    }
    res.json({ success: true, user: { id: result.lastInsertRowid, username: finalUsername, password: finalPassword, first_name, last_name, email } });
  } catch(err) {
    if (err.message && (err.message.includes('unique') || err.message.includes('duplicate'))) res.status(400).json({ error: 'User ID collision — try again' });
    else res.status(500).json({ error: err.message });
  }
}));

router.post('/users/:id/reset-passcode', requireAdmin, asyncHandler(async (req, res) => {
  const db = getDB();
  const newPasscode = String(Math.floor(100000 + Math.random() * 900000));
  const hash = bcrypt.hashSync(newPasscode, 10);
  await db.prepare('UPDATE users SET password_hash = ? WHERE id = ? AND role = ?').run(hash, parseInt(req.params.id), 'respondent');
  res.json({ success: true, newPasscode });
}));

router.put('/users/:id/edit', requireAdmin, asyncHandler(async (req, res) => {
  const db = getDB();
  const { first_name, last_name, designation, organization, email } = req.body;
  await db.prepare('UPDATE users SET first_name=?, last_name=?, designation=?, organization=?, email=? WHERE id=? AND role=?').run(first_name||'', last_name||'', designation||'', organization||'', email||'', parseInt(req.params.id), 'respondent');
  res.json({ success: true });
}));

router.post('/users/:id/send-invite', requireAdmin, asyncHandler(async (req, res) => {
  const db = getDB();
  const user = await db.prepare('SELECT * FROM users WHERE id = ? AND role = ?').get(parseInt(req.params.id), 'respondent');
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!user.email) return res.status(400).json({ error: 'No email address for this user' });

  const newPasscode = String(Math.floor(100000 + Math.random() * 900000));
  const hash = bcrypt.hashSync(newPasscode, 10);
  await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);

  const appUrl = 'https://blue-ocean-dossier.vercel.app';

  const emailHtml = `
    <div style="font-family: 'Georgia', serif; max-width: 640px; margin: 0 auto; color: #1a1916; line-height: 1.7;">
      <div style="background: #1a1916; padding: 32px 40px; margin-bottom: 0;">
        <span style="font-family: monospace; font-size: 11px; letter-spacing: 0.3em; color: #b8924a; text-transform: uppercase;">YPO Blue Ocean</span>
        <h1 style="font-family: Georgia, serif; font-size: 28px; font-weight: 400; font-style: italic; color: #f4f1ea; margin: 16px 0 0;">The Art of the <span style="color: #b8924a;">Impossible</span></h1>
      </div>
      
      <div style="background: #fdfbf6; padding: 40px; border: 1px solid #ddd6c4; border-top: none;">
        <p>Dear ${user.first_name || 'Member'},</p>
        
        <p>Ahead of our 18 July gathering at the Trident, Gurgaon — <em>The Art of the Impossible</em> — I am sharing a short piece of preparation that is unlike anything Blue Ocean has asked of you before.</p>
        
        <p>We have commissioned Garage Labs Technologies to build each of us a confidential AI maturity dossier. Over the course of the day, you will be shown exactly where your company sits relative to the room, relative to global leaders, and — most usefully — relative to the capital you have already deployed.</p>
        
        
        <div style="background: #1a1916; color: #f4f1ea; padding: 24px 32px; margin: 24px 0; font-family: monospace; font-size: 14px; line-height: 2;">
          <div><strong style="color: #b8924a;">Your User ID:</strong> ${user.username}</div>
          <div><strong style="color: #b8924a;">Your access code:</strong> ${newPasscode}</div>
          <div><strong style="color: #b8924a;">Your private link:</strong> <a href="${appUrl}" style="color: #b8924a;">${appUrl}</a></div>
        </div>
        
        <p>Inside, you will find a twenty-five-question assessment across five pillars: Strategy, Use Cases, Data, Technology, People &amp; Governance. It takes eight minutes and closes on 3 July. Your responses are private to you and, anonymised, to Garage Labs' analyst team.</p>
        
        <p>Before you begin, the two-minute primer below is worth watching.</p>
        
        <div style="background: #f4f1ea; border: 1px solid #c9c2b0; padding: 20px; text-align: center; margin: 24px 0;">
          <p style="font-family: monospace; font-size: 11px; letter-spacing: 0.2em; color: #8a857c; text-transform: uppercase; margin-bottom: 8px;">Video Primer</p>
          <p style="font-style: italic; color: #4a4640;">"Why this matters, and why now"</p>
          <p style="font-size: 13px; color: #8a857c; margin-top: 8px;">[Video link will be added here]</p>
        </div>
        
        <p>On 18 July, a printed version of your personalised dossier will be on your seat. It will be the most useful document in the room.</p>
        
        <p style="margin-top: 32px;">
          Warmly,<br>
          <strong>Apurva Chamaria</strong><br>
          Learning Officer, YPO Blue Ocean
        </p>
        
        <p style="font-size: 13px; color: #8a857c; font-style: italic; margin-top: 24px; padding-top: 16px; border-top: 1px solid #ddd6c4;">
          This workshop is being designed by Garage Labs Technologies — Revathi and Sumit from the team are on this thread and can be reached directly at any time.
        </p>
      </div>
    </div>
  `;

  try {
    await resend.emails.send({
      from: 'YPO Blue Ocean <onboarding@resend.dev>',
      to: [user.email],
      subject: 'Your private dossier for 18 July',
      html: emailHtml,
    });
    res.json({ success: true });
  } catch(err) {
    console.error('Email send error:', err);
    res.json({ success: false, error: err.message || 'Failed to send email' });
  }
}));

router.delete('/users/:id', requireAdmin, asyncHandler(async (req, res) => {
  const db = getDB();
  await db.prepare('DELETE FROM responses WHERE user_id = ?').run(parseInt(req.params.id));
  await db.prepare('DELETE FROM user_module_status WHERE user_id = ?').run(parseInt(req.params.id));
  await db.prepare("DELETE FROM users WHERE id = ? AND role = 'respondent'").run(parseInt(req.params.id));
  res.json({ success: true });
}));

router.get('/questions', requireAdmin, asyncHandler(async (req, res) => {
  const db = getDB();
  const modules = await db.prepare('SELECT * FROM modules ORDER BY module_number').all();
  const questions = await db.prepare('SELECT q.*, m.title as module_title FROM questions q JOIN modules m ON q.module_id = m.id ORDER BY q.module_id, q.sort_order').all();
  questions.forEach(q => { try { q.parsedOptions = JSON.parse(q.options); } catch(e) { q.parsedOptions = []; } });
  res.render('admin/questions', { admin: req.admin, modules, questions });
}));

router.post('/questions/create', requireAdmin, asyncHandler(async (req, res) => {
  const db = getDB();
  const { module_id, question_number, pillar, question_text, response_type, options, scoring_logic } = req.body;
  try {
    const optionsStr = typeof options === 'string' ? options : JSON.stringify(options || []);
    await db.prepare('INSERT INTO questions (module_id,question_number,pillar,question_text,response_type,options,scoring_logic,sort_order) VALUES (?,?,?,?,?,?,?,?)').run(module_id, question_number, pillar, question_text, response_type, optionsStr, scoring_logic||'', question_number);
    res.json({ success: true });
  } catch(err) { res.status(500).json({ error: err.message }); }
}));

router.put('/questions/:id', requireAdmin, asyncHandler(async (req, res) => {
  const db = getDB();
  const { pillar, question_text, response_type, options, scoring_logic, is_active, tooltip, scale_labels } = req.body;
  try {
    if (is_active !== undefined && !question_text) {
      await db.prepare('UPDATE questions SET is_active = ? WHERE id = ?').run(is_active, parseInt(req.params.id));
    } else {
      const optionsStr = typeof options === 'string' ? options : JSON.stringify(options || []);
      await db.prepare('UPDATE questions SET pillar=?, question_text=?, response_type=?, options=?, scoring_logic=?, tooltip=?, scale_labels=?, is_active=? WHERE id=?').run(pillar, question_text, response_type, optionsStr, scoring_logic||'', tooltip||'', scale_labels||'', is_active !== undefined ? is_active : 1, parseInt(req.params.id));
    }
    res.json({ success: true });
  } catch(err) { res.status(500).json({ error: err.message }); }
}));


router.post("/questions/:id/move", requireAdmin, asyncHandler(async (req, res) => {
  const db = getDB();
  const { direction } = req.body;
  const q = await db.prepare("SELECT * FROM questions WHERE id = ?").get(parseInt(req.params.id));
  if (!q) return res.status(404).json({ error: "Not found" });
  const neighbor = direction === "up"
    ? await db.prepare("SELECT * FROM questions WHERE module_id = ? AND sort_order < ? ORDER BY sort_order DESC LIMIT 1").get(q.module_id, q.sort_order)
    : await db.prepare("SELECT * FROM questions WHERE module_id = ? AND sort_order > ? ORDER BY sort_order ASC LIMIT 1").get(q.module_id, q.sort_order);
  if (!neighbor) return res.json({ success: false, error: "Cannot move further" });
  await db.prepare("UPDATE questions SET sort_order = ?, question_number = ? WHERE id = ?").run(neighbor.sort_order, neighbor.question_number, q.id);
  await db.prepare("UPDATE questions SET sort_order = ?, question_number = ? WHERE id = ?").run(q.sort_order, q.question_number, neighbor.id);
  res.json({ success: true });
}));
router.delete('/questions/:id', requireAdmin, asyncHandler(async (req, res) => {
  const db = getDB();
  await db.prepare('DELETE FROM questions WHERE id = ?').run(parseInt(req.params.id));
  res.json({ success: true });
}));

router.get('/modules', requireAdmin, asyncHandler(async (req, res) => {
  const db = getDB();
  const modules = await db.prepare('SELECT * FROM modules ORDER BY module_number').all();
  const rules = await db.prepare('SELECT r.*, m.title as module_title, dm.title as depends_on_title FROM module_unlock_rules r JOIN modules m ON r.module_id = m.id LEFT JOIN modules dm ON r.depends_on_module_id = dm.id').all();
  res.render('admin/modules', { admin: req.admin, modules, rules });
}));

router.post('/modules/rules', requireAdmin, asyncHandler(async (req, res) => {
  const db = getDB();
  const { module_id, rule_type, depends_on_module_id, unlock_date } = req.body;
  try {
    await db.prepare('DELETE FROM module_unlock_rules WHERE module_id = ?').run(module_id);
    await db.prepare('INSERT INTO module_unlock_rules (module_id,rule_type,depends_on_module_id,unlock_date,is_active) VALUES (?,?,?,?,1)').run(module_id, rule_type, depends_on_module_id||null, unlock_date||null);
    res.json({ success: true });
  } catch(err) { res.status(500).json({ error: err.message }); }
}));

router.get('/responses', requireAdmin, asyncHandler(async (req, res) => {
  const db = getDB();
  const respondents = await db.prepare("SELECT u.id, u.username, u.first_name, u.last_name, u.organization, (SELECT COUNT(*) FROM responses WHERE user_id = u.id) as response_count, (SELECT MAX(submitted_at) FROM responses WHERE user_id = u.id) as last_response FROM users u WHERE u.role = 'respondent' AND u.id IN (SELECT DISTINCT user_id FROM responses) ORDER BY last_response DESC").all();
  res.render('admin/responses', { admin: req.admin, respondents });
}));

router.get('/responses/:userId', requireAdmin, asyncHandler(async (req, res) => {
  const db = getDB();
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(parseInt(req.params.userId));
  if (!user) return res.status(404).json({ error: 'User not found' });
  const responses = await db.prepare('SELECT r.*, q.question_text, q.pillar, q.response_type, q.question_number FROM responses r JOIN questions q ON r.question_id = q.id WHERE r.user_id = ? ORDER BY q.sort_order').all(parseInt(req.params.userId));
  res.json({ user: { first_name: user.first_name, last_name: user.last_name, organization: user.organization }, responses });
}));

module.exports = router;
