"use client";

import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  Check,
  CheckCircle2,
  Clock3,
  Eye,
  EyeOff,
  FileQuestion,
  Inbox,
  LogOut,
  MessageSquareText,
  RefreshCw,
  Save,
  Send,
  Settings,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { TOPICS } from "@/lib/questions";
import type { Attempt, Question, SiteSettings, StudentSummary, TeacherMessage } from "@/lib/types";

type AdminTab = "Live" | "Students" | "Attempts" | "Question bank" | "Messages" | "Settings";
type DashboardData = {
  attempts: Attempt[];
  questions: Question[];
  messages: TeacherMessage[];
  students: StudentSummary[];
  settings: SiteSettings;
};

const emptyData: DashboardData = {
  attempts: [],
  questions: [],
  messages: [],
  students: [],
  settings: {
    secondsPerQuestion: 72,
    warningLimit: 3,
    autoSubmitOnWarnings: true,
    fullscreenRequired: true,
    shuffleOptions: true,
    showSolutions: true,
  },
};

const tabs: { name: AdminTab; icon: React.ReactNode }[] = [
  { name: "Live", icon: <Activity size={16} /> },
  { name: "Students", icon: <Users size={16} /> },
  { name: "Attempts", icon: <CheckCircle2 size={16} /> },
  { name: "Question bank", icon: <FileQuestion size={16} /> },
  { name: "Messages", icon: <MessageSquareText size={16} /> },
  { name: "Settings", icon: <Settings size={16} /> },
];

function percentage(attempt: Attempt) {
  return attempt.total ? Math.round((attempt.score / attempt.total) * 100) : 0;
}

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function remainingTime(attempt: Attempt) {
  const startedAt = attempt.startedAt ?? attempt.createdAt;
  const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  return Math.max(0, attempt.durationSeconds - elapsed);
}

function shortDate(date: string) {
  return new Date(date).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminDashboard() {
  const router = useRouter();
  const [tab, setTab] = useState<AdminTab>("Live");
  const [data, setData] = useState<DashboardData>(emptyData);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState("All students");
  const [selectedAttempt, setSelectedAttempt] = useState<Attempt | null>(null);
  const [questionFormOpen, setQuestionFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/dashboard", { cache: "no-store" });
      const result = (await response.json()) as DashboardData & { error?: string };
      if (response.status === 401) {
        router.replace("/admin/login");
        return;
      }
      if (!response.ok) throw new Error(result.error || "The admin dashboard could not be loaded.");
      setData(result);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The admin dashboard could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), 15000);
    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(timer);
    };
  }, [refresh]);

  const activeAttempts = data.attempts.filter((attempt) => attempt.status === "active");
  const completedAttempts = data.attempts.filter((attempt) => attempt.status === "completed");
  const shownAttempts = completedAttempts.filter((attempt) => selectedStudent === "All students" || attempt.studentId === selectedStudent);

  const signOut = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  };

  const toggleQuestion = async (question: Question) => {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/questions/${encodeURIComponent(question.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !question.active }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Question could not be updated.");
      setData((current) => ({
        ...current,
        questions: current.questions.map((item) => item.id === question.id ? { ...item, active: !item.active } : item),
      }));
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Question could not be updated.");
    } finally {
      setSaving(false);
    }
  };

  const sendTeacherMessage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const formData = new FormData(formElement);
    const studentId = String(formData.get("studentId") || "");
    const message = String(formData.get("message") || "").trim();
    if (!studentId || !message) return;
    setSaving(true);
    try {
      const response = await fetch("/api/admin/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, message }),
      });
      const result = (await response.json()) as { message?: TeacherMessage; error?: string };
      if (!response.ok || !result.message) throw new Error(result.error || "Message could not be sent.");
      setData((current) => ({ ...current, messages: [result.message!, ...current.messages] }));
      formElement.reset();
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Message could not be sent.");
    } finally {
      setSaving(false);
    }
  };

  const saveSettings = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const settings: SiteSettings = {
      secondsPerQuestion: Number(form.get("secondsPerQuestion")),
      warningLimit: Number(form.get("warningLimit")),
      autoSubmitOnWarnings: form.get("autoSubmitOnWarnings") === "on",
      fullscreenRequired: form.get("fullscreenRequired") === "on",
      shuffleOptions: form.get("shuffleOptions") === "on",
      showSolutions: form.get("showSolutions") === "on",
    };
    setSaving(true);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const result = (await response.json()) as { settings?: SiteSettings; error?: string };
      if (!response.ok || !result.settings) throw new Error(result.error || "Settings could not be saved.");
      setData((current) => ({ ...current, settings: result.settings! }));
      setError("Settings saved.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Settings could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <Link className="brand-lockup" href="/"><span className="brand-mark">∑</span><span><strong>MathsMock</strong><small>TEACHER DASHBOARD</small></span></Link>
        <div className="admin-header-right"><span className="sync-status"><span /> LIVE SYNC</span><button className="admin-icon-button" aria-label="Refresh dashboard" onClick={() => void refresh()} type="button"><RefreshCw size={16} /></button><button className="admin-logout" onClick={() => void signOut()} type="button"><LogOut size={15} /> Sign out</button></div>
      </header>
      <div className="admin-layout">
        <aside className="admin-sidebar">
          <p className="side-label">TEACHING</p>
          <nav aria-label="Admin navigation">
            {tabs.map((item) => {
              const badge = item.name === "Live" ? activeAttempts.length : item.name === "Messages" ? data.messages.filter((message) => message.sender === "student" && !message.read).length : 0;
              return <button className={`admin-side-link ${tab === item.name ? "admin-side-active" : ""}`} key={item.name} onClick={() => setTab(item.name)} type="button">{item.icon}<span>{item.name}</span>{badge > 0 && <span className="nav-badge">{badge}</span>}</button>;
            })}
          </nav>
          <div className="admin-side-bottom"><div className="teacher-card"><span className="teacher-avatar">T</span><div><strong>Teacher</strong><small>Administrator</small></div></div><Link href="/" className="view-student-link"><ArrowUpRight size={15} /> View student page</Link></div>
        </aside>
        <main className="admin-main">
          {error && <div className={`admin-alert ${error.endsWith("saved.") ? "admin-success" : ""}`} role="status"><span>{error}</span><button aria-label="Dismiss" onClick={() => setError("")} type="button"><X size={15} /></button></div>}
          {loading && <div className="admin-loading"><RefreshCw size={18} /> Connecting to your class data…</div>}
          {!loading && tab === "Live" && <LiveView activeAttempts={activeAttempts} completedAttempts={completedAttempts} onMessage={() => setTab("Messages")} onReview={setSelectedAttempt} onTab={setTab} />}
          {!loading && tab === "Students" && <StudentsView attempts={completedAttempts} students={data.students} onFilter={setSelectedStudent} onTab={setTab} />}
          {!loading && tab === "Attempts" && <AttemptsView attempts={shownAttempts} students={data.students} selectedStudent={selectedStudent} onFilter={setSelectedStudent} onReview={setSelectedAttempt} />}
          {!loading && tab === "Question bank" && <QuestionBankView data={data} onAdd={() => setQuestionFormOpen(true)} onToggle={toggleQuestion} saving={saving} />}
          {!loading && tab === "Messages" && <MessagesView data={data} onSend={sendTeacherMessage} saving={saving} />}
          {!loading && tab === "Settings" && <SettingsView data={data} onSave={saveSettings} saving={saving} />}
          {selectedAttempt && <AttemptModal attempt={selectedAttempt} onClose={() => setSelectedAttempt(null)} questions={data.questions} />}
          {questionFormOpen && <QuestionForm onClose={() => setQuestionFormOpen(false)} onCreated={(question) => { setData((current) => ({ ...current, questions: [...current.questions, question] })); setQuestionFormOpen(false); }} setError={setError} />}
        </main>
      </div>
    </div>
  );
}

function AdminPageIntro({ eyebrow, title, copy, action }: { eyebrow: string; title: string; copy: string; action?: React.ReactNode }) {
  return <section className="admin-page-intro"><div><p className="eyebrow">{eyebrow}</p><h1>{title}<span>.</span></h1><p>{copy}</p></div>{action}</section>;
}

function LiveView({ activeAttempts, completedAttempts, onMessage, onReview, onTab }: { activeAttempts: Attempt[]; completedAttempts: Attempt[]; onMessage: () => void; onReview: (attempt: Attempt) => void; onTab: (tab: AdminTab) => void }) {
  const recent = completedAttempts.slice(0, 5);
  return (
    <>
      <AdminPageIntro eyebrow="THE CLASSROOM AT A GLANCE" title="Live monitor" copy="Tests in progress appear here as they happen — answers, current question, time left, and proctor warnings." />
      <div className="live-grid">
        <section className="admin-panel live-panel"><div className="admin-panel-heading"><div><p className="eyebrow">RIGHT NOW</p><h2>In progress <span className="live-count">{activeAttempts.length} live</span></h2></div><span className="live-pulse"><span /></span></div>
          {activeAttempts.length ? <div className="live-student-list">{activeAttempts.map((attempt) => (
            <article className="live-student-row" key={attempt.id}><div className="student-avatar">{attempt.studentName.slice(0, 1).toUpperCase()}</div><div className="live-student-copy"><strong>{attempt.studentName} <small>· {attempt.subject}</small></strong><span>Question {attempt.currentQuestion ?? 1} of {attempt.total} · {attempt.answers.filter((answer) => answer.selectedIndex !== null).length} answered</span><div className="live-progress"><span style={{ width: `${Math.min(100, (attempt.answers.filter((answer) => answer.selectedIndex !== null).length / attempt.total) * 100)}%` }} /></div></div><div className="live-time"><Clock3 size={14} />{formatTime(remainingTime(attempt))}</div><div className={`warning-count ${attempt.warnings ? "has-warning" : ""}`}><Bell size={13} />{attempt.warnings} warnings</div><button className="admin-text-button" onClick={onMessage} type="button">Message <ArrowRight size={13} /></button></article>
          ))}</div> : <div className="admin-empty"><span className="empty-icon"><Activity size={20} /></span><h3>Nobody is taking a test right now.</h3><p>This page updates automatically while students are working.</p></div>}
        </section>
        <section className="admin-panel recent-panel"><div className="admin-panel-heading"><div><p className="eyebrow">JUST IN</p><h2>Recent submissions</h2></div><button className="admin-text-button" onClick={() => onTab("Attempts")} type="button">All attempts <ArrowRight size={13} /></button></div>
          {recent.length ? <div className="recent-attempts">{recent.map((attempt) => <button className="recent-attempt-row" key={attempt.id} onClick={() => onReview(attempt)} type="button"><span className={`recent-score ${percentage(attempt) >= 75 ? "score-green" : percentage(attempt) < 50 ? "score-red" : ""}`}>{percentage(attempt)}%</span><span className="recent-attempt-copy"><strong>{attempt.studentName}</strong><small>{attempt.subject} · {shortDate(attempt.createdAt)}</small></span><ArrowRight size={15} /></button>)}</div> : <p className="no-records">Finished tests will appear here.</p>}
        </section>
      </div>
    </>
  );
}

function StudentsView({ attempts, students, onFilter, onTab }: { attempts: Attempt[]; students: StudentSummary[]; onFilter: (student: string) => void; onTab: (tab: AdminTab) => void }) {
  return (
    <>
      <AdminPageIntro eyebrow="YOUR LEARNERS" title="Students" copy="Everyone who has taken a mock test. Select a student to filter their attempts." />
      <section className="admin-panel student-table-panel"><div className="admin-panel-heading"><div><p className="eyebrow">CLASS LIST</p><h2>{students.length} {students.length === 1 ? "student" : "students"}</h2></div></div>
        {students.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>STUDENT</th><th>TESTS TAKEN</th><th>AVERAGE</th><th>LAST ACTIVE</th><th></th></tr></thead><tbody>{students.map((student) => {
          const studentAttempts = attempts.filter((attempt) => attempt.studentId === student.id);
          const average = studentAttempts.length ? Math.round(studentAttempts.reduce((sum, attempt) => sum + percentage(attempt), 0) / studentAttempts.length) : 0;
          return <tr key={student.id}><td><span className="table-student"><i>{student.name.slice(0, 1).toUpperCase()}</i><strong>{student.name}</strong></span></td><td>{studentAttempts.length}</td><td><span className={average >= 75 ? "strength-good" : average < 50 ? "strength-low" : ""}>{average}%</span></td><td>{shortDate(student.lastSeenAt)}</td><td><button className="table-action" onClick={() => { onFilter(student.id); onTab("Attempts"); }} type="button">View attempts <ArrowRight size={13} /></button></td></tr>;
        })}</tbody></table></div> : <div className="admin-empty"><span className="empty-icon"><Users size={20} /></span><h3>No students yet</h3><p>Share the student page and ask each student to enter their name and complete a test.</p></div>}
      </section>
    </>
  );
}

function AttemptsView({ attempts, students, selectedStudent, onFilter, onReview }: { attempts: Attempt[]; students: StudentSummary[]; selectedStudent: string; onFilter: (student: string) => void; onReview: (attempt: Attempt) => void }) {
  return (
    <>
      <AdminPageIntro eyebrow="MARKING & FEEDBACK" title="All attempts" copy="Open a test to review answers and see the student’s score." />
      <section className="admin-panel attempts-panel"><div className="admin-panel-heading"><div><p className="eyebrow">SUBMISSIONS</p><h2>{attempts.length} {attempts.length === 1 ? "attempt" : "attempts"}</h2></div><select className="admin-select" onChange={(event) => onFilter(event.target.value)} value={selectedStudent}><option value="All students">All students</option>{students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}</select></div>
        {attempts.length ? <div className="attempt-list">{attempts.map((attempt) => <article className="attempt-row" key={attempt.id}><div className={`history-score ${percentage(attempt) >= 75 ? "score-green" : percentage(attempt) < 50 ? "score-red" : ""}`}>{percentage(attempt)}<small>%</small></div><div className="attempt-main"><strong>{attempt.studentName} <span>· {attempt.subject}</span></strong><small>{shortDate(attempt.createdAt)} · {attempt.score}/{attempt.total} correct · {formatTime(attempt.durationSeconds)} taken</small></div><span className={`attempt-tag ${attempt.warnings ? "attempt-warn" : ""}`}>{attempt.warnings ? `${attempt.warnings} warnings` : "No warnings"}</span><button className="button button-outline button-small" onClick={() => onReview(attempt)} type="button">Review <Eye size={14} /></button></article>)}</div> : <div className="admin-empty"><span className="empty-icon"><CheckCircle2 size={20} /></span><h3>No finished attempts</h3><p>Completed student tests will appear here.</p></div>}
      </section>
    </>
  );
}

function QuestionBankView({ data, onAdd, onToggle, saving }: { data: DashboardData; onAdd: () => void; onToggle: (question: Question) => void; saving: boolean }) {
  const [topic, setTopic] = useState("All topics");
  const questions = data.questions.filter((question) => topic === "All topics" || question.topic === topic);
  return (
    <>
      <AdminPageIntro eyebrow="BUILD YOUR PAPER" title="Question bank" copy="Manage the questions students see in their practice tests." action={<button className="button button-primary" onClick={onAdd} type="button">Add question <ArrowRight size={15} /></button>} />
      <section className="admin-panel question-bank-panel"><div className="admin-panel-heading"><div><p className="eyebrow">{data.questions.filter((question) => question.active).length} ACTIVE QUESTIONS</p><h2>{data.questions.length} questions in the bank</h2></div><select className="admin-select" onChange={(event) => setTopic(event.target.value)} value={topic}><option>All topics</option>{[...new Set([...TOPICS, ...data.questions.map((question) => question.topic)])].map((item) => <option key={item}>{item}</option>)}</select></div>
        <div className="question-list">{questions.map((question) => <article className={`bank-question ${!question.active ? "question-disabled" : ""}`} key={question.id}><div className="question-meta"><span className="question-id">{question.id}</span><span className="question-topic">{question.topic}</span>{!question.active && <span className="hidden-badge">Hidden</span>}</div><p className="bank-question-prompt">{question.prompt}</p><div className="bank-options">{question.options.map((option, index) => <span className={question.correctIndex === index ? "bank-option-correct" : ""} key={index}><b>{String.fromCharCode(65 + index)}</b> {option}</span>)}</div><div className="bank-question-footer"><small>{question.working}</small><button className="table-action" disabled={saving} onClick={() => onToggle(question)} type="button">{question.active ? <><EyeOff size={14} /> Hide</> : <><Eye size={14} /> Restore</>}</button></div></article>)}</div>
      </section>
    </>
  );
}

function MessagesView({ data, onSend, saving }: { data: DashboardData; onSend: (event: React.FormEvent<HTMLFormElement>) => void; saving: boolean }) {
  return (
    <>
      <AdminPageIntro eyebrow="KEEP THE CONVERSATION GOING" title="Messages" copy="Send comments and corrections. Students can reply from their inbox." />
      <div className="messages-admin-grid">
        <section className="admin-panel message-history-panel"><div className="admin-panel-heading"><div><p className="eyebrow">RECENT CONVERSATIONS</p><h2>{data.messages.length} messages</h2></div><Inbox size={18} /></div>
          {data.messages.length ? <div className="admin-message-list">{[...data.messages].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((message) => <article className="admin-message" key={message.id}><div className="admin-message-heading"><strong>{message.studentName}</strong><span className={`sender-tag sender-${message.sender}`}>{message.sender === "student" ? "Student" : "Teacher"}</span><time>{shortDate(message.createdAt)}</time></div><p>{message.message}</p></article>)}</div> : <div className="admin-empty"><span className="empty-icon"><MessageSquareText size={20} /></span><h3>No messages yet</h3><p>Your conversations with students will show up here.</p></div>}
        </section>
        <section className="admin-panel compose-panel"><div className="admin-panel-heading"><div><p className="eyebrow">SEND A NOTE</p><h2>New message</h2></div><Send size={17} /></div>
          {data.students.length ? <form className="admin-compose-form" onSubmit={onSend}><label htmlFor="message-student">Student</label><select className="admin-select" id="message-student" name="studentId" required><option value="">Choose a student</option>{data.students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}</select><label htmlFor="teacher-message">Message</label><textarea id="teacher-message" maxLength={1000} name="message" placeholder="Write feedback or a correction…" required rows={6} /><button className="button button-primary" disabled={saving} type="submit">Send message <ArrowRight size={15} /></button></form> : <p className="no-records">Students appear here after they enter their name on the practice page.</p>}
        </section>
      </div>
    </>
  );
}

function SettingsView({ data, onSave, saving }: { data: DashboardData; onSave: (event: React.FormEvent<HTMLFormElement>) => void; saving: boolean }) {
  return (
    <>
      <AdminPageIntro eyebrow="MAKE IT YOURS" title="Settings" copy="These preferences apply to every new test." />
      <div className="settings-layout">
        <form className="admin-panel settings-form" onSubmit={onSave}>
          <div className="admin-panel-heading"><div><p className="eyebrow">TEST BEHAVIOUR</p><h2>Proctoring & timing</h2></div><Settings size={18} /></div>
          <div className="settings-number-row"><label htmlFor="seconds-per-question">Seconds per question</label><input id="seconds-per-question" max={300} min={15} name="secondsPerQuestion" required type="number" defaultValue={data.settings.secondsPerQuestion} /><small>72 seconds is close to WAEC objective pacing.</small></div>
          <div className="settings-number-row"><label htmlFor="warning-limit">Warnings before auto-submit</label><input id="warning-limit" max={10} min={1} name="warningLimit" required type="number" defaultValue={data.settings.warningLimit} /></div>
          <SettingsToggle name="autoSubmitOnWarnings" checked={data.settings.autoSubmitOnWarnings} title="Auto-submit at the warning limit" copy="Submit automatically when the student reaches the warning limit." />
          <SettingsToggle name="fullscreenRequired" checked={data.settings.fullscreenRequired} title="Request full screen" copy="Leaving full screen during a test counts as a warning." />
          <SettingsToggle name="shuffleOptions" checked={data.settings.shuffleOptions} title="Shuffle answer options" copy="Mix the order of answer choices for each test." />
          <SettingsToggle name="showSolutions" checked={data.settings.showSolutions} title="Show answers and working" copy="Show the correct answer and explanation after submission." />
          <button className="button button-primary settings-save" disabled={saving} type="submit"><Save size={15} /> Save settings</button>
        </form>
        <aside className="admin-panel sharing-panel"><span className="sharing-icon"><BookOpen size={17} /></span><p className="eyebrow">STUDENT ACCESS</p><h2>Share the practice page</h2><p>Students can start from the home page. They only need to enter their name — there’s no student login.</p><Link className="share-url" href="/">Open student page <ArrowRight size={14} /></Link><div className="sharing-foot"><LockKeyholeSmall /> Student results sync here when MongoDB is configured.</div></aside>
      </div>
    </>
  );
}

function LockKeyholeSmall() {
  return <span aria-hidden="true">↗</span>;
}

function SettingsToggle({ checked, copy, name, title }: { checked: boolean; copy: string; name: string; title: string }) {
  return <label className="settings-toggle"><input defaultChecked={checked} name={name} type="checkbox" /><span className="toggle-switch" /><span className="toggle-copy"><strong>{title}</strong><small>{copy}</small></span></label>;
}

function AttemptModal({ attempt, onClose, questions }: { attempt: Attempt; onClose: () => void; questions: Question[] }) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }} role="presentation">
      <section aria-labelledby="attempt-modal-title" aria-modal="true" className="attempt-modal" role="dialog">
        <header className="modal-header"><div><p className="eyebrow">ATTEMPT REVIEW</p><h2 id="attempt-modal-title">{attempt.studentName} · {percentage(attempt)}%</h2><small>{shortDate(attempt.createdAt)} · {attempt.score} of {attempt.total} correct</small></div><button aria-label="Close review" className="admin-icon-button" onClick={onClose} type="button"><X size={18} /></button></header>
        <div className="modal-answers">{attempt.answers.map((answer, index) => {
          const question = questions.find((item) => item.id === answer.questionId);
          if (!question) return null;
          const correct = answer.selectedIndex === question.correctIndex;
          return <article className="modal-answer" key={answer.questionId}><span className={`modal-result ${correct ? "result-yes" : "result-no"}`}>{correct ? <Check size={14} /> : <X size={14} />}</span><div><small>QUESTION {index + 1} · {question.topic}</small><strong>{question.prompt}</strong><p>Your answer: {answer.selectedIndex === null ? "Not answered" : question.options[answer.selectedIndex]}{!correct && <span> · Correct: {question.options[question.correctIndex]}</span>}</p><em>{question.working}</em></div></article>;
        })}</div>
      </section>
    </div>
  );
}

function QuestionForm({ onClose, onCreated, setError }: { onClose: () => void; onCreated: (question: Question) => void; setError: (message: string) => void }) {
  const [saving, setSaving] = useState(false);
  const [topic, setTopic] = useState(TOPICS[0]);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const options = [0, 1, 2, 3].map((index) => String(form.get(`option${index}`) || ""));
    setSaving(true);
    try {
      const response = await fetch("/api/admin/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          prompt: form.get("prompt"),
          options,
          correctIndex: Number(form.get("correctIndex")),
          working: form.get("working"),
        }),
      });
      const data = (await response.json()) as { question?: Question; error?: string };
      if (!response.ok || !data.question) throw new Error(data.error || "Question could not be added.");
      setError("");
      onCreated(data.question);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Question could not be added.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }} role="presentation">
      <section aria-labelledby="question-form-title" aria-modal="true" className="question-form-modal" role="dialog">
        <header className="modal-header"><div><p className="eyebrow">QUESTION BANK</p><h2 id="question-form-title">Add a question</h2></div><button aria-label="Close form" className="admin-icon-button" onClick={onClose} type="button"><X size={18} /></button></header>
        <form className="question-create-form" onSubmit={submit}>
          <label htmlFor="question-topic">Topic</label><select id="question-topic" onChange={(event) => setTopic(event.target.value)} value={topic}>{TOPICS.map((item) => <option key={item}>{item}</option>)}</select>
          <label htmlFor="question-prompt">Question</label><textarea id="question-prompt" maxLength={1000} name="prompt" required rows={3} />
          <div className="option-form-grid">{[0, 1, 2, 3].map((index) => <div key={index}><label htmlFor={`question-option-${index}`}>Option {String.fromCharCode(65 + index)}</label><input id={`question-option-${index}`} maxLength={300} name={`option${index}`} required /></div>)}</div>
          <label htmlFor="correct-option">Correct answer</label><select id="correct-option" name="correctIndex">{[0, 1, 2, 3].map((index) => <option key={index} value={index}>Option {String.fromCharCode(65 + index)}</option>)}</select>
          <label htmlFor="question-working">Working / explanation</label><textarea id="question-working" maxLength={2000} name="working" rows={3} />
          <div className="modal-actions"><button className="button button-quiet" onClick={onClose} type="button">Cancel</button><button className="button button-primary" disabled={saving} type="submit">{saving ? "Saving…" : "Add question"} <ArrowRight size={14} /></button></div>
        </form>
      </section>
    </div>
  );
}
