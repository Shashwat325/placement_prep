-- Run after schema.sql to get some starter data

INSERT INTO skill_areas (name, type) VALUES
    ('Quantitative Aptitude', 'aptitude'),
    ('Logical Reasoning', 'aptitude'),
    ('Verbal Ability', 'aptitude'),
    ('Spoken English', 'speaking'),
    ('Pronunciation', 'speaking');

INSERT INTO topics (skill_area_id, name) VALUES
    (1, 'Percentages'),
    (1, 'Time and Work'),
    (2, 'Blood Relations'),
    (4, 'Sentence Correction'),
    (5, 'Paragraph Reading');

-- Sample MCQ
INSERT INTO questions (topic_id, question_type, prompt, correct_answer, options, difficulty) VALUES
    (1, 'mcq', 'If 20% of a number is 50, what is the number?', '250',
     '["150", "200", "250", "300"]', 'easy');

-- Sample jumbled sentence exercise
INSERT INTO questions (topic_id, question_type, prompt, correct_answer, difficulty) VALUES
    (4, 'jumbled_sentence', 'to / going / market / I / the / am',
     'I am going to the market', 'easy');

-- Sample paragraph repeat exercise
INSERT INTO questions (topic_id, question_type, prompt, difficulty) VALUES
    (5, 'repeat_paragraph',
     'Effective communication is the foundation of professional success. It involves not just speaking clearly, but also listening actively and responding thoughtfully.',
     'medium');