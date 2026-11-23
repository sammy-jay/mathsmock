"use client";

import {
  ArrowLeft,
  ArrowRight,
  Bell,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Clock3,
  Flag,
  GraduationCap,
  Inbox,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  MessageCircle,
  RotateCcw,
  Send,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { seedQuestions, SUBJECT, TOPICS } from "@/lib/questions";
import type { Attempt, AttemptAnswer, Question, SiteSettings, TeacherMessage } from "@/lib/types";

const STUDENT_KEY = "mathsmock.student";
const attemptsStorageKey = (name: string) => `mathsmock.attempts.${name.trim().toLocaleLowerCase()}`;
const messagesStorageKey = (name: string) => `mathsmock.messages.${name.trim().toLocaleLowerCase()}`;
const defaultSettings: SiteSettings = {
  secondsPerQuestion: 72,
  warningLimit: 3,
  autoSubmitOnWarnings: true,
  fullscreenRequired: true,
  shuffleOptions: true,
  showSolutions: true,
};

type Tab = "Practice" | "Progress" | "History" | "Inbox";
type QuestionMix = "Mixed" | "New first" | "Weak topics" | "Retry mistakes";

function readLocal<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    return saved ? (JSON.parse(saved) as T) : fallback;
  } catch {
    return fallback;
  }
}

function shuffle<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  return shuffled;
}

function prettyDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function displayDate(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function scorePercent(attempt: Attempt): number {
  return attempt.total ? Math.round((attempt.score / attempt.total) * 100) : 0;
}

function getSavedName(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(STUDENT_KEY) ?? "";
  } catch {
    return "";
  }
}

export default function StudentApp() {
  const [studentName, setStudentName] = useState(getSavedName);
  const [nameInput, setNameInput] = useState(getSavedName);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>("Practice");
  const [questions, setQuestions] = useState<Question[]>(seedQuestions);
  const [attempts, setAttempts] = useState<Attempt[]>(() =>
    typeof window === "undefined" ? [] : readLocal<Attempt[]>(attemptsStorageKey(getSavedName()), []),
  );
  const [messages, setMessages] = useState<TeacherMessage[]>(() =>
    typeof window === "undefined" ? [] : readLocal<TeacherMessage[]>(messagesStorageKey(getSavedName()), []),
  );
  const [settings, setSettings] = useState(defaultSettings);
  const [notice, setNotice] = useState("");
  const [selectedTopics, setSelectedTopics] = useState<string[]>(TOPICS);
  const [questionCount, setQuestionCount] = useState(10);
  const [mix, setMix] = useState<QuestionMix>("Mixed");
  const [testQuestions, setTestQuestions] = useState<Question[]>([]);
  const [optionOrders, setOptionOrders] = useState<Record<string, number[]>>({});
  const [answers, setAnswers] = useState<Record<string, number | null>>({});
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [questionIndex, setQuestionIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [warnings, setWarnings] = useState(0);
  const [isTesting, setIsTesting] = useState(false);
  const [activeAttemptId, setActiveAttemptId] = useState<string | null>(null);
  const [result, setResult] = useState<Attempt | null>(null);
  const [messageDraft, setMessageDraft] = useState("");
  const finishTestRef = useRef<(automatic?: boolean) => void>(() => undefined);
  const warningRef = useRef<(reason: string) => void>(() => undefined);
  const warningCountRef = useRef(0);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setLoaded(true));

    void fetch("/api/questions")
      .then(async (response) => {
        const data = (await response.json()) as { questions?: Question[]; settings?: SiteSettings; source?: string; error?: string };
        if (!response.ok) throw new Error(data.error || "Unable to load the question bank.");
        if (data.questions) setQuestions(data.questions);
        if (data.settings) setSettings(data.settings);
        if (data.source === "preview") {
          setNotice("MongoDB is not connected yet. Practice works in this browser; results and messages will not sync until MONGODB_URI is set.");
        }
      })
      .catch((error: unknown) => {
        setNotice(error instanceof Error ? error.message : "Unable to load the question bank.");
      });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!studentName) return;
    let cancelled = false;
    const syncStudentSpace = async () => {
      const sessionResponse = await fetch("/api/student/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: studentName }),
      });
      const sessionData = (await sessionResponse.json()) as { error?: string };
      if (!sessionResponse.ok) throw new Error(sessionData.error || "Student session could not be created.");

      const response = await fetch("/api/student/data");
      const data = (await response.json()) as {
        attempts?: Attempt[];
        messages?: TeacherMessage[];
        error?: string;
      };
      if (!response.ok) throw new Error(data.error || "Unable to sync student data.");
      if (cancelled) return;
      setAttempts((current) => {
          const byId = new Map(current.map((attempt) => [attempt.id, attempt]));
          for (const attempt of data.attempts ?? []) byId.set(attempt.id, attempt);
          const merged = [...byId.values()].sort((first, second) =>
            second.createdAt.localeCompare(first.createdAt),
          );
          localStorage.setItem(attemptsStorageKey(studentName), JSON.stringify(merged));
          return merged;
        });
      setMessages(data.messages ?? []);
      localStorage.setItem(messagesStorageKey(studentName), JSON.stringify(data.messages ?? []));
    };
    void syncStudentSpace().catch((error: unknown) => {
      if (!cancelled) setNotice(error instanceof Error ? error.message : "Student data could not be synced.");
    });
    return () => {
      cancelled = true;
    };
  }, [studentName]);

  const solvedQuestionIds = useMemo(
    () => new Set(attempts.flatMap((attempt) => attempt.answers.map((answer) => answer.questionId))),
    [attempts],
  );
  const mistakeQuestionIds = useMemo(() => {
    const mostRecent = attempts.find((attempt) => attempt.status === "completed");
    if (!mostRecent) return new Set<string>();
    const questionById = new Map(questions.map((question) => [question.id, question]));
    return new Set(
      mostRecent.answers
        .filter((answer) => questionById.get(answer.questionId)?.correctIndex !== answer.selectedIndex)
        .map((answer) => answer.questionId),
    );
  }, [attempts, questions]);
  const currentQuestion = testQuestions[questionIndex];
  const answeredCount = Object.values(answers).filter((answer) => answer !== null && answer !== undefined).length;
  const unreadCount = messages.filter((message) => message.sender === "teacher" && !message.read).length;

  const recordWarning = useCallback(
    (reason: string) => {
      const next = warningCountRef.current + 1;
      warningCountRef.current = next;
      setWarnings(next);
      setNotice(`${reason} Warning ${next} of ${settings.warningLimit}.`);
      if (settings.autoSubmitOnWarnings && next >= settings.warningLimit) {
        window.setTimeout(() => finishTestRef.current(true), 0);
      }
    },
    [settings.autoSubmitOnWarnings, settings.warningLimit],
  );
  useEffect(() => {
    warningRef.current = recordWarning;
  }, [recordWarning]);

  const finishTest = useCallback(
    (automatic = false) => {
      if (!isTesting || !testQuestions.length) return;
      setIsTesting(false);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);

      const submittedAnswers: AttemptAnswer[] = testQuestions.map((question) => ({
        questionId: question.id,
        selectedIndex: answers[question.id] ?? null,
        flagged: Boolean(flags[question.id]),
      }));
      const localScore = submittedAnswers.reduce(
        (total, answer, index) =>
          total + (answer.selectedIndex === testQuestions[index].correctIndex ? 1 : 0),
        0,
      );
      const localAttempt: Attempt = {
        id: crypto.randomUUID(),
        studentName,
        subject: SUBJECT,
        answers: submittedAnswers,
        score: localScore,
        total: testQuestions.length,
        warnings,
        durationSeconds: Math.max(0, testQuestions.length * settings.secondsPerQuestion - secondsLeft),
        createdAt: new Date().toISOString(),
        status: "completed",
      };
      setResult(localAttempt);
      setTab("History");
      setNotice("");

      void fetch("/api/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: submittedAnswers,
          warnings,
          durationSeconds: localAttempt.durationSeconds,
          attemptId: activeAttemptId,
        }),
      })
        .then(async (response) => {
          const data = (await response.json()) as { attempt?: Attempt; error?: string };
          if (!response.ok || !data.attempt) {
            throw new Error(data.error || "Your result could not be saved.");
          }
          const saved = data.attempt;
          setResult(saved);
          setAttempts((current) => {
            const updated = [saved, ...current.filter((attempt) => attempt.id !== saved.id)];
            localStorage.setItem(attemptsStorageKey(studentName), JSON.stringify(updated));
            return updated;
          });
          setNotice("");
          setActiveAttemptId(null);
        })
        .catch((error: unknown) => {
          setAttempts((current) => {
            const updated = [localAttempt, ...current];
            localStorage.setItem(attemptsStorageKey(studentName), JSON.stringify(updated));
            return updated;
          });
          setNotice(
            `${error instanceof Error ? error.message : "Your result could not be saved."} It is kept in this browser only.`,
          );
        });

      if (automatic) setNotice("Time or warning limit reached. Your test was submitted automatically.");
    },
    [activeAttemptId, answers, flags, isTesting, secondsLeft, settings.secondsPerQuestion, studentName, testQuestions, warnings],
  );
  useEffect(() => {
    finishTestRef.current = finishTest;
  }, [finishTest]);

  useEffect(() => {
    if (!isTesting) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          window.setTimeout(() => finishTestRef.current(true), 0);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isTesting]);

  useEffect(() => {
    if (!isTesting || !activeAttemptId) return;
    const timer = window.setTimeout(() => {
      const progress: AttemptAnswer[] = testQuestions.map((question) => ({
        questionId: question.id,
        selectedIndex: answers[question.id] ?? null,
        flagged: Boolean(flags[question.id]),
      }));
      void fetch(`/api/attempts/live/${encodeURIComponent(activeAttemptId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            answers: progress,
          currentQuestion: questionIndex + 1,
          warnings,
        }),
      }).then(async (response) => {
        if (!response.ok) {
          const data = (await response.json()) as { error?: string };
          setNotice(data.error || "Live test progress could not be synced.");
        }
      }).catch((error: unknown) => {
        setNotice(error instanceof Error ? error.message : "Live test progress could not be synced.");
      });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [activeAttemptId, answers, flags, isTesting, questionIndex, studentName, testQuestions, warnings]);

  useEffect(() => {
    if (!isTesting) return;
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") warningRef.current("Leaving the test was recorded.");
    };
    const onFullscreenChange = () => {
      if (settings.fullscreenRequired && !document.fullscreenElement) {
        warningRef.current("The test left full screen.");
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") setQuestionIndex((current) => Math.min(current + 1, testQuestions.length - 1));
      if (event.key === "ArrowLeft") setQuestionIndex((current) => Math.max(current - 1, 0));
      const answerIndex = ["a", "b", "c", "d"].indexOf(event.key.toLowerCase());
      if (answerIndex !== -1 && currentQuestion) {
        const originalIndex = optionOrders[currentQuestion.id]?.[answerIndex] ?? answerIndex;
        setAnswers((current) => ({ ...current, [currentQuestion.id]: originalIndex }));
      }
      if (["c", "v", "x"].includes(event.key.toLowerCase()) && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [currentQuestion, isTesting, optionOrders, settings.fullscreenRequired, testQuestions.length]);

  const startTest = () => {
    let pool = questions.filter((question) => question.active && selectedTopics.includes(question.topic));
    if (mix === "New first") pool = pool.filter((question) => !solvedQuestionIds.has(question.id));
    if (mix === "Retry mistakes") pool = pool.filter((question) => mistakeQuestionIds.has(question.id));
    if (mix === "Weak topics") {
      const topicScores = new Map<string, { correct: number; total: number }>();
      for (const attempt of attempts) {
        for (const answer of attempt.answers) {
          const question = questions.find((item) => item.id === answer.questionId);
          if (!question || !selectedTopics.includes(question.topic)) continue;
          const score = topicScores.get(question.topic) ?? { correct: 0, total: 0 };
          score.total += 1;
          if (question.correctIndex === answer.selectedIndex) score.correct += 1;
          topicScores.set(question.topic, score);
        }
      }
      const weakTopics = new Set(
        [...topicScores.entries()]
          .filter(([, score]) => score.total && score.correct / score.total < 0.75)
          .map(([topic]) => topic),
      );
      if (weakTopics.size) pool = pool.filter((question) => weakTopics.has(question.topic));
    }

    if (!pool.length) {
      setNotice(
        mix === "Retry mistakes"
          ? "No mistakes to retry yet. Finish a test first."
          : "No questions match those choices. Pick more topics or switch the question mix.",
      );
      return;
    }
    const selected = shuffle(pool).slice(0, Math.min(questionCount, pool.length));
    const orders = Object.fromEntries(
      selected.map((question) => [
        question.id,
        settings.shuffleOptions ? shuffle([0, 1, 2, 3]) : [0, 1, 2, 3],
      ]),
    );
    setTestQuestions(selected);
    setOptionOrders(orders);
    setAnswers({});
    setFlags({});
    setQuestionIndex(0);
    setWarnings(0);
    warningCountRef.current = 0;
    setSecondsLeft(selected.length * settings.secondsPerQuestion);
    setActiveAttemptId(null);
    setIsTesting(true);
    setResult(null);
    setNotice("");
    void fetch("/api/attempts/live", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentName, questionIds: selected.map((question) => question.id) }),
    }).then(async (response) => {
      const data = (await response.json()) as { attempt?: Attempt; error?: string };
      if (!response.ok || !data.attempt) throw new Error(data.error || "Live test sync is unavailable.");
      setActiveAttemptId(data.attempt.id);
    }).catch((error: unknown) => {
      setNotice(
        `${error instanceof Error ? error.message : "Live test sync is unavailable."} The test can continue, but your teacher will not see it live.`,
      );
    });
    if (settings.fullscreenRequired) {
      void document.documentElement.requestFullscreen().catch(() => {
        setNotice("Full screen was unavailable. The test can continue, but the teacher's setting asks for full screen.");
      });
    }
  };

  const registerStudent = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = nameInput.trim();
    if (!name || name.length > 80) {
      setNotice("Enter a name between 1 and 80 characters.");
      return;
    }
    localStorage.setItem(STUDENT_KEY, name);
    setAttempts(readLocal<Attempt[]>(attemptsStorageKey(name), []));
    setMessages(readLocal<TeacherMessage[]>(messagesStorageKey(name), []));
    setStudentName(name);
    setNotice("");
  };

  const sendMessage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = messageDraft.trim();
    if (!message) return;

    try {
      const response = await fetch("/api/student/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = (await response.json()) as { message?: TeacherMessage; error?: string };
      if (!response.ok || !data.message) throw new Error(data.error || "Message could not be sent.");
      const next = [...messages, data.message];
      setMessages(next);
      localStorage.setItem(messagesStorageKey(studentName), JSON.stringify(next));
      setMessageDraft("");
      setNotice("");
    } catch (error) {
      setNotice(
        `${error instanceof Error ? error.message : "Message could not be sent."} It has not been delivered to your teacher.`,
      );
    }
  };

  const switchStudent = () => {
    localStorage.removeItem(STUDENT_KEY);
    setStudentName("");
    setNameInput("");
    setAttempts([]);
    setMessages([]);
    setNotice("");
  };

  if (!loaded) return <div className="screen-loader">Loading your practice space…</div>;

  if (!studentName) {
    return (
      <main className="welcome-page">
        <div className="welcome-top">
          <Link className="brand-lockup" href="/">
            <span className="brand-mark">∑</span>
            <span>
              <strong>MathsMock</strong>
              <small>Year 10 · Proctored mock tests</small>
            </span>
          </Link>
          <Link className="teacher-link" href="/admin/login">
            Teacher access <ArrowRight size={15} />
          </Link>
        </div>
        <section className="welcome-card">
          <div className="eyebrow"><Sparkles size={14} /> YOUR PRACTICE SPACE</div>
          <h1>Ready to make<br />maths <em>make sense?</em></h1>
          <p>Work through a mock test, see what you know, and build confidence one question at a time.</p>
          <form onSubmit={registerStudent} className="name-form">
            <label htmlFor="student-name">What should we call you?</label>
            <input
              autoComplete="given-name"
              autoFocus
              id="student-name"
              maxLength={80}
              onChange={(event) => setNameInput(event.target.value)}
              placeholder="Your name"
              value={nameInput}
            />
            <button className="button button-primary button-wide" type="submit">
              Let’s get started <ArrowRight size={16} />
            </button>
          </form>
          <div className="privacy-note"><LockKeyhole size={13} /> No account or password needed. Just your name.</div>
          {notice && <p className="inline-notice" role="status">{notice}</p>}
        </section>
        <div className="welcome-footer"><span>MATHEMATICS · PAPER 1</span><span>WAEC / NECO · IGCSE STYLE</span></div>
      </main>
    );
  }

  if (isTesting && currentQuestion) {
    const order = optionOrders[currentQuestion.id] ?? [0, 1, 2, 3];
    return (
      <main
        className="exam-shell"
        onContextMenu={(event) => event.preventDefault()}
        onCopy={(event) => event.preventDefault()}
        onCut={(event) => event.preventDefault()}
        onPaste={(event) => event.preventDefault()}
      >
        <div className="exam-topbar">
          <div className="exam-brand"><span className="brand-mark">∑</span><strong>MathsMock</strong></div>
          <div className="exam-status"><span className="live-dot" /> PROCTORED SESSION</div>
          <div className={`exam-timer ${secondsLeft < 60 ? "timer-low" : ""}`}><Clock3 size={15} /> {prettyDuration(secondsLeft)}</div>
        </div>
        <div className="exam-progress-track"><span style={{ width: `${((questionIndex + 1) / testQuestions.length) * 100}%` }} /></div>
        <section className="exam-content">
          <div className="exam-heading">
            <div>
              <p className="eyebrow">QUESTION {questionIndex + 1} OF {testQuestions.length} <span>·</span> {currentQuestion.topic.toUpperCase()}</p>
              <h1>Take your time.<br /><em>You’ve got this.</em></h1>
            </div>
            <button
              className={`flag-button ${flags[currentQuestion.id] ? "flagged" : ""}`}
              onClick={() => setFlags((current) => ({ ...current, [currentQuestion.id]: !current[currentQuestion.id] }))}
              type="button"
            >
              <Flag size={15} /> {flags[currentQuestion.id] ? "Flagged" : "Flag for review"}
            </button>
          </div>
          <article className="question-card">
            <p className="question-text">{currentQuestion.prompt}</p>
            <div className="answer-list">
              {order.map((originalIndex, displayIndex) => (
                <button
                  aria-pressed={answers[currentQuestion.id] === originalIndex}
                  className={`answer-option ${answers[currentQuestion.id] === originalIndex ? "answer-selected" : ""}`}
                  key={originalIndex}
                  onClick={() => setAnswers((current) => ({ ...current, [currentQuestion.id]: originalIndex }))}
                  type="button"
                >
                  <span className="answer-letter">{String.fromCharCode(65 + displayIndex)}</span>
                  <span>{currentQuestion.options[originalIndex]}</span>
                  {answers[currentQuestion.id] === originalIndex && <Check size={17} />}
                </button>
              ))}
            </div>
            <div className="question-pager">
              <span>{answeredCount} of {testQuestions.length} answered</span>
              <div className="question-jumps">
                {testQuestions.map((question, index) => (
                  <button
                    aria-label={`Question ${index + 1}${flags[question.id] ? ", flagged" : ""}`}
                    className={`question-jump ${questionIndex === index ? "jump-current" : ""} ${answers[question.id] !== undefined && answers[question.id] !== null ? "jump-answered" : ""} ${flags[question.id] ? "jump-flagged" : ""}`}
                    key={question.id}
                    onClick={() => setQuestionIndex(index)}
                    type="button"
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
              <span>{warnings} / {settings.warningLimit} warnings</span>
            </div>
          </article>
          <div className="exam-actions">
            <button className="button button-quiet" disabled={questionIndex === 0} onClick={() => setQuestionIndex((index) => index - 1)} type="button">
              <ArrowLeft size={16} /> Previous
            </button>
            {questionIndex < testQuestions.length - 1 ? (
              <button className="button button-primary" onClick={() => setQuestionIndex((index) => index + 1)} type="button">
                Next question <ArrowRight size={16} />
              </button>
            ) : (
              <button
                className="button button-primary"
                onClick={() => {
                  if (window.confirm("Submit your test now?")) finishTestRef.current(false);
                }}
                type="button"
              >
                Submit test <CheckCircle2 size={16} />
              </button>
            )}
          </div>
          {notice && <p className="inline-notice exam-notice" role="status">{notice}</p>}
          <p className="exam-hint">TIP: Use A–D to answer and the arrow keys to move between questions.</p>
        </section>
      </main>
    );
  }

  if (result) {
    const percentage = scorePercent(result);
    return (
      <main className="result-page">
        <div className="result-topbar">
          <Link className="brand-lockup" href="/"><span className="brand-mark">∑</span><strong>MathsMock</strong></Link>
          <button className="button button-quiet" onClick={() => setResult(null)} type="button">Back to practice</button>
        </div>
        <section className="result-card">
          <div className={`result-medallion ${percentage >= 60 ? "result-good" : ""}`}>
            {percentage >= 60 ? <CheckCircle2 size={31} /> : <Target size={31} />}
          </div>
          <p className="eyebrow">TEST COMPLETE</p>
          <h1>{percentage >= 75 ? "Brilliant work." : percentage >= 50 ? "Good effort." : "Every attempt counts."}</h1>
          <p className="result-subtitle">{studentName}, here’s your {SUBJECT.toLowerCase()} result.</p>
          <div className="score-display"><strong>{percentage}<small>%</small></strong><span>{result.score} correct out of {result.total}</span></div>
          <div className="result-stats">
            <div><Clock3 size={16} /><span>TIME TAKEN</span><strong>{prettyDuration(result.durationSeconds)}</strong></div>
            <div><Bell size={16} /><span>WARNINGS</span><strong>{result.warnings}</strong></div>
            <div><BookOpen size={16} /><span>QUESTIONS</span><strong>{result.total}</strong></div>
          </div>
          <div className="review-list">
            <h2>Let’s review</h2>
            {result.answers.map((answer, index) => {
              const question = questions.find((item) => item.id === answer.questionId);
              if (!question) return null;
              const correct = answer.selectedIndex === question.correctIndex;
              return (
                <article className="review-item" key={answer.questionId}>
                  <div className={`review-icon ${correct ? "review-correct" : "review-incorrect"}`}>
                    {correct ? <Check size={15} /> : <X size={15} />}
                  </div>
                  <div className="review-copy">
                    <small>QUESTION {index + 1} · {question.topic}</small>
                    <strong>{question.prompt}</strong>
                    {settings.showSolutions && (
                      <p>
                        {correct ? "Correct. " : `Correct answer: ${question.options[question.correctIndex]}. `}
                        {question.working}
                      </p>
                    )}
                  </div>
                  <span className={correct ? "review-mark correct-mark" : "review-mark wrong-mark"}>{correct ? "Correct" : "Review"}</span>
                </article>
              );
            })}
          </div>
          <div className="result-bottom">
            <button className="button button-primary" onClick={() => { setResult(null); setTab("Practice"); }} type="button">
              Practice again <RotateCcw size={15} />
            </button>
            <button className="button button-quiet" onClick={() => { setResult(null); setTab("Progress"); }} type="button">
              See my progress <ArrowRight size={15} />
            </button>
          </div>
        </section>
        <footer className="result-footer">Your progress is saved to this browser and will sync to your teacher when MongoDB is connected.</footer>
        {notice && <p className="inline-notice page-notice" role="status">{notice}</p>}
      </main>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link className="brand-lockup" href="/">
          <span className="brand-mark">∑</span>
          <span><strong>MathsMock</strong><small>YEAR 10 · PRACTICE</small></span>
        </Link>
        <div className="header-right">
          <div className="student-chip"><span>{studentName.slice(0, 1).toUpperCase()}</span><strong>{studentName}</strong></div>
          <button className="icon-button" aria-label="Change student name" onClick={switchStudent} title="Change name" type="button"><LogOut size={16} /></button>
        </div>
      </header>
      <div className="app-layout">
        <aside className="student-sidebar">
          <p className="side-label">YOUR SPACE</p>
          <nav aria-label="Student navigation">
            {([
              ["Practice", <BookOpen size={17} key="practice" />],
              ["Progress", <LayoutDashboard size={17} key="progress" />],
              ["History", <Clock3 size={17} key="history" />],
              ["Inbox", <Inbox size={17} key="inbox" />],
            ] as [Tab, React.ReactNode][]).map(([item, icon]) => (
              <button className={`side-link ${tab === item ? "side-active" : ""}`} key={item} onClick={() => setTab(item)} type="button">
                {icon}<span>{item}</span>
                {item === "Inbox" && unreadCount > 0 && <span className="nav-badge">{unreadCount}</span>}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="sidebar-tip"><div className="tip-icon"><CircleHelp size={15} /></div><strong>Little and often</strong><p>A few focused questions each day add up.</p></div>
            <Link className="sidebar-teacher-link" href="/admin/login"><GraduationCap size={16} /> Teacher access</Link>
          </div>
        </aside>
        <main className="student-main">
          {notice && <div className="notice-banner" role="status"><Bell size={15} /><span>{notice}</span><button aria-label="Dismiss" onClick={() => setNotice("")} type="button"><X size={15} /></button></div>}
          {tab === "Practice" && (
            <PracticeView
              attempts={attempts}
              mix={mix}
              onCount={setQuestionCount}
              onMix={setMix}
              onStart={startTest}
              onTopics={setSelectedTopics}
              questionCount={questionCount}
              questions={questions}
              selectedTopics={selectedTopics}
              studentName={studentName}
            />
          )}
          {tab === "Progress" && <ProgressView attempts={attempts} questions={questions} onPractice={() => setTab("Practice")} />}
          {tab === "History" && <HistoryView attempts={attempts} onReview={setResult} />}
          {tab === "Inbox" && (
            <InboxView
              messages={messages}
              onDraft={setMessageDraft}
              onSend={sendMessage}
              draft={messageDraft}
              studentName={studentName}
            />
          )}
        </main>
      </div>
      <footer className="app-footer"><span>MATHEMATICS — PAPER 1</span><span>YOU’RE DOING BETTER THAN YOU THINK <span className="footer-spark">✳</span></span></footer>
    </div>
  );
}

function PracticeView(props: {
  attempts: Attempt[];
  mix: QuestionMix;
  onCount: (count: number) => void;
  onMix: (mix: QuestionMix) => void;
  onStart: () => void;
  onTopics: (topics: string[]) => void;
  questionCount: number;
  questions: Question[];
  selectedTopics: string[];
  studentName: string;
}) {
  const { attempts, mix, onCount, onMix, onStart, onTopics, questionCount, questions, selectedTopics, studentName } = props;
  const average = attempts.length
    ? Math.round(attempts.reduce((sum, attempt) => sum + scorePercent(attempt), 0) / attempts.length)
    : 0;
  const latest = attempts[0];
  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 17 ? "Good afternoon" : "Good evening";
  const topicToggle = (topic: string) => {
    if (topic === "All topics") {
      onTopics(selectedTopics.length === TOPICS.length ? [] : [...TOPICS]);
      return;
    }
    onTopics(selectedTopics.includes(topic) ? selectedTopics.filter((item) => item !== topic) : [...selectedTopics, topic]);
  };
  const mixes: { name: QuestionMix; description: string }[] = [
    { name: "Mixed", description: "A balanced spread across your chosen topics" },
    { name: "New first", description: "Questions you haven’t seen before" },
    { name: "Weak topics", description: "More practice where your score is lowest" },
    { name: "Retry mistakes", description: "Questions you got wrong last time" },
  ];

  return (
    <>
      <section className="page-intro">
        <div><p className="eyebrow">YOUR STUDY DESK</p><h1>{greeting}, {studentName.split(" ")[0]}<span className="heading-period">.</span></h1>
          <p>Year 10 Mathematics Paper 1 practice — questions styled on WAEC/NECO objectives and Cambridge IGCSE Paper 1.</p></div>
        <div className="intro-doodle" aria-hidden="true">x²<br /><span>∑</span></div>
      </section>
      <div className="practice-grid">
        <section className="panel test-builder">
          <div className="panel-heading">
            <div><p className="eyebrow">YOUR NEXT SESSION</p><h2>Start a mock test</h2></div>
            <span className="availability-pill"><span />{questions.filter((question) => question.active).length} questions available</span>
          </div>
          <div className="field-block">
            <label>Subject</label>
            <button className="select-like" type="button">{SUBJECT}<ChevronDown size={16} /></button>
          </div>
          <div className="field-block">
            <div className="label-row"><label>Topics</label><span>{selectedTopics.length} selected</span></div>
            <div className="topic-pills">
              <button className={`topic-pill ${selectedTopics.length === TOPICS.length ? "topic-selected" : ""}`} onClick={() => topicToggle("All topics")} type="button">
                {selectedTopics.length === TOPICS.length && <Check size={13} />}All topics
              </button>
              {TOPICS.map((topic) => (
                <button className={`topic-pill ${selectedTopics.includes(topic) && selectedTopics.length < TOPICS.length ? "topic-selected" : ""}`} key={topic} onClick={() => topicToggle(topic)} type="button">
                  {selectedTopics.includes(topic) && selectedTopics.length < TOPICS.length && <Check size={13} />}{topic}
                </button>
              ))}
            </div>
          </div>
          <div className="field-block">
            <div className="label-row"><label htmlFor="question-range">Number of questions</label><strong>{questionCount}</strong></div>
            <input className="range-input" id="question-range" max={20} min={5} onChange={(event) => onCount(Number(event.target.value))} step={5} type="range" value={questionCount} />
            <div className="count-options">{[5, 10, 15, 20].map((count) => <button className={questionCount === count ? "count-active" : ""} key={count} onClick={() => onCount(count)} type="button">{count}</button>)}</div>
          </div>
          <div className="field-block">
            <label>Question mix</label>
            <div className="mix-grid">
              {mixes.map((item) => (
                <button className={`mix-choice ${mix === item.name ? "mix-selected" : ""}`} key={item.name} onClick={() => onMix(item.name)} type="button">
                  <strong>{item.name}</strong><span>{item.description}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="test-start-row">
            <span><Clock3 size={15} /> {questionCount} questions · {Math.ceil(questionCount * 1.2)} min · proctored</span>
            <button className="button button-primary" disabled={!selectedTopics.length} onClick={onStart} type="button">Start proctored test <ArrowRight size={16} /></button>
          </div>
        </section>
        <aside className="practice-aside">
          <section className="panel proctor-panel">
            <div className="aside-heading"><span className="aside-icon"><LockKeyhole size={16} /></span><div><p className="eyebrow">GOOD TO KNOW</p><h3>How proctoring works</h3></div></div>
            <ul className="proctor-list">
              <li><span>01</span><p>Your timer starts when you begin. Each question gets 72 seconds.</p></li>
              <li><span>02</span><p>Stay on the test. Switching tabs or windows is recorded.</p></li>
              <li><span>03</span><p>After 3 warnings, the test submits itself.</p></li>
              <li><span>04</span><p>Your teacher can follow along and send feedback.</p></li>
            </ul>
          </section>
          <section className="snapshot-card">
            <div className="snapshot-head"><div><p className="eyebrow">A LITTLE PROGRESS</p><h3>Your snapshot</h3></div><span className="snapshot-icon"><Target size={18} /></span></div>
            <div className="snapshot-stats"><div><span>Tests taken</span><strong>{attempts.length}</strong></div><div><span>Average</span><strong>{average}%</strong></div></div>
            <div className="snapshot-progress"><span style={{ width: `${Math.min(100, (new Set(attempts.flatMap((attempt) => attempt.answers.map((answer) => answer.questionId))).size / Math.max(questions.length, 1)) * 100)}%` }} /></div>
            <p>You’ve practised {new Set(attempts.flatMap((attempt) => attempt.answers.map((answer) => answer.questionId))).size} of {questions.length} questions in this subject.</p>
            {latest && <button className="text-button" type="button">Last score: {scorePercent(latest)}%</button>}
          </section>
        </aside>
      </div>
    </>
  );
}

function ProgressView({ attempts, questions, onPractice }: { attempts: Attempt[]; questions: Question[]; onPractice: () => void }) {
  const average = attempts.length
    ? Math.round(attempts.reduce((sum, attempt) => sum + scorePercent(attempt), 0) / attempts.length)
    : 0;
  const best = attempts.length ? Math.max(...attempts.map(scorePercent)) : 0;
  const topics = TOPICS.map((topic) => {
    const scored = attempts.flatMap((attempt) =>
      attempt.answers
        .filter((answer) => questions.find((question) => question.id === answer.questionId)?.topic === topic)
        .map((answer) => ({
          correct: questions.find((question) => question.id === answer.questionId)?.correctIndex === answer.selectedIndex,
        })),
    );
    return { topic, correct: scored.filter((answer) => answer.correct).length, total: scored.length };
  });
  const practiced = new Set(attempts.flatMap((attempt) => attempt.answers.map((answer) => answer.questionId))).size;

  return (
    <>
      <section className="page-intro">
        <div><p className="eyebrow">LOOK HOW FAR YOU’VE COME</p><h1>Your progress<span className="heading-period">.</span></h1><p>Your scores from every finished test, and how you’re doing in each topic.</p></div>
      </section>
      <div className="stats-row">
        <StatCard label="Tests taken" value={String(attempts.length)} icon={<BookOpen size={17} />} />
        <StatCard label="Average score" value={`${average}%`} icon={<Target size={17} />} />
        <StatCard label="Best score" value={`${best}%`} icon={<Sparkles size={17} />} />
        <StatCard label="Questions practised" value={`${practiced} / ${questions.length}`} icon={<CheckCircle2 size={17} />} />
      </div>
      <div className="progress-columns">
        <section className="panel chart-panel"><div className="panel-heading"><div><p className="eyebrow">YOUR JOURNEY</p><h2>Score per test</h2></div><span className="chart-unit">PERCENT</span></div>
          {attempts.length ? (
            <div className="score-chart">
              {[100, 75, 50, 25, 0].map((tick) => <div className="chart-row" key={tick}><span>{tick}%</span><div className="chart-gridline"><div className="bar-track">{attempts.slice(0, 8).reverse().map((attempt, index) => <span className={`score-bar ${scorePercent(attempt) >= 75 ? "bar-high" : scorePercent(attempt) < 50 ? "bar-low" : ""}`} key={attempt.id} style={{ height: `${Math.max(4, scorePercent(attempt))}%` }} title={`Test ${attempts.length - index}: ${scorePercent(attempt)}%`} />)}</div></div></div>)}
              <div className="chart-axis"><span></span>{attempts.slice(0, 8).reverse().map((_, index) => <span key={index}>T{attempts.length - index}</span>)}</div>
            </div>
          ) : <EmptyState title="Your first score is waiting" copy="Finish a mock test and your results will show up here." icon={<Target size={20} />} action={onPractice} />}
        </section>
        <section className="panel topic-panel"><div className="panel-heading"><div><p className="eyebrow">WHERE TO FOCUS</p><h2>Topic strength</h2></div></div>
          <div className="topic-score-list">{topics.map(({ topic, correct, total }) => {
            const percentage = total ? Math.round(correct / total * 100) : null;
            return <div className="topic-score" key={topic}><div className="topic-score-copy"><span>{topic}</span><strong className={percentage === null ? "" : percentage >= 75 ? "strength-good" : percentage < 50 ? "strength-low" : "strength-mid"}>{percentage === null ? "—" : `${percentage}%`}</strong></div><div className="topic-meter"><span className={percentage !== null && percentage >= 75 ? "meter-good" : percentage !== null && percentage < 50 ? "meter-low" : ""} style={{ width: `${percentage ?? 0}%` }} /></div></div>;
          })}</div>
          <div className="strength-legend"><span><i className="legend-good" /> Strong</span><span><i className="legend-mid" /> Building</span><span><i className="legend-low" /> Needs practice</span></div>
        </section>
      </div>
      <section className="checkin-card">
        <span className="checkin-symbol">✳</span><div><p className="eyebrow">YOUR NEXT CHECK-IN</p><h2>{attempts.length >= 3 ? "You’ve earned a check-in." : `${Math.max(0, 3 - attempts.length)} more ${3 - attempts.length === 1 ? "test" : "tests"} until your next check-in.`}</h2><p>Keep practising to unlock a fresh set of topic tips and a look at how far you’ve come.</p></div><button className="button button-outline" onClick={onPractice} type="button">Start a test <ArrowRight size={15} /></button>
      </section>
    </>
  );
}

function HistoryView({ attempts, onReview }: { attempts: Attempt[]; onReview: (attempt: Attempt) => void }) {
  return (
    <>
      <section className="page-intro"><div><p className="eyebrow">EVERY STEP COUNTS</p><h1>Test history<span className="heading-period">.</span></h1><p>Open any test to see your answers and the working.</p></div></section>
      <section className="panel history-panel">
        <div className="panel-heading"><div><p className="eyebrow">YOUR SESSIONS</p><h2>Past tests</h2></div><span className="count-label">{attempts.length} {attempts.length === 1 ? "test" : "tests"}</span></div>
        {attempts.length ? <div className="history-list">{attempts.map((attempt) => (
          <article className="history-item" key={attempt.id}>
            <div className={`history-score ${scorePercent(attempt) >= 75 ? "score-green" : scorePercent(attempt) < 50 ? "score-red" : ""}`}>{scorePercent(attempt)}<small>%</small></div>
            <div className="history-copy"><strong>{attempt.subject}</strong><span>{displayDate(attempt.createdAt)} · {attempt.score}/{attempt.total} correct · {prettyDuration(attempt.durationSeconds)} taken</span></div>
            <span className="history-topic">{attempt.total} questions</span>
            <button className="button button-outline button-small" onClick={() => onReview(attempt)} type="button">Review <ArrowRight size={14} /></button>
          </article>
        ))}</div> : <EmptyState title="Your test history will live here" copy="Start your first mock test when you’re ready." icon={<Clock3 size={20} />} />}
      </section>
    </>
  );
}

function InboxView({
  draft,
  messages,
  onDraft,
  onSend,
  studentName,
}: {
  draft: string;
  messages: TeacherMessage[];
  onDraft: (value: string) => void;
  onSend: (event: React.FormEvent<HTMLFormElement>) => void;
  studentName: string;
}) {
  return (
    <>
      <section className="page-intro"><div><p className="eyebrow">A NOTE FROM YOUR TEACHER</p><h1>Your inbox<span className="heading-period">.</span></h1><p>Comments and corrections from your teacher. You can reply here too.</p></div><div className="inbox-illustration"><MessageCircle size={26} /></div></section>
      <section className="panel inbox-panel">
        {messages.length ? <div className="message-list">{messages.map((message) => (
          <article className={`message-bubble ${message.sender === "student" ? "message-mine" : ""}`} key={message.id}>
            <div className="message-meta"><strong>{message.sender === "student" ? studentName : "Your teacher"}</strong><span>{displayDate(message.createdAt)}</span></div>
            <p>{message.message}</p>
          </article>
        ))}</div> : <EmptyState title="No messages just yet" copy="When your teacher sends a correction or a note, you’ll find it here." icon={<Inbox size={20} />} />}
        <form className="message-compose" onSubmit={onSend}>
          <label htmlFor="student-message">Write to your teacher</label>
          <div><input id="student-message" maxLength={1000} onChange={(event) => onDraft(event.target.value)} placeholder="Ask a question or share a thought…" value={draft} /><button className="button button-primary" disabled={!draft.trim()} type="submit">Send <Send size={14} /></button></div>
          <small>Your message is only delivered when MongoDB is connected.</small>
        </form>
      </section>
    </>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <article className="stat-card"><span className="stat-icon">{icon}</span><span className="stat-label">{label}</span><strong>{value}</strong></article>;
}

function EmptyState({ action, copy, icon, title }: { action?: () => void; copy: string; icon: React.ReactNode; title: string }) {
  return <div className="empty-state"><span className="empty-icon">{icon}</span><h3>{title}</h3><p>{copy}</p>{action && <button className="text-button" onClick={action} type="button">Go to practice <ArrowRight size={14} /></button>}</div>;
}
