type ApiError = {
  status: number;
  body?: any;
};

const defaultApiUrl =
  typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:4000`
    : "http://localhost:4000";

const apiUrl = (import.meta as any).env?.VITE_GROVIX_API_URL || defaultApiUrl;

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  const text = await res.text();
  const json = text ? safeJsonParse(text) : undefined;

  if (!res.ok) {
    const err: ApiError = { status: res.status, body: json };
    throw err;
  }

  return (json as T) ?? (undefined as T);
}

function safeJsonParse(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
