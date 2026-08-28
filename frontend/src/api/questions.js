import api from './client.js';

export async function getSkillAreas() {
  const res = await api.get('/questions/skill-areas');
  return res.data;
}

export async function getTopics(skillAreaId) {
  const res = await api.get('/questions/topics', { params: { skillAreaId } });
  return res.data;
}

export async function getQuestions(skillAreaId, limit = 10, topicId = null) {
  const params = { skillAreaId, limit };
  if (topicId) params.topicId = topicId;
  const res = await api.get('/questions', { params });
  return res.data;
}