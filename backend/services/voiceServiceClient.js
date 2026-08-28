import axios from 'axios';
import FormData from 'form-data';

const VOICE_SERVICE_URL = process.env.VOICE_SERVICE_URL || 'https://voice-scoring-service.onrender.com';

// Render's free tier sleeps after 15 min of inactivity — the first request
// after a sleep can take 30-60s just to wake the container, on top of
// actual transcription time on very limited CPU. We use a generous timeout
// (2 minutes) rather than the usual few-seconds default, since a normal
// API timeout would fail almost every "cold" request.
const REQUEST_TIMEOUT_MS = 120_000;

/**
 * Sends recorded audio to the voice-scoring microservice for transcription
 * and fluency scoring.
 */
export async function scoreVoiceAnswer(audioBuffer, originalFilename, questionType, referenceText) {
  const formData = new FormData();
  // Explicit filename + contentType (rather than a bare string) guarantees
  // the multipart request always carries a proper .webm filename through
  // to the Python service, regardless of what the buffer's own metadata says.
  formData.append('audio', audioBuffer, {
    filename: originalFilename || 'recording.webm',
    contentType: 'audio/webm',
  });
  formData.append('question_type', questionType);
  if (referenceText) {
    formData.append('reference_text', referenceText);
  }

  try {
    const response = await axios.post(`${VOICE_SERVICE_URL}/transcribe`, formData, {
      headers: formData.getHeaders(),
      timeout: REQUEST_TIMEOUT_MS,
    });
    return response.data;
  } catch (err) {
    if (err.code === 'ECONNABORTED') {
      throw new Error('VOICE_SERVICE_TIMEOUT');
    }
    throw err;
  }
}

export async function pingVoiceService() {
  try {
    await axios.get(`${VOICE_SERVICE_URL}/health`, { timeout: 90_000 });
    return true;
  } catch {
    return false;
  }
}