import { useMemo, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";

type VerifyResponse = {
  ok: boolean;
  certificate: {
    id: string;
    code: string;
    status: string;
    issuedAt: string;
    internship: {
      id: number;
      title: string;
      company: string;
      internshipCode: string | null;
    };
    intern: {
      id: string;
      name: string;
    };
    batch: {
      id: number;
      name: string;
      batchCode: string;
      startDate: string;
      endDate: string;
    } | null;
    duration: {
      startDate: string;
      endDate: string;
    };
    pdfUrl?: string;
  };
};

export default function CertificateVerify() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<VerifyResponse | null>(null);

  const defaultApiUrl =
    typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.hostname}:4000`
      : "http://localhost:4000";
  const apiUrl = (import.meta as any).env?.VITE_GROVIX_API_URL || defaultApiUrl;

  const downloadUrl = useMemo(() => {
    const u = data?.certificate?.pdfUrl;
    if (!u) return null;
    return `${apiUrl}${u}`;
  }, [data?.certificate?.pdfUrl, apiUrl]);

  const handleVerify = async () => {
    const q = code.trim();
    if (!q) return;

    setLoading(true);
    setError(null);
    setData(null);

    try {
      const res = await apiFetch<VerifyResponse>(`/certificates/verify?code=${encodeURIComponent(q)}`);
      setData(res);
    } catch (e: any) {
      const status = e?.status;
      if (status === 404) setError("Certificate not found");
      else setError("Failed to verify certificate");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-28 pb-16">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto">
            <div className="glass-card p-6 mb-6">
              <h1 className="text-2xl font-display font-bold">Certificate Verification</h1>
              <p className="text-muted-foreground mt-1">
                Verify a Grovix internship certificate using its certificate code.
              </p>
            </div>

            <div className="glass-card p-6">
              <div className="flex gap-2">
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Enter certificate code (e.g., CERT-2026-ABC123)"
                />
                <Button variant="neon" onClick={() => void handleVerify()} disabled={loading || !code.trim()}>
                  {loading ? "Verifying…" : "Verify"}
                </Button>
              </div>

              {error && <div className="mt-4 text-sm text-destructive">{error}</div>}

              {data?.certificate && (
                <div className="mt-6 rounded-xl border border-border p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm text-muted-foreground">Certificate</div>
                      <div className="font-display font-bold truncate">{data.certificate.code}</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        Status: <span className="text-foreground">{data.certificate.status}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Issued: <span className="text-foreground">{new Date(data.certificate.issuedAt).toLocaleString()}</span>
                      </div>
                    </div>
                    {downloadUrl && (
                      <a href={downloadUrl} target="_blank" rel="noreferrer">
                        <Button variant="outline">Download PDF</Button>
                      </a>
                    )}
                  </div>

                  <div className="mt-4 grid sm:grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg bg-muted/20 p-3">
                      <div className="text-xs text-muted-foreground">Intern</div>
                      <div className="font-medium">{data.certificate.intern.name}</div>
                    </div>
                    <div className="rounded-lg bg-muted/20 p-3">
                      <div className="text-xs text-muted-foreground">Internship</div>
                      <div className="font-medium">{data.certificate.internship.title}</div>
                      <div className="text-xs text-muted-foreground">{data.certificate.internship.company}</div>
                    </div>
                    <div className="rounded-lg bg-muted/20 p-3">
                      <div className="text-xs text-muted-foreground">Batch</div>
                      <div className="font-medium">{data.certificate.batch ? data.certificate.batch.name : "—"}</div>
                      <div className="text-xs text-muted-foreground">{data.certificate.batch ? data.certificate.batch.batchCode : ""}</div>
                    </div>
                    <div className="rounded-lg bg-muted/20 p-3">
                      <div className="text-xs text-muted-foreground">Duration</div>
                      <div className="font-medium">
                        {new Date(data.certificate.duration.startDate).toLocaleDateString()} – {new Date(data.certificate.duration.endDate).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
