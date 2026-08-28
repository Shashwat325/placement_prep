-- =========================================================
-- Placement Prep Platform — Postgres Schema
-- =========================================================

-- Users
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    college VARCHAR(150),
    created_at TIMESTAMP DEFAULT NOW()
);
ALTER TABLE users ADD role VARCHAR(20) DEFAULT 'user';
UPDATE users SET role = 'admin' WHERE email = 'shashwatjaiswal325@gmail.com';

-- Skill areas (Quant, Logical Reasoning, Verbal, Pronunciation, etc.)
CREATE TABLE skill_areas (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,      -- e.g. 'Quantitative Aptitude'
    type VARCHAR(20) NOT NULL               -- 'aptitude' | 'speaking'
);

-- Question categories/topics under a skill area (e.g. Percentages, Time & Work)
CREATE TABLE topics (
    id SERIAL PRIMARY KEY,
    skill_area_id INTEGER NOT NULL REFERENCES skill_areas(id),
    name VARCHAR(100) NOT NULL
);

-- Questions table — handles both aptitude (MCQ) and speaking exercises
CREATE TABLE questions (
    id SERIAL PRIMARY KEY,
    topic_id INTEGER NOT NULL REFERENCES topics(id),
    question_type VARCHAR(30) NOT NULL,     -- 'mcq' | 'jumbled_sentence' | 'repeat_paragraph' | 'summarize_paragraph'
    prompt TEXT NOT NULL,                   -- the question text / paragraph / jumbled sentence
    correct_answer TEXT,                    -- correct MCQ option or correct sentence (null for open-ended)
    options JSONB,                          -- for MCQs: ["A", "B", "C", "D"]
    difficulty VARCHAR(20) DEFAULT 'medium',-- 'easy' | 'medium' | 'hard'
    created_at TIMESTAMP DEFAULT NOW()
);

-- A test attempt = one sitting where a user answers a set of questions
CREATE TABLE test_attempts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    skill_area_id INTEGER NOT NULL REFERENCES skill_areas(id),
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    total_score NUMERIC(5,2)
);

-- Individual answers within an attempt
CREATE TABLE attempt_answers (
    id SERIAL PRIMARY KEY,
    attempt_id INTEGER NOT NULL REFERENCES test_attempts(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES questions(id),
    text_answer TEXT,                       -- typed/corrected answer (for jumbled sentence text step)
    audio_url TEXT,                         -- stored recording URL (for speaking exercises)
    transcript TEXT,                        -- speech-to-text output
    score NUMERIC(5,2),                     -- score for this specific answer
    feedback TEXT,                          -- AI-generated feedback for this answer
    answered_at TIMESTAMP DEFAULT NOW()
);

-- Aggregated per-user, per-skill-area score (updated after each attempt)
-- Lets the profile page load fast without recomputing from every attempt.
CREATE TABLE user_skill_scores (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    skill_area_id INTEGER NOT NULL REFERENCES skill_areas(id),
    average_score NUMERIC(5,2) DEFAULT 0,
    attempts_count INTEGER DEFAULT 0,
    last_updated TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, skill_area_id)
);

-- Helpful indexes for common queries
CREATE INDEX idx_attempts_user ON test_attempts(user_id);
CREATE INDEX idx_answers_attempt ON attempt_answers(attempt_id);
CREATE INDEX idx_questions_topic ON questions(topic_id);
CREATE INDEX idx_scores_user ON user_skill_scores(user_id);