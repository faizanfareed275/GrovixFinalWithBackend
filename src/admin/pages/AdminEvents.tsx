import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

export default function AdminEvents() {
  const [registrations, setRegistrations] = useState<any[]>([]);

  useEffect(() => {
    apiFetch<{ enrollments: any[] }>("/events/admin/enrollments")
      .then((d) => setRegistrations(Array.isArray(d?.enrollments) ? d.enrollments : []))
      .catch(() => setRegistrations([]));
  }, []);

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Event Registrations</h1>
          <p className="text-muted-foreground mt-1">Manage registrations stored in the database.</p>
        </div>
        <Button variant="outline" onClick={() => window.location.reload()}>Refresh</Button>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-border text-xs text-muted-foreground">
          <div className="col-span-4">Event</div>
          <div className="col-span-3">Name</div>
          <div className="col-span-3">Email</div>
          <div className="col-span-1">Phone</div>
          <div className="col-span-1 text-right">Action</div>
        </div>

        <div className="divide-y divide-border">
          {registrations.map((r, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 px-4 py-3 items-center">
              <div className="col-span-4 font-medium truncate">{r.event?.title || `Event #${r.eventId || idx}`}</div>
              <div className="col-span-3 text-sm text-muted-foreground truncate">{r.user?.name || r.name || ""}</div>
              <div className="col-span-3 text-sm text-muted-foreground truncate">{r.user?.email || r.email || ""}</div>
              <div className="col-span-1 text-xs text-muted-foreground truncate">{r.phone || ""}</div>
              <div className="col-span-1 flex justify-end">
                <Button variant="ghost" size="sm" disabled>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}

          {registrations.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">No registrations found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
