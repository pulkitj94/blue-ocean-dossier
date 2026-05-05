// db/update-questions.js — Run with: node db/update-questions.js
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

async function update() {
  console.log('Updating questions...\n');

  // Add tooltip column if not exists
  await pool.query('ALTER TABLE questions ADD COLUMN IF NOT EXISTS tooltip TEXT DEFAULT \'\'');

  const updates = [
    { num: 1, tooltip: 'e.g. A formal document approved by leadership outlining how AI supports revenue growth, cost reduction, or competitive advantage.' },
    { num: 2, tooltip: 'e.g. Use cases like demand forecasting, predictive maintenance, or automated quality inspection identified with timelines.' },
    { num: 3, tooltip: 'Production means live and delivering measurable value — not just proof-of-concept or pilot stage.' },
    { num: 4, tooltip: 'e.g. Tracking cost savings, revenue lift, or efficiency gains from each AI deployment with dashboards or reports.' },
    { num: 5, text: 'Which areas have your organization deployed or piloted AI? (Select all applicable)', tooltip: 'Select every department where AI tools or models are actively being used or tested.' },
    { num: 6, tooltip: 'Consider: Is your data in one place? Can teams access it easily? Is it clean, labelled, and up-to-date?' },
    { num: 7, tooltip: 'A centralized platform like a data lake or warehouse (e.g. Snowflake, Databricks, or a cloud-based data hub).' },
    { num: 8, tooltip: 'Connected means sensors/equipment sending data to a central system in real-time or near-real-time.' },
    { num: 9, tooltip: 'Cloud platforms provide scalable compute for training and running AI models (e.g. AWS SageMaker, Azure ML, GCP Vertex).' },
    { num: 10, tooltip: 'Integration means AI outputs feed directly into your ERP/MES/SCADA workflows — not just standalone dashboards.' },
    { num: 11, tooltip: 'Formal training includes certifications, courses, or structured programmes — not just self-learning or YouTube tutorials.' },
    { num: 12, tooltip: 'A dedicated team with roles like Data Scientist, ML Engineer, or AI Product Manager — not just IT staff doing AI on the side.' },
    { num: 13, tooltip: 'Experimentation includes hackathons, pilot projects, testing new AI tools, or running proof-of-concepts.' },
    { num: 14, tooltip: 'Governance policies cover ethical AI use, bias detection, model explainability, data privacy, and accountability frameworks.' },
    { num: 15, tooltip: 'Monitoring means regularly checking if deployed models still perform accurately and fairly over time.' },
    { num: 16, tooltip: 'Consider: Does the CEO/board actively champion AI? Is there executive sponsorship for AI initiatives?' },
    { num: 17, tooltip: 'Consider: Do factory/office workers see AI as a threat or an opportunity? Are they engaged in AI adoption?' },
    { num: 18, tooltip: 'Partners include consulting firms, AI startups, cloud providers, or system integrators helping with AI projects.' },
    { num: 19, tooltip: 'e.g. Industry forums, AI working groups, NASSCOM AI council, or sector-specific technology consortia.' },
    { num: 20, sort_order: 21, tooltip: 'Include all spend on AI/ML tools, cloud compute for AI, AI talent, and external AI vendors as % of total IT budget.' },
    { num: 21, text: 'Does your organization have a dedicated AI budget for the next 12-24 months?', sort_order: 20, tooltip: 'A dedicated budget means a specific line item approved for AI — not borrowed from general IT or innovation funds.' },
    { num: 22, text: 'What tangible business outcomes has your organization achieved via AI? (Select all applicable)', tooltip: 'Select outcomes where you can point to measurable results — even partial or early-stage wins count.' },
    { num: 23, tooltip: 'Think about the overall business impact: Has AI fundamentally changed how your organization operates?' },
    { num: 24, tooltip: 'Pick the three biggest obstacles preventing your organization from scaling AI faster.' },
    { num: 25, tooltip: 'Consider your board discussions, budget plans, and strategic priorities for the coming year.' },
  ];

  for (const u of updates) {
    let setClauses = ['tooltip = $1'];
    let params = [u.tooltip];
    let paramIdx = 2;

    if (u.text) {
      setClauses.push(`question_text = $${paramIdx}`);
      params.push(u.text);
      paramIdx++;
    }
    if (u.sort_order !== undefined) {
      setClauses.push(`sort_order = $${paramIdx}`);
      params.push(u.sort_order);
      paramIdx++;
    }

    params.push(u.num);
    const sql = `UPDATE questions SET ${setClauses.join(', ')} WHERE question_number = $${paramIdx}`;
    await pool.query(sql, params);
    console.log(`  ✅ Q${u.num} updated`);
  }

  console.log('\n🎉 All questions updated!');
  pool.end();
}

update().catch(e => { console.error(e); pool.end(); });