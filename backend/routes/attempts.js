import express from 'express';
import multer from 'multer';
import { query } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { scoreTranscriptSimilarity } from '../utils/scoring.js';
import { scoreVoiceAnswer } from '../services/voiceServiceClient.js';

const router = express.Router();

// Memory storage, not disk — we forward the audio straight to the
// voice-scoring-service, we don't need to keep a copy on this server.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// POST /api/attempts/start
router.post('/start', requireAuth, async (req, res) => {
  try {
    const { skillAreaId } = req.body;
    const result = await query(
      `INSERT INTO test_attempts (user_id, skill_area_id) VALUES ($1, $2) RETURNING id, started_at`,
      [req.userId, skillAreaId]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to start attempt' });
  }
});

// POST /api/attempts/:attemptId/answer
router.post('/:attemptId/answer', requireAuth, upload.single('audio'), async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { questionId, textAnswer } = req.body;

    const questionResult = await query('SELECT * FROM questions WHERE id = $1', [questionId]);
    const question = questionResult.rows[0];
    if (!question) return res.status(404).json({ error: 'Question not found' });

    let score = null;
    let feedback = null;
    let transcript = null;
    let parameterScores = null; // { pronunciation, fluency, speed, correctness }

    if (question.question_type === 'mcq') {
      score = textAnswer?.trim() === question.correct_answer?.trim() ? 100 : 0;
    } else if (question.question_type === 'jumbled_sentence' && !req.file) {
      // Text-only correction (no speaking involved) — simple exact match
      score = textAnswer?.trim() === question.correct_answer?.trim() ? 100 : 0;
      feedback = score === 100 ? 'Correct! Well done.' : `Not quite. The correct sentence is: "${question.correct_answer}"`;
    } else {
      // Any spoken exercise: jumbled_sentence (spoken), repeat_paragraph, summarize_paragraph
      if (!req.file) {
        return res.status(400).json({ error: 'Audio recording is required for this question type' });
      }

      const referenceText = question.correct_answer || question.prompt;

      let voiceResult;
      try {
        voiceResult = await scoreVoiceAnswer(
          req.file.buffer,
          req.file.originalname || 'recording.webm',
          question.question_type,
          referenceText
        );
      } catch (err) {
        if (err.message === 'VOICE_SERVICE_TIMEOUT') {
          return res.status(504).json({
            error: 'Voice scoring is taking longer than expected (the service may be waking up). Please try again shortly.',
          });
        }
        // The voice service correctly rejects clips too short/quiet to analyze —
        // surface this as a clear, actionable message instead of a generic 500.
        const detail = err.response?.data?.detail || '';
        if (detail.includes('Insufficient words') || detail.includes('No speech detected')) {
          return res.status(400).json({
            error: 'Your recording was too short or unclear to score. Please try recording again, speaking a bit longer and clearly.',
          });
        }
        throw err;
      }

      transcript = voiceResult.transcript;
      const fs = voiceResult.fluency_scores;

      // Map the voice service's output onto your four named parameters:
      // - pronunciation: how clearly/confidently words were recognized (Whisper confidence)
      // - speed: how close to a natural speaking pace
      // - fluency: smoothness of delivery — combines pausing and filler-word behavior
      // - correctness: how closely the actual words match the expected content
      const pronunciation = fs.clarity_score;
      const speed = fs.wpm_score;
      const fluency = (fs.pause_score + fs.filler_score) / 2;
      const correctness = scoreTranscriptSimilarity(transcript, referenceText);

      parameterScores = { pronunciation, fluency, speed, correctness };

      // Per-question total: simple average of all four parameters
      score = Math.round((pronunciation + fluency + speed + correctness) / 4);

      feedback = score >= 80
        ? 'Strong answer across pronunciation, pace, fluency, and content accuracy.'
        : score >= 55
          ? 'Decent attempt — check the parameter breakdown to see what to work on.'
          : 'This needs work — review the parameter breakdown below for specifics.';
    }

    const result = await query(
      `INSERT INTO attempt_answers (attempt_id, question_id, text_answer, transcript, score, feedback, fluency_details)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        attemptId,
        questionId,
        textAnswer || null,
        transcript,
        score,
        feedback,
        parameterScores ? JSON.stringify(parameterScores) : null,
      ]
    );

    res.status(201).json({ ...result.rows[0], parameterScores });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to submit answer' });
  }
});

// POST /api/attempts/:attemptId/complete
// Averages the per-question `score` (each already an avg of 4 parameters)
// across all questions in this attempt — this IS your "avg of 3 questions"
// final score, automatically, as long as each per-question score is correct.
router.post('/:attemptId/complete', requireAuth, async (req, res) => {
  try {
    const { attemptId } = req.params;

    const attemptResult = await query(
      'SELECT * FROM test_attempts WHERE id = $1 AND user_id = $2',
      [attemptId, req.userId]
    );
    const attempt = attemptResult.rows[0];
    if (!attempt) return res.status(404).json({ error: 'Attempt not found' });

    // Overall average score (existing behavior)
    const avgResult = await query(
      'SELECT AVG(score) AS avg_score FROM attempt_answers WHERE attempt_id = $1 AND score IS NOT NULL',
      [attemptId]
    );
    const totalScore = avgResult.rows[0].avg_score || 0;

    // NEW: also compute the per-parameter averages across all questions in
    // this attempt, for a detailed breakdown (not just one final number).
    const detailsResult = await query(
      `SELECT fluency_details FROM attempt_answers
       WHERE attempt_id = $1 AND fluency_details IS NOT NULL`,
      [attemptId]
    );

    let parameterAverages = null;
    if (detailsResult.rows.length > 0) {
      const totals = { pronunciation: 0, fluency: 0, speed: 0, correctness: 0 };
      const rows = detailsResult.rows;
      for (const row of rows) {
        const d = row.fluency_details; // already parsed as JS object by pg for JSONB columns
        totals.pronunciation += d.pronunciation;
        totals.fluency += d.fluency;
        totals.speed += d.speed;
        totals.correctness += d.correctness;
      }
      const n = rows.length;
      parameterAverages = {
        pronunciation: Math.round(totals.pronunciation / n),
        fluency: Math.round(totals.fluency / n),
        speed: Math.round(totals.speed / n),
        correctness: Math.round(totals.correctness / n),
      };
    }

    await query(
      `UPDATE test_attempts SET completed_at = NOW(), total_score = $1 WHERE id = $2`,
      [totalScore, attemptId]
    );

    await query(
      `INSERT INTO user_skill_scores (user_id, skill_area_id, average_score, attempts_count, last_updated)
       VALUES ($1, $2, $3, 1, NOW())
       ON CONFLICT (user_id, skill_area_id)
       DO UPDATE SET
         average_score = ((user_skill_scores.average_score * user_skill_scores.attempts_count) + $3)
                         / (user_skill_scores.attempts_count + 1),
         attempts_count = user_skill_scores.attempts_count + 1,
         last_updated = NOW()`,
      [req.userId, attempt.skill_area_id, totalScore]
    );

    res.json({ attemptId, totalScore, parameterAverages });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to complete attempt' });
  }
});

export default router;