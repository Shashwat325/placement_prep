import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getQuestions } from '../api/questions.js';
import { startAttempt, submitAnswer, completeAttempt } from '../api/attempts.js';
import Navbar from '../components/Navbar.jsx';
import 'bootstrap/dist/css/bootstrap.min.css';

const MCQ_TIME_LIMIT = 60; // seconds per MCQ question

// Strip separators (/, -, _, |) that read poorly aloud ("dash", "slash")
// and collapse them into natural spacing so TTS reads a clean sentence.
function sanitizeForSpeech(text) {
  if (!text) return '';
  return text
    .replace(/[/\-_|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getSpeechText(question) {
  if (!question) return '';
  if (question.question_type === 'repeat_paragraph') {
    return sanitizeForSpeech(question.correct_answer || question.prompt);
  }
  return sanitizeForSpeech(question.prompt);
}

function computeWordAccuracy(transcript, reference) {
  if (!transcript || !reference) return 0;
  const clean = (s) => s.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean);
  const refWords = clean(reference);
  const transWords = new Set(clean(transcript));
  if (refWords.length === 0) return 0;
  const matched = refWords.filter((w) => transWords.has(w)).length;
  return Math.round((matched / refWords.length) * 100);
}

export default function TakeTest() {
  const { skillAreaId, topicId } = useParams();
  const navigate = useNavigate();

  const [isChatbotSpeaking, setIsChatbotSpeaking] = useState(false);
  const [chatbotUtterance, setChatbotUtterance] = useState(null);
  const [testMode, setTestMode] = useState(null);

  const [attemptId, setAttemptId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [questionScores, setQuestionScores] = useState(null);

  // MCQ per-question countdown
  const [timeLeft, setTimeLeft] = useState(MCQ_TIME_LIMIT);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const spokenQuestionRef = useRef(null);

  const speakWithChatbot = (text, onEndCallback = null) => {
    if (isChatbotSpeaking && chatbotUtterance) {
      window.speechSynthesis.cancel();
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    utterance.volume = 0.9;
    utterance.onstart = () => setIsChatbotSpeaking(true);
    utterance.onend = () => {
      setIsChatbotSpeaking(false);
      if (onEndCallback) onEndCallback();
    };
    utterance.onerror = (event) => {
      console.error('TTS Error:', event);
      setIsChatbotSpeaking(false);
    };
    setChatbotUtterance(utterance);
    window.speechSynthesis.speak(utterance);
  };

  const stopChatbotSpeaking = () => {
    if (isChatbotSpeaking && chatbotUtterance) {
      window.speechSynthesis.cancel();
      setIsChatbotSpeaking(false);
      setChatbotUtterance(null);
    }
  };

  useEffect(() => {
    async function setup() {
      try {
        const attempt = await startAttempt(skillAreaId);
        const qs = await getQuestions(skillAreaId, 5, topicId);
        if (qs.length === 0) {
          setError('No questions available for this topic yet.');
          setLoading(false);
          return;
        }
        setAttemptId(attempt.id);
        setQuestions(qs);
        setLoading(false);
      } catch (err) {
        setError('Failed to start the test. Please try again.');
        setLoading(false);
      }
    }
    setup();
  }, [skillAreaId, topicId]);

  const currentQuestion = questions[currentIndex];
  const isLastQuestion = currentIndex === questions.length - 1;
  const isSpeakingExercise =
    currentQuestion &&
    ['jumbled_sentence', 'repeat_paragraph', 'summarize_paragraph'].includes(currentQuestion.question_type);
  const isMcq = currentQuestion?.question_type === 'mcq';

  // Keep a ref to the latest handleNext so the timer's setInterval callback
  // (created once per question) always calls the CURRENT version of
  // handleNext, not a stale closure from when the interval was created.
  const handleNextRef = useRef(() => { });

  // Speak the question exactly once per question, only in "Listen and Speak" mode.
  useEffect(() => {
    if (!currentQuestion || testMode !== 'listen' || !isSpeakingExercise) return;
    if (spokenQuestionRef.current !== currentIndex) {
      spokenQuestionRef.current = currentIndex;
      speakWithChatbot(getSpeechText(currentQuestion));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, currentQuestion, testMode, isSpeakingExercise]);

  // Clean up media recorder + any lingering speech on unmount or when question changes
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      stopChatbotSpeaking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  // --- MCQ countdown timer ---
  // Resets to MCQ_TIME_LIMIT every time we move to a new MCQ question, and
  // ticks down once per second. When it hits 0, it force-submits (even with
  // no option selected) via handleNextRef, so a stale closure never fires.
  useEffect(() => {
    if (!isMcq) return; // only run the timer for MCQ questions

    setTimeLeft(MCQ_TIME_LIMIT);

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleNextRef.current(true); // true = "forced" (timeout) submission
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, isMcq]);

  const [recordingTime, setRecordingTime] = useState(0);
  const recordingIntervalRef = useRef(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      setRecordingTime(0);
      setQuestionScores(null);

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        setRecording(false);
        clearInterval(recordingIntervalRef.current); // always the correct, current interval
        recordingIntervalRef.current = null;
        if (blob) {
          await sendAudioToVoiceService(blob);
        }
      };

      mediaRecorderRef.current.start();
      setRecording(true);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError('Unable to access microphone. Please check permissions and ensure you have granted microphone access.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const sendAudioToVoiceService = async (blob) => {
    try {
      setIsProcessing(true);
      if (blob.size === 0) {
        throw new Error('Audio blob is empty');
      }

      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');
      formData.append('question_type', currentQuestion.question_type);
      formData.append('reference_text', currentQuestion.correct_answer || currentQuestion.prompt || '');

      const response = await fetch('http://localhost:8000/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Voice service error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      const newTranscript = result.transcript || '';
      setTranscript(newTranscript);

      const referenceText = currentQuestion.correct_answer || currentQuestion.prompt || '';
      setQuestionScores({
        pronunciation: result.clarity_score ?? 0,
        fluency: result.fluency_scores?.final_score ?? 0,
        speedWpm: result.pace_data?.wpm ?? 0,
        speedScore: result.fluency_scores?.wpm_score ?? 0,
        correctWords: computeWordAccuracy(newTranscript, referenceText),
      });
    } catch (err) {
      console.error('Error processing audio with voice service:', err);
      setError('Unable to process audio. Please try again or type your answer.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTranscriptChange = (e) => {
    setTranscript(e.target.value);
  };

  // `forced` = true means this call came from the timer running out, not the
  // user clicking the button — in that case we skip the "must answer first"
  // validation and submit whatever's there (or nothing, for an unanswered MCQ).
  async function handleNext(forced = false) {
    if (!forced) {
      if (currentQuestion.question_type === 'mcq') {
        if (selectedOption === null) return;
      } else if (isSpeakingExercise) {
        if (!transcript && !audioBlob) {
          setError('Please provide an answer by speaking or typing');
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      let textAnswer = null;

      if (currentQuestion.question_type === 'mcq') {
        textAnswer = selectedOption; // may be null if time ran out unanswered
      } else if (currentQuestion.question_type === 'jumbled_sentence') {
        textAnswer = transcript || selectedOption;
      } else {
        textAnswer = transcript;
      }

      await submitAnswer(attemptId, currentQuestion.id, textAnswer, audioBlob, transcript);

      if (isLastQuestion) {
        const finalResult = await completeAttempt(attemptId);
        setResult(finalResult);
      } else {
        setCurrentIndex(currentIndex + 1);
        setSelectedOption(null);
        setTranscript('');
        setAudioBlob(null);
        setAudioUrl(null);
        setQuestionScores(null);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to submit answer. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // Keep the ref pointing at the latest handleNext after every render, so
  // the timer effect (which only re-runs per question) always calls a
  // version with up-to-date state (selectedOption, transcript, etc.).
  useEffect(() => {
    handleNextRef.current = handleNext;
  });

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="dashboard">
          <div className="test-complete">
            <h1>Setting up your test...</h1>
            <p>Preparing questions for you</p>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Navbar />
        <div className="dashboard">
          <p className="error-text">{error}</p>
        </div>
      </>
    );
  }

  if (!testMode && isSpeakingExercise) {
    return (
      <>
        <Navbar />
        <div className="dashboard">
          <div className="test-complete">
            <h1>Choose how you'd like to practice</h1>
            <p>This applies to all speaking questions in this test.</p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1.5rem', flexWrap: 'wrap' }}>
              <button className="btn btn-primary px-4 py-2" onClick={() => setTestMode('listen')}>
                🎧 Listen and Speak
              </button>
              <button className="btn btn-secondary px-4 py-2" onClick={() => setTestMode('read')}>
                📖 Read and Speak
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (result) {
    return (
      <>
        <Navbar />
        <div className="dashboard">
          <div className="test-complete text-dark">
            <h1>Test Complete!</h1>
            <p>Your score: {Number(result.totalScore).toFixed(1)}%</p>
            {result.passed ? (
              <p>Congratulations! You passed this test.</p>
            ) : (
              <p>Keep practicing to improve your score.</p>
            )}
            <button onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
          </div>
        </div>
      </>
    );
  }

  const listenMode = testMode === 'listen';

  return (
    <>
      <Navbar />
      <div className="dashboard">
        <header>
          <div className="test-header">
            <h1>
              Question {currentIndex + 1} of {questions.length}
            </h1>
            {isMcq && (
              <div
                className={`badge px-3 py-2 ${timeLeft <= 10 ? 'bg-danger' : 'bg-secondary'}`}
                style={{ fontSize: '0.95rem' }}
              >
                ⏱ {timeLeft}s
              </div>
            )}
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
              ></div>
            </div>
          </div>
        </header>

        <section>
          <div className="question-content">
            {!isSpeakingExercise && <p className="question-prompt">{currentQuestion.prompt}</p>}

            {isSpeakingExercise && (
              <>
                {listenMode ? (
                  <div className="speaking-instructions">
                    <p className="listening-indicator">
                      {isChatbotSpeaking ? '🔊 Listen carefully...' : '🎤 Your turn to speak'}
                    </p>
                  </div>
                ) : (
                  <div className="speaking-instructions text-dark">
                    <h3 className="text-dark" style={{ color: 'black' }}>{currentQuestion.prompt}</h3>
                    {currentQuestion.question_type === 'repeat_paragraph' && (
                      <>
                        <p className="reference-text text-dark">Read and repeat this sentence:</p>
                        <p className="reference-sentence">{currentQuestion.correct_answer}</p>
                      </>
                    )}
                    {currentQuestion.question_type === 'jumbled_sentence' && (
                      <>
                        <p className="reference-text text-dark">Rearrange the words to form a correct sentence:</p>
                        <div className="jumbled-words text-dark">
                          {currentQuestion.prompt.split(' ').map((word, index) => (
                            <span key={index} className="jumbled-word text-dark">
                              {word}
                            </span>
                          ))}
                        </div>
                        <p className="instruction">Type or speak your answer below:</p>
                      </>
                    )}
                    {currentQuestion.question_type === 'summarize_paragraph' && (
                      <>
                        <p className="reference-text">Read the paragraph and speak a summary:</p>
                        <p className="reference-sentence">{currentQuestion.prompt}</p>
                      </>
                    )}
                  </div>
                )}

                {!isProcessing && (
                  <div className="recording-controls">
                    {!recording && (
                      <button onClick={startRecording} disabled={submitting} className="btn btn-success me-2 px-4 py-2">
                        Start Recording
                      </button>
                    )}
                    {recording && (
                      <>
                        <button onClick={stopRecording} disabled={submitting} className="btn btn-danger me-2 px-4 py-2">
                          Stop Recording
                        </button>
                        <div className="recording-timer badge bg-info text-dark px-3 py-2">
                          Recording: {recordingTime}s
                        </div>
                      </>
                    )}
                    {!recording && audioBlob && (
                      <>
                        <audio controls src={audioUrl} className="audio-preview" />
                        <button
                          onClick={() => {
                            setAudioBlob(null);
                            setAudioUrl(null);
                            setQuestionScores(null);
                          }}
                          className="clear-button"
                        >
                          Clear Recording
                        </button>
                      </>
                    )}
                  </div>
                )}

                {isProcessing && <div className="processing-indicator">Processing your answer...</div>}

                {questionScores && !isProcessing && (
                  <div className="score-breakdown" style={{ marginTop: '1rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '8px' }}>
                    <h4 className="text-dark">Your Results</h4>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      <li className="text-dark">Pronunciation: {questionScores.pronunciation}%</li>
                      <li className="text-dark">Fluency: {questionScores.fluency}%</li>
                      <li className="text-dark">
                        Speed: {questionScores.speedWpm} wpm ({questionScores.speedScore}%)
                      </li>
                      {currentQuestion.question_type !== 'summarize_paragraph' && (
                        <li className="text-dark">Correct Words: {questionScores.correctWords}%</li>
                      )}
                    </ul>
                  </div>
                )}

                {!listenMode && (
                  <div className="text-input-section">
                    <label htmlFor="transcript">Your answer (you can type or speak):</label>
                    <textarea
                      id="transcript"
                      value={transcript}
                      onChange={handleTranscriptChange}
                      placeholder="Type your answer here or use the microphone to speak"
                      rows={4}
                      disabled={submitting || isProcessing}
                    />
                  </div>
                )}
              </>
            )}

            {!isSpeakingExercise && currentQuestion.question_type === 'mcq' && (
              <div className="options-list text-dark">
                {currentQuestion.options.map((opt) => (
                  <label key={opt} className={selectedOption === opt ? 'option selected' : 'option'}>
                    <input
                      type="radio"
                      name="option"
                      value={opt}
                      checked={selectedOption === opt}
                      onChange={() => setSelectedOption(opt)}
                      disabled={submitting}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            )}

            {isSpeakingExercise && !isProcessing && !listenMode && (
              <div className="help-text text-dark">
                <small>
                  {currentQuestion.question_type === 'repeat_paragraph' &&
                    'Speak the reference sentence clearly. Your pronunciation and fluency will be scored.'}
                  {currentQuestion.question_type === 'jumbled_sentence' &&
                    'First arrange the words correctly, then speak the sentence. Your arrangement and pronunciation will be scored.'}
                  {currentQuestion.question_type === 'summarize_paragraph' &&
                    'Read the paragraph, then speak a concise summary in your own words. Your comprehension and fluency will be scored.'}
                </small>
              </div>
            )}
          </div>

          <div className="test-actions text-dark">
            <button
              onClick={() => handleNext(false)}
              disabled={
                (currentQuestion.question_type === 'mcq' && selectedOption === null) ||
                (isSpeakingExercise && !transcript && !audioBlob) ||
                submitting ||
                isProcessing
              }
            >
              {submitting ? 'Submitting...' : isProcessing ? 'Processing...' : isLastQuestion ? 'Finish Test' : 'Next Question'}
            </button>
          </div>
        </section>
      </div>
    </>
  );
}