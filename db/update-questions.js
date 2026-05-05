// db/update-questions-v2.js — Run with: node db/update-questions-v2.js
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

async function update() {
  console.log('Updating all 25 questions with tooltips and scale labels...\n');

  // Add columns if not exist
  await pool.query('ALTER TABLE questions ADD COLUMN IF NOT EXISTS tooltip TEXT DEFAULT \'\'');
  await pool.query('ALTER TABLE questions ADD COLUMN IF NOT EXISTS scale_labels TEXT DEFAULT \'\'');

  const updates = [
    {
      num: 1,
      tooltip: 'e.g. A written plan approved by leadership that connects AI initiatives to specific business goals like revenue, efficiency, or customer experience.',
      scale_labels: JSON.stringify(['No plan','Early discussions','Strategy drafted','Partially integrated','Fully integrated'])
    },
    {
      num: 2,
      tooltip: 'e.g. Specific projects like demand forecasting, automated customer support, or quality inspection — with timelines and owners assigned.'
    },
    {
      num: 3,
      tooltip: 'Production means live and delivering measurable business value — not pilots, proofs-of-concept, or experiments still being tested.'
    },
    {
      num: 4,
      tooltip: 'e.g. Tracking metrics like cost saved, revenue generated, time reduced, or defects prevented for each AI deployment.',
      scale_labels: JSON.stringify(['No tracking','Anecdotal evidence','Basic metrics tracked','Formal ROI reviews','Real-time dashboards'])
    },
    {
      num: 5,
      text: 'Which areas have your organization deployed or piloted AI? (Select all applicable)',
      tooltip: 'Select every department or function where AI tools, models, or automation are actively being used or tested.'
    },
    {
      num: 6,
      tooltip: 'Consider: Is your data in one place? Can teams access it easily? Is it clean, consistent, and up-to-date?',
      scale_labels: JSON.stringify(['Siloed/poor','Fragmented','Partially unified','Mostly accessible','Unified/clean'])
    },
    {
      num: 7,
      tooltip: 'e.g. A centralized system like a data warehouse, data lake, or cloud platform where all key business data is stored and accessible.'
    },
    {
      num: 8,
      tooltip: 'Connected means equipment or sensors sending data to a central system automatically — in real-time or at regular intervals.'
    },
    {
      num: 9,
      tooltip: 'Cloud platforms provide scalable computing power for training and running AI models without needing to own hardware.'
    },
    {
      num: 10,
      tooltip: 'Integration means AI outputs feed directly into your operational systems and workflows — not just standalone reports or dashboards.'
    },
    {
      num: 11,
      tooltip: 'Formal training includes certifications, structured courses, or university programmes — not just self-learning or watching tutorials.'
    },
    {
      num: 12,
      tooltip: 'Dedicated roles like Data Scientist, ML Engineer, or AI Product Manager — not just IT staff handling AI as a side responsibility.'
    },
    {
      num: 13,
      tooltip: 'Experimentation includes trying new AI tools, running proof-of-concepts, hackathons, or pilot projects to test AI ideas.',
      scale_labels: JSON.stringify(['Never','Rarely (annually)','Occasionally (quarterly)','Regularly (monthly)','Monthly or more'])
    },
    {
      num: 14,
      tooltip: 'Governance policies define rules for ethical AI use, bias detection, transparency, data privacy, and who is accountable when AI makes decisions.'
    },
    {
      num: 15,
      tooltip: 'Monitoring means regularly checking if deployed AI models still perform accurately and fairly — catching issues before they cause business harm.'
    },
    {
      num: 16,
      tooltip: 'Consider: Does the CEO or board actively champion AI? Is there executive sponsorship and visible support for AI initiatives?',
      scale_labels: JSON.stringify(['Resistant','Skeptical','Open but cautious','Supportive','Champion'])
    },
    {
      num: 17,
      tooltip: 'Consider: Do employees on the ground see AI as a job threat or a productivity tool? Are they engaged and willing to adopt new tools?',
      scale_labels: JSON.stringify(['Fearful','Skeptical','Neutral','Open','Excited'])
    },
    {
      num: 18,
      tooltip: 'Partners include consulting firms, AI startups, cloud providers, or system integrators helping design, build, or deploy AI solutions.'
    },
    {
      num: 19,
      tooltip: 'e.g. Industry forums, AI working groups, technology councils, or sector-specific innovation networks where companies share AI best practices.'
    },
    {
      num: 20,
      text: 'Does your organization have a dedicated AI budget for the next 12-24 months?',
      tooltip: 'A dedicated budget means a specific approved line item for AI — not money borrowed from general IT or innovation budgets.',
      sort_order: 20
    },
    {
      num: 21,
      tooltip: 'Include all spending on AI/ML tools, cloud compute for AI, AI talent hiring, and external AI vendor contracts.',
      sort_order: 21
    },
    {
      num: 22,
      text: 'What tangible business outcomes has your organization achieved via AI? (Select all applicable)',
      tooltip: 'Select outcomes where you can point to measurable results — even early-stage or partial wins count.'
    },
    {
      num: 23,
      tooltip: 'Think about the overall business impact: Has AI fundamentally changed any part of how your organization operates day-to-day?',
      scale_labels: JSON.stringify(['No impact','Minor improvements','Moderate impact','Significant transformation','Game-changing'])
    },
    {
      num: 24,
      tooltip: 'Pick the three biggest obstacles that are slowing down or preventing your organization from adopting and scaling AI.'
    },
    {
      num: 25,
      tooltip: 'Consider your upcoming board discussions, budget planning cycles, and strategic priorities for the next fiscal year.',
      scale_labels: JSON.stringify(['Very unlikely','Unlikely','Possible','Likely','Very likely'])
    },
  ];

  for (const u of updates) {
    let setClauses = ['tooltip = $1'];
    let params = [u.tooltip];
    let idx = 2;

    if (u.text) {
      setClauses.push(`question_text = $${idx}`);
      params.push(u.text);
      idx++;
    }
    if (u.scale_labels) {
      setClauses.push(`scale_labels = $${idx}`);
      params.push(u.scale_labels);
      idx++;
    }
    if (u.sort_order !== undefined) {
      setClauses.push(`sort_order = $${idx}`);
      params.push(u.sort_order);
      idx++;
    }

    params.push(u.num);
    const sql = `UPDATE questions SET ${setClauses.join(', ')} WHERE question_number = $${idx}`;
    await pool.query(sql, params);
    console.log(`  ✅ Q${u.num} updated`);
  }

  console.log('\n🎉 All 25 questions updated with tooltips and scale labels!');
  pool.end();
}

update().catch(e => { console.error(e); pool.end(); });