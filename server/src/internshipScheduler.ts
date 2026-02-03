import {
  evaluateAndPromoteBadge,
  lockExpiredAssignments,
  maybeIssueV2CertificateByEnrollment,
  recomputeAssignmentScheduleForEnrollment,
  seedAssignmentsForEnrollment,
} from "./internships";
import { prisma } from "./db";

let started = false;
let running = false;

async function syncEnrollment(enrollmentId: string) {
  await seedAssignmentsForEnrollment(enrollmentId);
  await recomputeAssignmentScheduleForEnrollment(enrollmentId);
  await lockExpiredAssignments(enrollmentId);
  await evaluateAndPromoteBadge(enrollmentId, null);
  await maybeIssueV2CertificateByEnrollment(enrollmentId);
}

async function tick() {
  if (running) return;
  running = true;
  try {
    const enrollments = await prisma.internshipEnrollment.findMany({
      where: {
        status: { in: ["ACTIVE", "FROZEN", "COMPLETED"] as any } as any,
      } as any,
      select: { id: true },
      take: 250,
    });

    for (const e of enrollments) {
      try {
        await syncEnrollment(String(e.id));
      } catch {
        // ignore individual errors
      }
    }
  } finally {
    running = false;
  }
}

export function startInternshipScheduler() {
  if (started) return;
  started = true;
  tick().catch(() => {});
  setInterval(() => void tick(), 5 * 60 * 1000);
}
