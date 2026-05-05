const express = require('express');
const router = express.Router();
const path = require('path');
const { requireAuth } = require('../middleware/auth');
const { getDB } = require('../db/database');

async function evaluateUnlockRules(userId) {
  const db = getDB();
  const modules = await db.prepare(`SELECT m.*, COALESCE(ums.status, 'locked') as status FROM modules m LEFT JOIN user_module_status ums ON ums.module_id = m.id AND ums.user_id = ? ORDER BY m.module_number`).all(userId);
  const rules = await db.prepare('SELECT * FROM module_unlock_rules WHERE is_active = 1').all();

  for (const rule of rules) {
    if (rule.rule_type === 'after_module' && rule.depends_on_module_id) {
      const prereq = modules.find(m => m.id === rule.depends_on_module_id);
      if (prereq && prereq.status === 'complete') {
        const current = modules.find(m => m.id === rule.module_id);
        if (current && current.status === 'locked') {
          const existing = await db.prepare('SELECT status FROM user_module_status WHERE user_id=? AND module_id=?').get(userId, rule.module_id);
          if (!existing) {
            await db.prepare('INSERT INTO user_module_status (user_id,module_id,status) VALUES (?,?,?)').run(userId, rule.module_id, 'unlocked');
          } else if (existing.status === 'locked') {
            await db.prepare('UPDATE user_module_status SET status=? WHERE user_id=? AND module_id=?').run('unlocked', userId, rule.module_id);
          }
        }
      }
    }
    if (rule.rule_type === 'after_date' && rule.unlock_date) {
      if (new Date() >= new Date(rule.unlock_date)) {
        const existing = await db.prepare('SELECT status FROM user_module_status WHERE user_id=? AND module_id=?').get(userId, rule.module_id);
        if (!existing) {
          await db.prepare('INSERT INTO user_module_status (user_id,module_id,status) VALUES (?,?,?)').run(userId, rule.module_id, 'unlocked');
        } else if (existing.status === 'locked') {
          await db.prepare('UPDATE user_module_status SET status=? WHERE user_id=? AND module_id=?').run('unlocked', userId, rule.module_id);
        }
      }
    }
  }
}

router.get('/dashboard', requireAuth, async (req, res) => {
  await evaluateUnlockRules(req.user.id);
  const db = getDB();
  const modules = await db.prepare(`SELECT m.*, COALESCE(ums.status, 'locked') as status, ums.completed_at FROM modules m LEFT JOIN user_module_status ums ON ums.module_id = m.id AND ums.user_id = ? ORDER BY m.sort_order`).all(req.user.id);
  res.render('dashboard', { user: req.user, modules, customFields: {} });
});

router.get('/module/:number', requireAuth, async (req, res) => {
  const db = getDB();
  const mod = await db.prepare('SELECT * FROM modules WHERE module_number = ?').get(parseInt(req.params.number));
  if (!mod) return res.status(404).render('error', { message: 'Module not found' });
  
  const userStatus = await db.prepare('SELECT * FROM user_module_status WHERE user_id = ? AND module_id = ?').get(req.user.id, mod.id);
  if (!userStatus || userStatus.status === 'locked') return res.redirect('/dashboard');

  // Module 2 = Report → serve the PDF download page
  if (mod.module_type === 'report') {
    return res.render('report', { user: req.user, module: mod });
  }

  const questions = await db.prepare('SELECT * FROM questions WHERE module_id = ? AND is_active = 1 ORDER BY sort_order').all(mod.id);
  questions.forEach(q => { try { q.parsedOptions = JSON.parse(q.options); } catch(e) { q.parsedOptions = []; } });

  const existing = await db.prepare('SELECT question_id, answer FROM responses WHERE user_id = ? AND module_id = ?').all(req.user.id, mod.id);
  const responseMap = {};
  existing.forEach(r => { responseMap[r.question_id] = r.answer; });

  res.render('assessment', { user: req.user, module: mod, questions, responseMap, isComplete: userStatus.status === 'complete' });
});

// Module 2 PDF download endpoint
router.get('/module/2/download-pdf', requireAuth, async (req, res) => {
  // Check if the sample PDF exists, otherwise generate a placeholder
  const samplePdfPath = path.join(__dirname, '..', 'public', 'reports', 'sample-report.pdf');
  const fs = require('fs');
  
  if (fs.existsSync(samplePdfPath)) {
    return res.download(samplePdfPath, `AI-Maturity-Report-${req.user.username}.pdf`);
  }
  
  // No PDF uploaded yet — send a text response explaining
  res.setHeader('Content-Type', 'application/json');
  res.json({ message: 'PDF report not yet uploaded. Place your PDF at public/reports/sample-report.pdf' });
});

router.post('/module/:number/submit', requireAuth, async (req, res) => {
  const db = getDB();
  const mod = await db.prepare('SELECT * FROM modules WHERE module_number = ?').get(parseInt(req.params.number));
  if (!mod) return res.status(404).json({ error: 'Module not found' });

  const userStatus = await db.prepare('SELECT * FROM user_module_status WHERE user_id = ? AND module_id = ?').get(req.user.id, mod.id);
  if (!userStatus || userStatus.status === 'locked') return res.status(403).json({ error: 'Module is locked' });

  const answers = req.body.answers;
  if (!answers || typeof answers !== 'object') return res.status(400).json({ error: 'No answers provided' });

  // Save each answer
  for (const [questionId, answer] of Object.entries(answers)) {
    const answerStr = Array.isArray(answer) ? JSON.stringify(answer) : String(answer);
    let score = 0;
    if (!isNaN(answer)) score = parseFloat(answer);
    
    const exists = await db.prepare('SELECT id FROM responses WHERE user_id=? AND question_id=?').get(req.user.id, parseInt(questionId));
    if (exists) {
      await db.prepare('UPDATE responses SET answer=?, score=?, submitted_at=NOW() WHERE user_id=? AND question_id=?').run(answerStr, score, req.user.id, parseInt(questionId));
    } else {
      await db.prepare('INSERT INTO responses (user_id,question_id,module_id,answer,score) VALUES (?,?,?,?,?)').run(req.user.id, parseInt(questionId), mod.id, answerStr, score);
    }
  }

  // Mark module as complete
  await db.prepare('UPDATE user_module_status SET status=?, completed_at=NOW() WHERE user_id=? AND module_id=?').run('complete', req.user.id, mod.id);
  
  // Evaluate unlock rules
  await evaluateUnlockRules(req.user.id);

  res.json({ success: true, message: 'Assessment submitted successfully' });
});

router.get('/module/:number/responses', requireAuth, async (req, res) => {
  const db = getDB();
  const mod = await db.prepare('SELECT * FROM modules WHERE module_number = ?').get(parseInt(req.params.number));
  if (!mod) return res.status(404).render('error', { message: 'Module not found' });

  const questions = await db.prepare('SELECT * FROM questions WHERE module_id = ? AND is_active = 1 ORDER BY sort_order').all(mod.id);
  const responses = await db.prepare('SELECT * FROM responses WHERE user_id = ? AND module_id = ?').all(req.user.id, mod.id);
  const responseMap = {};
  responses.forEach(r => { responseMap[r.question_id] = r.answer; });
  questions.forEach(q => { try { q.parsedOptions = JSON.parse(q.options); } catch(e) { q.parsedOptions = []; } });

  res.render('responses', { user: req.user, module: mod, questions, responseMap });
});

module.exports = router;
