import type { InternshipTask, TaskSubmissionData } from "@/components/InternshipProgress";

export const INTERNSHIP_TASKS_KEY_PREFIX = "youthxp_internship_tasks_";
export const INTERNSHIP_SUBMISSIONS_KEY_PREFIX = "youthxp_internship_submissions_";

export type InternshipTaskDefinition = Omit<InternshipTask, "completed" | "submission">;

export type InternshipTaskSubmissionRecord = {
  internshipId: number;
  taskId: number;
  userId: string;
  userName?: string;
  submission: TaskSubmissionData;
  status: "submitted" | "approved" | "rejected";
  adminFeedback?: string;
  reviewedAt?: string;
};

export function tasksKey(internshipId: number) {
  return `${INTERNSHIP_TASKS_KEY_PREFIX}${internshipId}`;
}

export function submissionsKey(internshipId: number) {
  return `${INTERNSHIP_SUBMISSIONS_KEY_PREFIX}${internshipId}`;
}

export function readTasks(internshipId: number, fallback: InternshipTaskDefinition[] = []): InternshipTaskDefinition[] {
  try {
    const raw = localStorage.getItem(tasksKey(internshipId));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as InternshipTaskDefinition[]) : fallback;
  } catch {
    return fallback;
  }
}

export function writeTasks(internshipId: number, tasks: InternshipTaskDefinition[]) {
  localStorage.setItem(tasksKey(internshipId), JSON.stringify(tasks));
  window.dispatchEvent(new StorageEvent("storage", { key: tasksKey(internshipId), newValue: JSON.stringify(tasks) }));
}

export function readSubmissions(internshipId: number): InternshipTaskSubmissionRecord[] {
  try {
    const raw = localStorage.getItem(submissionsKey(internshipId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as InternshipTaskSubmissionRecord[]) : [];
  } catch {
    return [];
  }
}

export function writeSubmissions(internshipId: number, records: InternshipTaskSubmissionRecord[]) {
  localStorage.setItem(submissionsKey(internshipId), JSON.stringify(records));
  window.dispatchEvent(new StorageEvent("storage", { key: submissionsKey(internshipId), newValue: JSON.stringify(records) }));
}
