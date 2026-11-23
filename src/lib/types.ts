export type Question = {
  id: string;
  topic: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  working: string;
  active: boolean;
};

export type AttemptAnswer = {
  questionId: string;
  selectedIndex: number | null;
  flagged: boolean;
};

export type Attempt = {
  id: string;
  studentId?: string;
  studentName: string;
  subject: string;
  answers: AttemptAnswer[];
  score: number;
  total: number;
  warnings: number;
  durationSeconds: number;
  createdAt: string;
  status: "active" | "completed";
  startedAt?: string;
  lastActivityAt?: string;
  currentQuestion?: number;
};

export type SiteSettings = {
  secondsPerQuestion: number;
  warningLimit: number;
  autoSubmitOnWarnings: boolean;
  fullscreenRequired: boolean;
  shuffleOptions: boolean;
  showSolutions: boolean;
};

export type TeacherMessage = {
  id: string;
  studentId: string;
  studentName: string;
  message: string;
  sender: "student" | "teacher";
  createdAt: string;
  read: boolean;
};

export type StudentIdentity = {
  id: string;
  name: string;
};

export type StudentSummary = StudentIdentity & {
  lastSeenAt: string;
};

export type StudentSessionDocument = StudentIdentity & {
  tokenHash: string;
  createdAt: string;
  lastSeenAt: string;
};
