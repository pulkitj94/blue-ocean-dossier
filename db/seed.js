// db/seed.js — Run with: npm run seed
require('dotenv').config();
const { initDatabase } = require('./database');
const bcrypt = require('bcryptjs');

async function seed() {
  const db = await initDatabase();
  console.log('🌊 Seeding Blue Ocean Dossier database...\n');

  // Helper: insert if not exists (PostgreSQL ON CONFLICT)
  const pool = require('./database');

  // 1. Admin user
  const adminHash = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'BlueOcean2026!', 10);
  try { await db.prepare("INSERT INTO users (username,password_hash,first_name,last_name,role) VALUES (?,?,?,?,'admin') ON CONFLICT (username) DO NOTHING").run('admin', adminHash, 'Admin', 'User'); } catch(e) { console.log('  Admin user exists, skipping.'); }
  console.log('✅ Admin user created (admin / BlueOcean2026!)');

  // 2. Modules
  const mods = [
    [1,'AI Maturity Assessment','Pre-workshop','Twenty-five questions across five pillars. Your responses power every downstream module in this dossier.','assessment',1,1],
    [2,'Maturity Report','Pre-workshop','Your personalised eight-page dossier, benchmarked against the cohort and global leaders.','report',0,2],
    [3,'Opportunity Canvas','Afternoon','Seven-field structured canvas. Identifies your 90-day bet.','canvas',0,3],
    [4,'Ninety-Day Plan','Afternoon','Generated from your canvas. Milestones at 30, 60, 90 days with risks and guardrails.','plan',0,4],
    [5,'Commitment Wall','Closing','One public commitment. Metric + date. Displayed in the room at 4:25 PM.','commitment',0,5],
    [6,'Office Hours','Post-event','Fifteen-minute slots with GLT leads over the six weeks following.','booking',0,6],
  ];
  for (const m of mods) {
    try { await db.prepare('INSERT INTO modules (module_number,title,subtitle,description,module_type,is_default_unlocked,sort_order) VALUES (?,?,?,?,?,?,?) ON CONFLICT (module_number) DO NOTHING').run(...m); } catch(e){}
  }
  console.log('✅ 6 modules created');

  // Get module IDs
  const g = async (n) => await db.prepare('SELECT id FROM modules WHERE module_number = ?').get(n);
  const m1=await g(1), m2=await g(2), m3=await g(3), m4=await g(4), m5=await g(5), m6=await g(6);

  // 3. Unlock rules
  // Clear existing first
  try { await db.exec('DELETE FROM module_unlock_rules'); } catch(e) {}
  const ar = async (mid,t,d) => { try { await db.prepare('INSERT INTO module_unlock_rules (module_id,rule_type,depends_on_module_id,is_active) VALUES (?,?,?,1)').run(mid,t,d); } catch(e){} };
  if(m1&&m2) await ar(m2.id,'after_module',m1.id);
  if(m2&&m3) await ar(m3.id,'after_module',m2.id);
  if(m3&&m4) await ar(m4.id,'after_module',m3.id);
  if(m5) await ar(m5.id,'manual',null);
  if(m6) await ar(m6.id,'manual',null);
  console.log('✅ Unlock rules created');

  // 4. Questions (only if none exist for module 1)
  const existingQ = await db.prepare('SELECT COUNT(*) as count FROM questions WHERE module_id = ?').get(m1.id);
  if (existingQ.count == 0) {
    const qs = [
      {n:1,p:'Strategy & Vision',t:'Does your organization have a documented AI strategy aligned with business goals?',r:'scale',o:'[]',s:'1=No plan, 5=Fully integrated'},
      {n:2,p:'Strategy & Vision',t:'Has leadership identified 3+ priority use cases for AI in the next 12 months?',r:'single_select',o:'["Yes","Partially","No"]',s:'Yes=5, Partially=3, No=1'},
      {n:3,p:'Use Cases & ROI',t:'How many AI use cases are currently in production (live, delivering value)?',r:'single_select',o:'["0","1-2","3-5","6+"]',s:'0=1, 1-2=3, 3-5=4, 6+=5'},
      {n:4,p:'Use Cases & ROI',t:'Does your organization measure ROI or business impact for deployed AI solutions?',r:'scale',o:'[]',s:'1=No tracking, 5=Real-time dashboards'},
      {n:5,p:'Use Cases & ROI',t:'Which areas have your organization deployed or piloted AI? (Select all)',r:'multi_select',o:'["Supply Chain","Marketing","Finance","HR","Operations","R&D","Customer Service","Sales","Other"]',s:'Count domains, max 5 points'},
      {n:6,p:'Data & Infrastructure',t:'How would you rate the quality and accessibility of your production data?',r:'scale',o:'[]',s:'1=Siloed/poor, 5=Unified/clean'},
      {n:7,p:'Data & Infrastructure',t:'Does your organization have a centralized data platform or data lake for manufacturers data?',r:'single_select',o:'["Yes","In progress","No"]',s:'Yes=5, In progress=3, No=1'},
      {n:8,p:'Data & Infrastructure',t:'What % of your equipment/sensors are connected and streaming data?',r:'single_select',o:'["0-25%","26-50%","51-75%","76-100%"]',s:'Scale linearly 1-5'},
      {n:9,p:'Technology & Tools',t:'Does your organization use cloud platforms (AWS, Azure, GCP) for AI workloads?',r:'single_select',o:'["Yes","Partially","No"]',s:'Yes=5, Partially=3, No=1'},
      {n:10,p:'Technology & Tools',t:'Has your organization integrated AI with existing ERP/MES/SCADA systems?',r:'single_select',o:'["Yes","In progress","No"]',s:'Yes=5, In progress=3, No=1'},
      {n:11,p:'People & Skills',t:'How many employees have formal AI/ML training or certification?',r:'single_select',o:'["0","1-5","6-20","21+"]',s:'Scale 1-5'},
      {n:12,p:'People & Skills',t:'Does your organization have dedicated AI/data science team or roles?',r:'single_select',o:'["Yes","Partially","No"]',s:'Yes=5, Partially=3, No=1'},
      {n:13,p:'People & Skills',t:'How often do your teams experiment with AI tools or pilots?',r:'scale',o:'[]',s:'1=Never, 5=Monthly or more'},
      {n:14,p:'Governance & Ethics',t:'Does your organization have AI governance policies (ethics, bias, explainability)?',r:'single_select',o:'["Yes","In draft","No"]',s:'Yes=5, In draft=3, No=1'},
      {n:15,p:'Governance & Ethics',t:'Are AI models monitored for performance drift or bias post-deployment?',r:'single_select',o:'["Yes","Partially","No"]',s:'Yes=5, Partially=3, No=1'},
      {n:16,p:'Change Management',t:'How supportive is senior leadership of AI investments?',r:'scale',o:'[]',s:'1=Resistant, 5=Champion'},
      {n:17,p:'Change Management',t:'How do frontline workers perceive AI adoption?',r:'scale',o:'[]',s:'1=Fearful, 5=Excited'},
      {n:18,p:'Vendor & Ecosystem',t:'Does your organization work with AI vendors, consultants, or technology partners?',r:'single_select',o:'["Yes","Exploring","No"]',s:'Yes=5, Exploring=3, No=1'},
      {n:19,p:'Vendor & Ecosystem',t:'Is your organization part of industry AI communities or consortia?',r:'single_select',o:'["Yes","No"]',s:'Yes=5, No=1'},
      {n:20,p:'Investment & Budget',t:'What % of annual IT/innovation budget is allocated to AI?',r:'single_select',o:'["0%","<5%","5-10%",">10%"]',s:'Scale 1-5'},
      {n:21,p:'Investment & Budget',t:'Has your organization secured dedicated AI budget for next 12-24 months?',r:'single_select',o:'["Yes","Partially","No"]',s:'Yes=5, Partially=3, No=1'},
      {n:22,p:'Outcomes & Impact',t:'What tangible business outcomes has your organization achieved via AI? (Select all)',r:'multi_select',o:'["Cost Reduction","Revenue Growth","Quality Improvement","Faster Time-to-Market","Better Customer Experience","Predictive Maintenance","None Yet"]',s:'Count outcomes, max 5 points'},
      {n:23,p:'Outcomes & Impact',t:'On a scale of 1-5, how transformative has AI been for your operations?',r:'scale',o:'[]',s:'Direct score'},
      {n:24,p:'Barriers & Challenges',t:'What are your top 3 barriers to AI adoption? (Select up to 3)',r:'multi_select',o:'["Lack of Data","Talent Gap","Budget Constraints","Leadership Buy-in","Legacy Systems","Regulatory Concerns","Cultural Resistance","Unclear ROI","Vendor Lock-in"]',s:'Flag common barriers'},
      {n:25,p:'Future Intent',t:'How likely is your organization to increase AI investment in next 12 months?',r:'scale',o:'[]',s:'1=Very unlikely, 5=Very likely'},
    ];
    for (const q of qs) {
      await db.prepare('INSERT INTO questions (module_id,question_number,pillar,question_text,response_type,options,scoring_logic,sort_order) VALUES (?,?,?,?,?,?,?,?)').run(m1.id,q.n,q.p,q.t,q.r,q.o,q.s,q.n);
    }
    console.log('✅ 25 questions created');
  } else {
    console.log('✅ Questions already exist, skipping');
  }

  console.log('\n🎉 Done! Run "npm start" to launch.\n');
  process.exit(0);
}
seed().catch(err => { console.error(err); process.exit(1); });
