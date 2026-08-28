// Scores how closely a spoken transcript matches the expected/reference text.
// Used for jumbled-sentence correction and paragraph-repeat exercises.

// Normalizes text for comparison: lowercase, strip punctuation, collapse whitespace.
function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[.,!?;:'"()-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Word-level Levenshtein distance — treats each word as a unit rather than
// each character, which gives a much more meaningful score for spoken sentences
// (a single missed word shouldn't tank the score the way a typo would char-by-char).
function wordLevenshtein(wordsA, wordsB) {
  const m = wordsA.length;
  const n = wordsB.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (wordsA[i - 1] === wordsB[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

// Returns a score 0-100 based on how close the spoken transcript is to the
// reference text. 100 = exact match, lower scores for missing/extra/wrong words.
export function scoreTranscriptSimilarity(transcript, referenceText) {
  if (!transcript || !referenceText) return 0;

  const wordsA = normalize(transcript).split(' ').filter(Boolean);
  const wordsB = normalize(referenceText).split(' ').filter(Boolean);

  if (wordsB.length === 0) return 0;

  const distance = wordLevenshtein(wordsA, wordsB);
  const maxLen = Math.max(wordsA.length, wordsB.length);

  const similarity = 1 - distance / maxLen;
  return Math.max(0, Math.round(similarity * 100));
}

// Generates simple, human-readable feedback based on the score and what
// differs between transcript and reference. Kept rule-based for now —
// can be swapped for an LLM-generated version later for richer feedback.
export function generateFeedback(score, transcript, referenceText) {
  if (score >= 90) {
    return 'Excellent! Your spoken answer closely matches the expected sentence.';
  }
  if (score >= 70) {
    return 'Good attempt. A few words were different from the expected sentence — review the correct version and try again.';
  }
  if (score >= 40) {
    return 'Partially correct. Several words were missing or incorrect. Listen/read the reference again and practice.';
  }
  return 'Your answer differs significantly from the expected sentence. Try reading the reference carefully and attempt again.';
}