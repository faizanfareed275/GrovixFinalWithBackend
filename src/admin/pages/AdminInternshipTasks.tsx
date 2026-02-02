import { useEffect, useMemo, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { internships as internshipsCatalog } from "@/data/internships";
import {
  readTasks,
  writeTasks,
  type InternshipTaskDefinition,
} from "@/data/internshipAssignments";

const emptyTask: InternshipTaskDefinition = {
  id: 1,
  title: "",
  description: "",
  xpReward: 100,
  week: 1,
};

export default function AdminInternshipTasks() {
  const internships = useMemo(() => internshipsCatalog, []);
  const [internshipId, setInternshipId] = useState<number>(internships[0]?.id || 1);
  const [tasks, setTasks] = useState<InternshipTaskDefinition[]>([]);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<InternshipTaskDefinition>(emptyTask);
  const [attachmentKind, setAttachmentKind] = useState<"none" | "image" | "document" | "link">("none");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [attachmentName, setAttachmentName] = useState("");

  useEffect(() => {
    setTasks(readTasks(internshipId, []));
  }, [internshipId]);

  const persist = (next: InternshipTaskDefinition[]) => {
    setTasks(next);
    writeTasks(internshipId, next);
  };

  const nextTaskId = () => {
    const max = tasks.reduce((m, t) => Math.max(m, t.id), 0);
    return max + 1;
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyTask, id: nextTaskId() });
    setAttachmentKind("none");
    setAttachmentUrl("");
    setAttachmentName("");
    setOpen(true);
  };

  const openEdit = (t: InternshipTaskDefinition) => {
    setEditingId(t.id);
    setForm({ ...t });
    const att = (t as any).attachment;
    if (att?.type) {
      setAttachmentKind(att.type);
      setAttachmentUrl(att.url || "");
      setAttachmentName(att.name || "");
    } else {
      setAttachmentKind("none");
      setAttachmentUrl("");
      setAttachmentName("");
    }
    setOpen(true);
  };

  const handleAttachmentFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) return;
      setAttachmentUrl(result);
      setAttachmentName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (!form.title.trim()) {
      toast.error("Task title is required");
      return;
    }

    const attachment =
      attachmentKind === "none" || !attachmentUrl.trim()
        ? undefined
        : {
            type: attachmentKind,
            url: attachmentUrl.trim(),
            name: attachmentName.trim() || undefined,
          };

    const normalized: InternshipTaskDefinition = {
      ...form,
      id: Number(form.id) || nextTaskId(),
      week: Math.max(1, Number(form.week) || 1),
      xpReward: Math.max(0, Number(form.xpReward) || 0),
      ...(attachment ? { attachment } : {}),
    };

    const exists = tasks.some(t => t.id === normalized.id);
    const next = exists
      ? tasks.map(t => (t.id === normalized.id ? normalized : t))
      : [...tasks, normalized];

    persist(next);
    setOpen(false);
    toast.success(exists ? "Task updated" : "Task created");
  };

  const handleDelete = (id: number) => {
    persist(tasks.filter(t => t.id !== id));
  };

  const handleClear = () => {
    persist([]);
  };

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Internship Tasks</h1>
          <p className="text-muted-foreground mt-1">Assign tasks once per internship (shared for all users).</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <select
            value={internshipId}
            onChange={(e) => setInternshipId(parseInt(e.target.value))}
            className="px-3 py-2 rounded-md bg-card/60 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {internships.map((i) => (
              <option key={i.id} value={i.id} className="bg-card">{i.title}</option>
            ))}
          </select>
          <Button variant="outline" onClick={handleClear}>Clear</Button>
          <Button variant="neon" onClick={openCreate}>
            <Plus className="w-4 h-4" />
            Add Task
          </Button>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-border text-xs text-muted-foreground">
          <div className="col-span-4">Title</div>
          <div className="col-span-4">Description</div>
          <div className="col-span-2">Week</div>
          <div className="col-span-1">XP</div>
          <div className="col-span-1 text-right">Action</div>
        </div>
        <div className="divide-y divide-border">
          {tasks.map((t) => (
            <div key={t.id} className="grid grid-cols-12 gap-2 px-4 py-3 items-center">
              <div className="col-span-4 font-medium truncate">{t.title}</div>
              <div className="col-span-4 text-sm text-muted-foreground truncate">{t.description}</div>
              <div className="col-span-2 text-sm text-muted-foreground">Week {t.week}</div>
              <div className="col-span-1 text-sm text-primary font-medium">{t.xpReward}</div>
              <div className="col-span-1 flex justify-end gap-1">
                <Button variant="ghost" size="sm" onClick={() => openEdit(t)}>
                  <Save className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(t.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
          {tasks.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">No tasks assigned for this internship.</div>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Task" : "Add Task"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <div className="text-sm font-medium mb-1">Title</div>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <div className="text-sm font-medium mb-1">Description</div>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full h-24 p-3 rounded-lg bg-muted/20 border border-border focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="text-sm font-medium mb-1">Week</div>
                <Input value={String(form.week)} onChange={(e) => setForm({ ...form, week: parseInt(e.target.value || "1") })} />
              </div>
              <div>
                <div className="text-sm font-medium mb-1">XP Reward</div>
                <Input value={String(form.xpReward)} onChange={(e) => setForm({ ...form, xpReward: parseInt(e.target.value || "0") })} />
              </div>
              <div>
                <div className="text-sm font-medium mb-1">Task ID</div>
                <Input value={String(form.id)} onChange={(e) => setForm({ ...form, id: parseInt(e.target.value || "1") })} />
              </div>
            </div>

            <div className="border border-border rounded-xl p-4 bg-muted/10 space-y-3">
              <div className="text-sm font-medium">Task Attachment (optional)</div>

              <div>
                <div className="text-sm font-medium mb-1">Type</div>
                <select
                  value={attachmentKind}
                  onChange={(e) => setAttachmentKind(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-md bg-card/60 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="none" className="bg-card">none</option>
                  <option value="image" className="bg-card">image</option>
                  <option value="document" className="bg-card">document</option>
                  <option value="link" className="bg-card">link</option>
                </select>
              </div>

              {attachmentKind !== "none" && (
                <>
                  <div>
                    <div className="text-sm font-medium mb-1">Name (optional)</div>
                    <Input value={attachmentName} onChange={(e) => setAttachmentName(e.target.value)} placeholder="e.g. Task Brief.pdf" />
                  </div>

                  <div>
                    <div className="text-sm font-medium mb-1">Attachment URL (or upload file)</div>
                    <Input
                      value={attachmentUrl}
                      onChange={(e) => setAttachmentUrl(e.target.value)}
                      placeholder={attachmentKind === "link" ? "https://..." : "Paste image/doc URL or upload file"}
                    />
                    {(attachmentKind === "image" || attachmentKind === "document") && (
                      <div className="mt-2">
                        <input
                          type="file"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleAttachmentFile(f);
                          }}
                          className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-muted file:text-foreground hover:file:bg-muted/80"
                          accept={attachmentKind === "image" ? "image/*" : ".pdf,.doc,.docx,.ppt,.pptx,.zip"}
                        />
                        <div className="text-xs text-muted-foreground mt-1">
                          Uploaded files are stored as Data URLs in localStorage (demo mode).
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="neon" onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
