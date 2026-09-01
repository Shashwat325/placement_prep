import express from 'express';
import { query } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import multer from 'multer';
import { parse } from 'csv-parse/sync';

const router = express.Router();

// GET /api/questions/skill-areas — list all skill areas (Quant, Verbal, Pronunciation, etc.)
router.get('/skill-areas', async (req, res) => {
  const result = await query('SELECT * FROM skill_areas ORDER BY name');
  res.json(result.rows);
});

// GET /api/questions/topics?skillAreaId=1 — list topics under a skill area,
// with how many questions each one has (so empty topics can be shown as such)
router.get('/topics', requireAuth, async (req, res) => {
  try {
    const { skillAreaId } = req.query;

    if (!skillAreaId) {
      return res.status(400).json({ error: 'skillAreaId is required' });
    }

    const result = await query(
      `SELECT t.id, t.name, COUNT(q.id) AS question_count
       FROM topics t
       LEFT JOIN questions q ON q.topic_id = t.id
       WHERE t.skill_area_id = $1
       GROUP BY t.id, t.name
       ORDER BY t.name`,
      [skillAreaId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch topics' });
  }
});

// GET /api/questions?skillAreaId=1&topicId=2&limit=10 — fetch a batch of
// questions to attempt. topicId is optional — omit it to pull from every
// topic under the skill area (kept for backward compatibility).
router.get('/', requireAuth, async (req, res) => {
  try {
    const { skillAreaId, topicId, limit = 10 } = req.query;

    if (!skillAreaId) {
      return res.status(400).json({ error: 'skillAreaId is required' });
    }

    // Build the shared WHERE clause + params once, since both branches below
    // (small pool vs. large pool) need the same filtering.
    let whereClause = 't.skill_area_id = $1';
    const baseParams = [skillAreaId];
    if (topicId) {
      whereClause += ' AND t.id = $2';
      baseParams.push(topicId);
    }

    // Get total count of questions for this skill area (and topic, if given) first
    const countResult = await query(
      `SELECT COUNT(*) AS total
       FROM questions q
       JOIN topics t ON q.topic_id = t.id
       WHERE ${whereClause}`,
      baseParams
    );

    const totalQuestions = parseInt(countResult.rows[0].total);
    const effectiveLimit = Math.min(limit, totalQuestions);

    // For better performance on large tables, we use a more efficient random sampling
    // technique: select a random offset and fetch the limit, then shuffle
    // Note: For very large tables, consider maintaining a separate table of question IDs for true randomness
    let result;

    if (totalQuestions <= effectiveLimit * 3) {
      // For small pools, use ORDER BY RANDOM() (acceptable performance)
      const limitParamIndex = baseParams.length + 1;
      result = await query(
        `SELECT q.id, q.question_type, q.prompt, q.correct_answer, q.options, q.difficulty, t.name AS topic
         FROM questions q
         JOIN topics t ON q.topic_id = t.id
         WHERE ${whereClause}
         ORDER BY RANDOM()
         LIMIT $${limitParamIndex}`,
        [...baseParams, effectiveLimit]
      );
    } else {
      // For larger pools, use more efficient random sampling
      // Get a random starting point and fetch consecutive questions
      const randomOffset = Math.floor(Math.random() * Math.max(0, totalQuestions - effectiveLimit));
      const limitParamIndex = baseParams.length + 1;
      const offsetParamIndex = baseParams.length + 2;

      result = await query(
        `SELECT q.id, q.question_type, q.prompt, q.correct_answer, q.options, q.difficulty, t.name AS topic
         FROM questions q
         JOIN topics t ON q.topic_id = t.id
         WHERE ${whereClause}
         ORDER BY q.id
         LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}`,
        [...baseParams, effectiveLimit, randomOffset]
      );

      // Shuffle the results for better randomness distribution
      // Fisher-Yates shuffle algorithm
      for (let i = result.rows.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result.rows[i], result.rows[j]] = [result.rows[j], result.rows[i]];
      }
    }

    // correct_answer is needed by the frontend for repeat_paragraph (the
    // sentence to read) and jumbled_sentence (the scoring reference) — but
    // for mcq it IS the answer, so strip it before it reaches the client.
    const rows = result.rows.map((row) => {
      if (row.question_type === 'mcq') {
        const { correct_answer, ...rest } = row;
        return rest;
      }
      return row;
    });

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});
const csvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
// Shared insert loop, used by both /bulk (JSON) and /bulk-csv (file upload)
async function handleBulkInsert(questions, res) {
  const results = { inserted: 0, failed: [] };

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    try {
      const { skillAreaName, topicName, questionType, prompt, options, correctAnswer } = q;

      if (!skillAreaName || !questionType || !prompt || !correctAnswer) {
        throw new Error('Missing required field (skillAreaName, questionType, prompt, correctAnswer)');
      }
      const validTypes = ['mcq', 'jumbled_sentence', 'repeat_paragraph', 'summarize_paragraph'];
      if (!validTypes.includes(questionType)) {
        throw new Error(`Invalid question_type: ${questionType}`);
      }
      if (questionType === 'mcq' && (!Array.isArray(options) || options.length < 2)) {
        throw new Error('mcq requires at least 2 options');
      }

      const skillAreaResult = await query('SELECT id FROM skill_areas WHERE name = $1', [skillAreaName]);
      if (skillAreaResult.rows.length === 0) throw new Error(`Unknown skill area: ${skillAreaName}`);
      const skillAreaId = skillAreaResult.rows[0].id;

      let topicId = null;
      if (topicName) {
        const topicResult = await query(
          'SELECT id FROM topics WHERE name = $1 AND skill_area_id = $2',
          [topicName, skillAreaId]
        );
        if (topicResult.rows.length === 0) throw new Error(`Unknown topic: ${topicName}`);
        topicId = topicResult.rows[0].id;
      }

      await query(
        `INSERT INTO questions (skill_area_id, topic_id, question_type, prompt, options, correct_answer)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [skillAreaId, topicId, questionType, prompt, options ? JSON.stringify(options) : null, correctAnswer]
      );

      results.inserted++;
    } catch (err) {
      results.failed.push({ row: i + 1, question: q.prompt || '(no prompt)', reason: err.message });
    }
  }

  res.status(results.failed.length ? 207 : 201).json(results);
}

// POST /bulk — JSON body (unchanged behavior, now uses the shared function)
router.post('/bulk', requireAuth, async (req, res) => {
  const { questions } = req.body;
  if (!Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ error: 'questions array is required' });
  }
  return handleBulkInsert(questions, res);
});

// POST /bulk-csv — multipart file upload, field name "file"
router.post('/bulk-csv', requireAuth, csvUpload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'CSV file is required' });

  let rows;
  try {
    rows = parse(req.file.buffer.toString('utf-8'), { columns: true, skip_empty_lines: true, trim: true });
  } catch (err) {
    return res.status(400).json({ error: `Failed to parse CSV: ${err.message}` });
  }

  const questions = rows.map((r) => ({
    skillAreaName: r.skill_area_name,
    topicName: r.topic_name || null,
    questionType: r.question_type,
    prompt: r.prompt,
    options: r.options ? r.options.split('|').map((o) => o.trim()) : null,
    correctAnswer: r.correct_answer,
  }));

  return handleBulkInsert(questions, res);
});
export default router;