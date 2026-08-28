import express from 'express';
import multer from 'multer';
import { query } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { scoreVoiceAnswer, pingVoiceService } from '../services/voiceServiceClient.js';

const router = express.Router();

// Keep uploaded audio in memory (not disk) since we just forward it
// straight to the voice service — no need to persist it here too.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// POST /api/interview/warmup
// Call this the moment a candidate starts an interview session, so the
// Render free-tier container has a head start waking up before the
// candidate actually finishes recording their first answer.
router.post('/warmup', requireAuth, async (req, res) => {
  pingVoiceService(); // fire-and-forget — don't make the candidate wait on this
  res.json({ status: 'warming_up' });
});

// POST /api/interview/:attemptId/answer
// Accepts the candidate's recorded audio, forwards it to the voice-scoring
// microservice, and stores the resulting transcript + fluency scores.
router.post('/:attemptId/answer', requireAuth, upload.single('audio'), async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { questionId, questionType, referenceText } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'Audio file is required' });
    }
    if (!questionId || !questionType) {
      return res.status(400).json({ error: 'questionId and questionType are required' });
    }

    let scoringResult;
    try {
      scoringResult = await scoreVoiceAnswer(
        req.file.buffer,
        req.file.originalname || 'recording.webm',
        questionType,
        referenceText
      );
    } catch (err) {
      if (err.message === 'VOICE_SERVICE_TIMEOUT') {
        return res.status(504).json({
          error: 'The scoring service is taking longer than expected (it may still be waking up). Please try again in a moment.',
        });
      }
      throw err;
    }

    const { transcript, fluency_scores } = scoringResult;

    const result = await query(
      `INSERT INTO attempt_answers (attempt_id, question_id, transcript, score, fluency_details)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        attemptId,
        questionId,
        transcript,
        fluency_scores.final_score,
        JSON.stringify(fluency_scores), // full breakdown: clarity/pace/pause/filler scores
      ]
    );

    res.status(201).json({
      answer: result.rows[0],
      transcript,
      scores: fluency_scores,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to score your answer. Please try again.' });
  }
});

export default router;