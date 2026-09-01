import express from 'express';
import { query } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
const router = express.Router();

// NOTE: this uses the same requireAuth as regular users — there's no
// admin/role system in your DB yet, so right now ANY logged-in user could
// technically reach these routes if they knew the URL. Fine for your own
// personal use while building, but worth adding a proper `role` column on
// `users` before this app has other real users.

// GET /api/admin/skill-areas — same data as the public one, reused here
router.get('/skill-areas', requireAuth, async (req, res) => {
  try {
    const result = await query('SELECT * FROM skill_areas ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch skill areas' });
  }
});

// GET /api/admin/topics?skill_area_id=1
router.get('/topics', requireAuth, async (req, res) => {
  try {
    const { skill_area_id } = req.query;
    if (!skill_area_id) return res.status(400).json({ error: 'skill_area_id is required' });

    const result = await query(
      'SELECT * FROM topics WHERE skill_area_id = $1 ORDER BY name',
      [skill_area_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch topics' });
  }
});

// POST /api/admin/topics — create a new topic under a skill area
router.post('/topics', requireAuth, async (req, res) => {
  try {
    const { skill_area_id, name } = req.body;
    if (!skill_area_id || !name?.trim()) {
      return res.status(400).json({ error: 'skill_area_id and name are required' });
    }

    const result = await query(
      'INSERT INTO topics (skill_area_id, name) VALUES ($1, $2) RETURNING *',
      [skill_area_id, name.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create topic' });
  }
});

// POST /api/admin/questions — add a new question of any type
router.post('/questions', requireAuth, async (req, res) => {
  try {
    const { topic_id, question_type, prompt, correct_answer, options, difficulty } = req.body;

    if (!topic_id || !question_type || !prompt?.trim()) {
      return res.status(400).json({ error: 'topic_id, question_type, and prompt are required' });
    }

    const result = await query(
      `INSERT INTO questions (topic_id, question_type, prompt, correct_answer, options, difficulty)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        topic_id,
        question_type,
        prompt.trim(),
        correct_answer || null,
        options ? JSON.stringify(options) : null,
        difficulty || 'medium',
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create question' });
  }
});
const csvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Shared insert loop, used by both /questions/bulk (JSON) and /questions/bulk-csv (file upload)
async function handleBulkInsert(questions, res) {
  const results = { inserted: 0, failed: [] };

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    try {
      const { skillAreaName, topicName, questionType, prompt, options, correctAnswer, difficulty } = q;

      if (!skillAreaName || !topicName || !questionType || !prompt || !correctAnswer) {
        throw new Error('Missing required field (skillAreaName, topicName, questionType, prompt, correctAnswer)');
      }
      const validTypes = ['mcq', 'jumbled_sentence', 'repeat_paragraph', 'summarize_paragraph'];
      if (!validTypes.includes(questionType)) {
        throw new Error(`Invalid question_type: ${questionType}`);
      }
      if (questionType === 'mcq' && (!Array.isArray(options) || options.length < 2)) {
        throw new Error('mcq requires at least 2 options');
      }

      // Your questions table takes topic_id directly (no skill_area_id column),
      // so resolve topic_id by joining on skill area name + topic name together —
      // this also guards against two skill areas having a same-named topic.
      const topicResult = await query(
        `SELECT t.id FROM topics t
         JOIN skill_areas sa ON t.skill_area_id = sa.id
         WHERE sa.name = $1 AND t.name = $2`,
        [skillAreaName, topicName]
      );
      if (topicResult.rows.length === 0) {
        throw new Error(`Unknown skill area/topic combination: ${skillAreaName} / ${topicName}`);
      }
      const topicId = topicResult.rows[0].id;

      await query(
        `INSERT INTO questions (topic_id, question_type, prompt, correct_answer, options, difficulty)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          topicId,
          questionType,
          prompt,
          correctAnswer,
          options ? JSON.stringify(options) : null,
          difficulty || 'medium',
        ]
      );

      results.inserted++;
    } catch (err) {
      results.failed.push({ row: i + 1, question: q.prompt || '(no prompt)', reason: err.message });
    }
  }

  res.status(results.failed.length ? 207 : 201).json(results);
}

// POST /api/admin/questions/bulk — JSON body: { questions: [{...}, ...] }
router.post('/questions/bulk', requireAuth, async (req, res) => {
  const { questions } = req.body;
  if (!Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ error: 'questions array is required' });
  }
  return handleBulkInsert(questions, res);
});

// POST /api/admin/questions/bulk-csv — multipart file upload, field name "file"
router.post('/questions/bulk-csv', requireAuth, csvUpload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'CSV file is required' });

  let rows;
  try {
    rows = parse(req.file.buffer.toString('utf-8'), { columns: true, skip_empty_lines: true, trim: true });
  } catch (err) {
    return res.status(400).json({ error: `Failed to parse CSV: ${err.message}` });
  }

  const questions = rows.map((r) => ({
    skillAreaName: r.skill_area_name,
    topicName: r.topic_name,
    questionType: r.question_type,
    prompt: r.prompt,
    options: r.options ? r.options.split('|').map((o) => o.trim()) : null,
    correctAnswer: r.correct_answer,
    difficulty: r.difficulty || null,
  }));

  return handleBulkInsert(questions, res);
});

export default router;