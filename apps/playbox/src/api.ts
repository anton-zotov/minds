export async function api<T>(path: string, input?: unknown): Promise<T> {
  const response = await fetch(`/api/${path}`, input === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'Request failed.');
  return data as T;
}
