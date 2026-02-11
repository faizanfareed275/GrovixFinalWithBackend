import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

interface Internship {
  id: number;
  title: string;
  company: string;
  type: string;
  createdAt?: string;
  description: string;
  internshipCode?: string;
  imageUrl?: string | null;
  imageFileId?: string | null;
}

interface Batch {
  id: number;
  name: string;
  batchCode: string;
  startDate: string;
  endDate: string;
  status: string;
  applicants: number;
  interns: number;
}

export default function AdminInternships() {
  const [internships, setInternships] = useState<Internship[]>([]);
  const [batchesByInternship, setBatchesByInternship] = useState<Record<number, Batch[]>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [addBatchOpen, setAddBatchOpen] = useState(false);
  const [selectedInternshipId, setSelectedInternshipId] = useState<number | null>(null);
  const [addForm, setAddForm] = useState({ title: "", company: "", type: "free", description: "", imageUrl: "", imageFileId: "" });
  const [addBatchForm, setAddBatchForm] = useState({ name: "", startDate: "", endDate: "", capacity: "" });
  const [imageUploading, setImageUploading] = useState(false);

  const fetchBatches = async (internshipId: number) => {
    const d = await apiFetch<{ batches: Batch[] }>(`/internships/${internshipId}/admin/batches`);
    if (d?.batches) setBatchesByInternship(prev => ({ ...prev, [internshipId]: d.batches }));
  };

  useEffect(() => {
    apiFetch<{ internships: Internship[] }>('/internships')
      .then(d => {
        if (Array.isArray(d?.internships)) setInternships(d.internships);
      })
      .catch(() => {});
  }, []);

  const handleAddInternship = async () => {
    if (!addForm.title.trim() || !addForm.company.trim() || !addForm.description.trim()) {
      toast.error('Title, company, and description are required');
      return;
    }
    try {
      const payload = {
        title: addForm.title,
        company: addForm.company,
        type: addForm.type,
        description: addForm.description,
        imageUrl: addForm.imageUrl.trim() ? addForm.imageUrl.trim() : null,
        imageFileId: addForm.imageFileId.trim() ? addForm.imageFileId.trim() : null,
      };
      const result = await apiFetch<{ internship: Internship }>('/internships', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (result?.internship) {
        setInternships([result.internship, ...internships]);
        setAddForm({ title: '', company: '', type: 'free', description: '', imageUrl: '', imageFileId: '' });
        setAddOpen(false);
        toast.success('Internship added');
      }
    } catch {
      toast.error('Failed to add internship');
    }
  };

  const uploadImage = async (file: File) => {
    setImageUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("read_failed"));
        reader.readAsDataURL(file);
      });
      const res = await apiFetch<{ file: { id: string } }>("/files/admin/upload", {
        method: "POST",
        body: JSON.stringify({
          purpose: "INTERNSHIP_IMAGE",
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          base64,
        }),
      });
      if (res?.file?.id) {
        setAddForm((p) => ({ ...p, imageFileId: String(res.file.id) }));
        toast.success("Image uploaded");
      }
    } catch {
      toast.error("Image upload failed");
    } finally {
      setImageUploading(false);
    }
  };

  const handleAddBatch = async () => {
    if (!selectedInternshipId || !addBatchForm.name.trim() || !addBatchForm.startDate || !addBatchForm.endDate) {
      toast.error('Batch name, start date, and end date are required');
      return;
    }
    try {
      const payload = {
        name: addBatchForm.name,
        startDate: addBatchForm.startDate,
        endDate: addBatchForm.endDate,
        capacity: addBatchForm.capacity ? Number(addBatchForm.capacity) : null,
      };
      const result = await apiFetch<{ batch: Batch }>(`/internships/${selectedInternshipId}/admin/batches`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (result?.batch) {
        setBatchesByInternship(prev => ({
          ...prev,
          [selectedInternshipId]: [result.batch, ...(prev[selectedInternshipId] || [])],
        }));
        setAddBatchForm({ name: '', startDate: '', endDate: '', capacity: '' });
        setAddBatchOpen(false);
        toast.success('Batch added');
      }
    } catch {
      toast.error('Failed to add batch');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiFetch(`/internships/${id}`, { method: 'DELETE' });
      setInternships(internships.filter(i => i.id !== id));
      toast.success('Internship deleted');
    } catch {
      toast.error('Failed to delete internship');
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">Internships</h1>
            <p className="text-muted-foreground mt-1">Manage internship listings.</p>
          </div>
          <Button onClick={() => setAddOpen(true)}><Plus className="w-4 h-4 mr-2" />Add Internship</Button>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <div className="font-display font-bold">Internship Listings</div>
        </div>
        <div className="divide-y divide-border">
          {internships.map(i => (
            <div key={i.id} className="px-4 py-3 space-y-2">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-medium truncate">{i.title}</div>
                  <div className="text-xs text-muted-foreground">{i.company} · {i.type}</div>
                  <div className="text-xs text-muted-foreground">ID: {i.internshipCode || `#${i.id}`}</div>
                  {i.description && <div className="text-xs text-muted-foreground mt-1">{i.description}</div>}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => {
                    setSelectedInternshipId(i.id);
                    setAddBatchOpen(true);
                    if (!batchesByInternship[i.id]) fetchBatches(i.id);
                  }}>Add Batch</Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(i.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              {batchesByInternship[i.id] && (
                <div className="ml-4 space-y-1">
                  <div className="text-xs font-semibold text-muted-foreground">Batches</div>
                  {batchesByInternship[i.id].map(b => (
                    <div key={b.id} className="text-xs text-muted-foreground border-l-2 pl-2">
                      {b.name} ({b.batchCode}) · {b.applicants} applicants · {b.interns} interns · {b.status}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {internships.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">No internships found.</div>
          )}
        </div>
      </div>

      <Dialog open={addBatchOpen} onOpenChange={setAddBatchOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Batch</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="batchName">Batch Name</Label>
              <Input id="batchName" value={addBatchForm.name} onChange={e => setAddBatchForm(f => ({ ...f, name: e.target.value }))} placeholder="Batch name" />
            </div>
            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <Input id="startDate" type="date" value={addBatchForm.startDate} onChange={e => setAddBatchForm(f => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="endDate">End Date</Label>
              <Input id="endDate" type="date" value={addBatchForm.endDate} onChange={e => setAddBatchForm(f => ({ ...f, endDate: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="capacity">Capacity (optional)</Label>
              <Input id="capacity" value={addBatchForm.capacity} onChange={e => setAddBatchForm(f => ({ ...f, capacity: e.target.value }))} placeholder="Max interns" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddBatchOpen(false)}>Cancel</Button>
            <Button onClick={handleAddBatch}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Internship</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={addForm.title} onChange={e => setAddForm(f => ({ ...f, title: e.target.value }))} placeholder="Internship title" />
            </div>
            <div>
              <Label htmlFor="company">Company</Label>
              <Input id="company" value={addForm.company} onChange={e => setAddForm(f => ({ ...f, company: e.target.value }))} placeholder="Company name" />
            </div>
            <div>
              <Label htmlFor="type">Type</Label>
              <Select value={addForm.type} onValueChange={(v) => setAddForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" value={addForm.description} onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))} placeholder="Internship description" rows={3} />
            </div>

            <div>
              <Label htmlFor="imageUrl">Image URL (optional)</Label>
              <Input id="imageUrl" value={addForm.imageUrl} onChange={e => setAddForm(f => ({ ...f, imageUrl: e.target.value }))} placeholder="https://..." />
            </div>

            <div>
              <Label htmlFor="imageUpload">Upload Image (optional)</Label>
              <Input
                id="imageUpload"
                type="file"
                accept="image/*"
                disabled={imageUploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadImage(file);
                }}
              />
              <div className="text-xs text-muted-foreground mt-1">
                {addForm.imageFileId ? `Uploaded fileId: ${addForm.imageFileId}` : "No upload"}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAddInternship} disabled={imageUploading}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
