import api from './client.js';

export async function startAttempt(skillAreaId) {
  const res = await api.post('/attempts/start', { skillAreaId });
  return res.data; // { id, started_at }
}

export async function submitAnswer(attemptId, questionId, textAnswer, audioFile, transcript) {
  const formData = new FormData();
  formData.append('questionId', questionId);
  formData.append('textAnswer', textAnswer || '');

  // Explicit filename here — without it, the browser defaults an unlabeled
  // Blob's name to the literal string "blob", which was passing all the way
  // through to the voice-scoring service and getting rejected as an
  // unrecognized file extension.
  if (audioFile) {
    formData.append('audio', audioFile, 'recording.webm');
  }

  if (transcript) {
    formData.append('transcript', transcript);
  }

  const res = await api.post(`/attempts/${attemptId}/answer`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return res.data;
}

export async function completeAttempt(attemptId) {
  const res = await api.post(`/attempts/${attemptId}/complete`);
  return res.data;
}