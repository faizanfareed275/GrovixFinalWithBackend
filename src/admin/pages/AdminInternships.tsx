import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { readJson, writeJson } from "@/admin/lib/storage";

export default function AdminInternships() {
  const [enrolled, setEnrolled] = useState<any[]>([]);
  const [completed, setCompleted] = useState<any[]>([]);

  useEffect(() => {
    setEnrolled(readJson<any[]>("youthxp_enrolled_internships", []));
    setCompleted(readJson<any[]>("youthxp_completed_internships", []));
  }, []);

  const persistEnrolled = (next: any[]) => {
    setEnrolled(next);
    writeJson("youthxp_enrolled_internships", next);
  };

  const persistCompleted = (next: any[]) => {
    setCompleted(next);
    writeJson("youthxp_completed_internships", next);
  };

  return (
    <div className="space-y-6">
      <div className="glass-card p-6">
        <h1 className="text-2xl font-display font-bold">Internships</h1>
        <p className="text-muted-foreground mt-1">Manage enrolled and completed internships.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="glass-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div>
              <div className="font-display font-bold">Enrolled</div>
              <div className="text-xs text-muted-foreground">youthxp_enrolled_internships</div>
            </div>
            <Button variant="destructive" onClick={() => persistEnrolled([])}>Clear</Button>
          </div>
          <div className="divide-y divide-border">
            {enrolled.map((i, idx) => (
              <div key={idx} className="px-4 py-3 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-medium truncate">{i.title || `Internship #${i.id || idx}`}</div>
                  <div className="text-xs text-muted-foreground">{i.company || ""}</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => persistEnrolled(enrolled.filter((_, j) => j !== idx))}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            {enrolled.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">No enrollments found.</div>
            )}
          </div>
        </div>

        <div className="glass-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div>
              <div className="font-display font-bold">Completed</div>
              <div className="text-xs text-muted-foreground">youthxp_completed_internships</div>
            </div>
            <Button variant="destructive" onClick={() => persistCompleted([])}>Clear</Button>
          </div>
          <div className="divide-y divide-border">
            {completed.map((i, idx) => (
              <div key={idx} className="px-4 py-3 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-medium truncate">{`Internship #${i.id ?? idx}`}</div>
                  <div className="text-xs text-muted-foreground">{i.completionDate || ""}</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => persistCompleted(completed.filter((_, j) => j !== idx))}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            {completed.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">No completed internships found.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
