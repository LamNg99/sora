type ErrorResponse = {
  json: () => Promise<unknown>;
  status: number;
  statusText: string;
};

export async function getErrorMessage(response: ErrorResponse) {
  try {
    const data = (await response.json()) as { error?: string };
    if (typeof data.error === 'string' && data.error.length > 0) {
      return data.error;
    }
  } catch (e) {
    console.error('Failed to parse error response:', e);
  }
  return response.statusText || `Request failed with status ${response.status}`;
}
