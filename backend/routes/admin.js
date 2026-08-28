import express from 'express';
import { query } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

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

export default router;