import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import api from '../api'

const difficultyBadge = { Easy: 'badge-easy', Medium: 'badge-medium', Hard: 'badge-hard' }

export default function InterviewSession() {
  const { state }  = useLocation()
  const navigate   = useNavigate()
  const { mode, context, category, questionCount = 5 } = state || {}

  const [sessionId,    setSessionId]    = useState(null)
  const [currentQ,     setCurrentQ]     = useState(0)
  const [questionData, setQuestionData] = useState(null)  // { responseId, question, ... }
  const [transcript,   setTranscript]   = useState('')
  const [isListening,  setIsListening]  = useState(false)
  const [isSpeaking,   setIsSpeaking]   = useState(false)
  const [isLoading,    setIsLoading]    = useState(false)
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [error,        setError]        = useState('')
  const [allResults,   setAllResults]   = useState([])  // collected evals
  const [phase, setPhase] = useState('loading')  // 'loading' | 'question' | 'answer' | 'done'

  const recognitionRef = useRef(null)
  const synthRef = useRef(window.speechSynthesis)
  const initialized = useRef(false)
  // ── Load a new question ─────────────────────────────────────────────────
  const loadQuestion = useCallback(async (existingSessionId = null) => {
    setIsLoading(true)
    setError('')
    setTranscript('')
    setPhase('loading')
    try {
      const res = await api.post('/interview/generate', {
        mode, 
        context, 
        category,
        sessionId: existingSessionId,
      })
      const d = res.data
      setSessionId(d.sessionId)
      setQuestionData(d)
      setPhase('question')
      // Auto-speak the question
      speakText(d.question)
    } catch (err) {
      setError(err.message)
      setPhase('question')
    } finally {
      setIsLoading(false)
    }
  }, [mode, context, category, currentQ])

  useEffect(() => {
    if (!mode || !context) { navigate('/'); return }
    if (!initialized.current) {
      initialized.current = true
      loadQuestion()
    }
  }, []) // eslint-disable-line

  // ── Text-to-Speech ──────────────────────────────────────────────────────
  const speakText = (text) => {
    if (!window.speechSynthesis) return
    synthRef.current.cancel()
    const utt = new SpeechSynthesisUtterance(text)
    utt.rate  = 0.9
    utt.pitch = 1
    utt.onstart = () => setIsSpeaking(true)
    utt.onend   = () => { setIsSpeaking(false); setPhase('answer') }
    synthRef.current.speak(utt)
  }

  const stopSpeaking = () => {
    synthRef.current.cancel()
    setIsSpeaking(false)
    setPhase('answer')
  }

  // ── Speech-to-Text ──────────────────────────────────────────────────────
  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setError('Speech recognition is not supported in this browser. Please use Chrome or Edge.')
      return
    }
    const recognition = new SpeechRecognition()
    recognition.continuous     = true
    recognition.interimResults = true
    recognition.lang           = 'en-US'

    recognition.onresult = (e) => {
      let full = ''
      for (let i = 0; i < e.results.length; i++) {
        full += e.results[i][0].transcript + ' '
      }
      setTranscript(full.trim())
    }
    recognition.onerror = (e) => {
      setError(`Microphone error: ${e.error}`)
      setIsListening(false)
    }
    recognition.onend  = () => setIsListening(false)

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }

  const stopListening = () => {
    recognitionRef.current?.stop()
    setIsListening(false)
  }

  // ── Submit answer ───────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!transcript.trim()) { setError('Please record or type your answer first.'); return }
    setIsEvaluating(true); setError('')
    try {
      const result = {
        responseId: questionData.responseId,
        question:   questionData.question,
        difficulty: questionData.difficulty,
        category:   questionData.category,
        userAnswer: transcript,
      }
      const updated = [...allResults, result]
      setAllResults(updated)

      // Check if done
      if (currentQ + 1 >= questionCount) {
        // Send to background evaluation and move to done phase immediately
        api.post('/interview/evaluate-batch', {
          sessionId,
          answers: updated
        }).catch(err => console.error('Background eval initiation failed:', err));
        
        setPhase('done');
      } else {
        setCurrentQ(prev => prev + 1)
        setTimeout(() => loadQuestion(sessionId), 0) // Next cycle
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setIsEvaluating(false)
    }
  }

  const handleSkip = async () => {
    stopListening()
    stopSpeaking()
    setIsEvaluating(true); setError('')

    try {
      const result = {
        responseId: questionData.responseId,
        question:   questionData.question,
        difficulty: questionData.difficulty,
        category:   questionData.category,
        userAnswer: '(Skipped)',
      }
      const updated = [...allResults, result]
      setAllResults(updated)

      if (currentQ + 1 >= questionCount) {
        // Send to background evaluation and move to done phase immediately
        api.post('/interview/evaluate-batch', {
          sessionId,
          answers: updated
        }).catch(err => console.error('Background eval initiation failed:', err));

        setPhase('done');
      } else {
        setCurrentQ(prev => prev + 1)
        setTimeout(() => loadQuestion(sessionId), 0)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setIsEvaluating(false)
    }
  }

  const progress = Math.round(((phase === 'done' ? questionCount : currentQ) / questionCount) * 100)

  if (phase === 'done') {
    return (
      <div className="page max-w-3xl mx-auto pt-16">
        <div className="glass p-12 text-center animate-fadeInUp">
          <div className="text-6xl mb-6">✅</div>
          <h2 className="text-3xl font-bold mb-4">Interview Completed!</h2>
          <p className="text-[var(--text-muted)] mb-8 text-lg">
            Your results are being reviewed and will be available shortly.
          </p>
          <button onClick={() => navigate('/history')} className="btn-primary px-8 py-3 text-lg">
            Go to My History
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-bold text-lg">Interview Session</h1>
          <p className="text-[var(--text-muted)] text-sm capitalize">
            {mode} · {Array.isArray(context) ? `${context.length} Skills Evaluated` : context}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-[var(--text-muted)]">Question</p>
          <p className="font-bold text-xl">{currentQ + 1} <span className="text-[var(--text-muted)] font-normal text-sm">/ {questionCount}</span></p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-[var(--border)] rounded-full mb-8 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-light)] transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Loading & Error State */}
      {phase === 'loading' && (
        <div className="glass p-10 text-center animate-fadeIn">
          {error ? (
            <div className="text-red-400">
              <div className="text-4xl mb-3">⚠️</div>
              <p className="font-semibold mb-2">Failed to load question</p>
              <p className="text-sm opacity-80 mb-6">{error}</p>
              <button 
                onClick={() => navigate(mode === 'resume' ? '/' : '/practice')}
                className="btn-secondary text-sm"
              >
                Go Back
              </button>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin mx-auto mb-4" />
              <p className="text-[var(--text-muted)]">Generating your question…</p>
            </>
          )}
        </div>
      )}

      {/* Question card */}
      {(phase === 'question' || phase === 'answer') && questionData && (
        <div className="glass p-8 mb-6 animate-fadeInUp">
          <div className="flex items-center gap-3 mb-5">
            <span className={`badge ${difficultyBadge[questionData.difficulty] || 'badge-medium'}`}>
              {questionData.difficulty || 'Medium'}
            </span>
            <span className="badge" style={{ background: 'var(--accent-glow)', color: 'var(--accent-light)' }}>
              {questionData.category || 'Technical'}
            </span>
            {isSpeaking && (
              <span className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                <span className="w-2 h-2 bg-[var(--accent)] rounded-full animate-pulse" />
                Speaking…
              </span>
            )}
          </div>

          <p className="text-xl font-medium leading-relaxed mb-6">{questionData.question}</p>

          {/* TTS controls */}
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => speakText(questionData.question)} className="btn-secondary text-sm py-2 px-4" disabled={isSpeaking}>
              🔊 Replay Question
            </button>
            {isSpeaking && (
              <button onClick={stopSpeaking} className="btn-secondary text-sm py-2 px-4">
                ⏸ Stop Speaking
              </button>
            )}
          </div>
        </div>
      )}

      {/* Answer area */}
      {phase === 'answer' && (
        <div className="space-y-4 animate-fadeInUp">
          {/* STT controls */}
          <div className="glass p-6">
            <p className="text-sm text-[var(--text-muted)] mb-4 font-medium">🎙️ Your Answer</p>

            <div className="flex gap-3 mb-4">
              {!isListening ? (
                <button
                  onClick={startListening}
                  className="btn-primary flex-1 py-3"
                  disabled={isEvaluating}
                >
                  🎤 Start Recording
                </button>
              ) : (
                <button
                  onClick={stopListening}
                  className="flex-1 py-3 rounded-xl font-semibold text-white border-none cursor-pointer animate-record"
                  style={{ background: 'linear-gradient(135deg, var(--danger), #b91c1c)' }}
                >
                  ⏹ Stop Recording
                </button>
              )}
            </div>

            <textarea
              className="input resize-none"
              rows={5}
              placeholder="Your spoken answer will appear here, or type your answer manually…"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              disabled={isEvaluating}
            />

            {isListening && (
              <p className="text-xs text-[var(--text-muted)] mt-2 flex items-center gap-1.5">
                <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
                Listening… speak clearly
              </p>
            )}
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
          )}

          <div className="flex gap-4">
            <button
              onClick={handleSkip}
              className="btn-secondary flex-1 py-4 text-base font-semibold"
              disabled={isEvaluating}
            >
              ⏭ Skip Question
            </button>
            <button
              onClick={handleSubmit}
              className="btn-primary flex-[2] py-4 text-base"
              disabled={isEvaluating || !transcript.trim()}
            >
              {isEvaluating
                ? <><span className="w-5 h-5 rounded-full border-2 border-[var(--bg-card)] border-t-transparent animate-spin" /> Evaluating…</>
                : currentQ + 1 >= questionCount ? '🏁 Submit & See Results' : '✅ Submit & Next Question'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
