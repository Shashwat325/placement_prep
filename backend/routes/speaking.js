import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { query } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { scoreTranscriptSimilarity, generateFeedback } from '../utils/Scoring.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();

// Store uploaded audio files on local disk under /uploads/audio,
// named with timestamp + original extension to avoid collisions.
const uploadDir = path.join(__dirname, '..', 'uploads', 'audio');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.webm';
    cb(null, `${Date.now()}-${req.userId}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB cap

// POST /api/speaking/:attemptId/answer
// Expects multipart/form-data with:
//   - audio: the recorded file
//   - questionId: which question this answers
//   - transcript: text from the browser's Web Speech API
router.post('/:attemptId/answer', requireAuth, upload.single('audio'), async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { questionId, transcript } = req.body;

    if (!questionId || !transcript) {
      return res.status(400).json({ error: 'questionId and transcript are required' });
    }

    const questionResult = await query('SELECT * FROM questions WHERE id = $1', [questionId]);
    const question = questionResult.rows[0];
    if (!question) return res.status(404).json({ error: 'Question not found' });

    // Reference text to compare against: the correct sentence for jumbled-sentence
    // exercises, or the original paragraph itself for repeat-paragraph exercises.
    const referenceText = question.correct_answer || question.prompt;

    const score = scoreTranscriptSimilarity(transcript, referenceText);
    const feedback = generateFeedback(score, transcript, referenceText);

    const audioUrl = req.file ? `/uploads/audio/${req.file.filename}` : null;

    const result = await query(
      `INSERT INTO attempt_answers (attempt_id, question_id, audio_url, transcript, score, feedback)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [attemptId, questionId, audioUrl, transcript, score, feedback]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to submit speaking answer' });
  }
});

export default router;