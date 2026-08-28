import express from 'express';
import { query } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// GET /api/profile — user info + score per skill area (the dashboard data)
router.get('/', requireAuth, async (req, res) => {
  try {
    const userResult = await query(
      'SELECT id, name, email, college, role, created_at FROM users WHERE id = $1',
      [req.userId]
    );
    const user = userResult.rows[0];

    const scoresResult = await query(
      `SELECT sa.name AS skill_area, sa.type, uss.average_score, uss.attempts_count
       FROM user_skill_scores uss
       JOIN skill_areas sa ON uss.skill_area_id = sa.id
       WHERE uss.user_id = $1
       ORDER BY sa.name`,
      [req.userId]
    );

    // NOTE: aliased to "timestamp" because the Dashboard reads a.timestamp,
    // not a.completed_at. If you'd rather rename the frontend field instead,
    // just drop the alias here and update Dashboard.jsx to use completed_at.
    const recentAttemptsResult = await query(
      `SELECT ta.id, sa.name AS skill_area, ta.total_score, ta.completed_at AS timestamp
       FROM test_attempts ta
       JOIN skill_areas sa ON ta.skill_area_id = sa.id
       WHERE ta.user_id = $1 AND ta.completed_at IS NOT NULL
       ORDER BY ta.completed_at DESC
       LIMIT 10`,
      [req.userId]
    );

    // Overview stats for the top of the dashboard — previously never computed,
    // which is why Topics Practiced / Tests Taken / Average Score / Streak
    // always showed 0 regardless of activity.
    const overviewResult = await query(
      `SELECT
         COUNT(*) FILTER (WHERE completed_at IS NOT NULL) AS tests_taken,
         COUNT(DISTINCT skill_area_id) FILTER (WHERE completed_at IS NOT NULL) AS skills_practiced,
         AVG(total_score) FILTER (WHERE completed_at IS NOT NULL) AS average_score
       FROM test_attempts
       WHERE user_id = $1`,
      [req.userId]
    );
    const overview = overviewResult.rows[0];

    // Streak = consecutive calendar days (ending today or yesterday) with
    // at least one completed attempt.
    const streakDaysResult = await query(
      `SELECT DISTINCT DATE(completed_at) AS day
       FROM test_attempts
       WHERE user_id = $1 AND completed_at IS NOT NULL
       ORDER BY day DESC`,
      [req.userId]
    );

    let streak = 0;
    if (streakDaysResult.rows.length > 0) {
      const oneDay = 24 * 60 * 60 * 1000;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const mostRecent = new Date(streakDaysResult.rows[0].day);
      mostRecent.setHours(0, 0, 0, 0);

      const gapFromToday = Math.round((today - mostRecent) / oneDay);
      if (gapFromToday <= 1) {
        let expected = mostRecent;
        for (const row of streakDaysResult.rows) {
          const d = new Date(row.day);
          d.setHours(0, 0, 0, 0);
          if (d.getTime() === expected.getTime()) {
            streak++;
            expected = new Date(expected.getTime() - oneDay);
          } else if (d.getTime() < expected.getTime()) {
            break;
          }
        }
      }
    }

    res.json({
      user,
      skills_practiced: Number(overview.skills_practiced) || 0,
      tests_taken: Number(overview.tests_taken) || 0,
      average_score: overview.average_score !== null ? Number(overview.average_score) : 0,
      streak,
      scores: scoresResult.rows,
      recentAttempts: recentAttemptsResult.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

export default router;