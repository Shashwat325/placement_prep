-- Run this in Supabase's SQL Editor to add support for storing the full
-- fluency score breakdown from the voice-scoring microservice.

ALTER TABLE attempt_answers
ADD COLUMN IF NOT EXISTS fluency_details JSONB;