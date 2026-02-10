/**
 * Ollama API client for local LLM inference.
 * Used by the planning engine to generate daily plans.
 */

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:70b';

export interface OllamaGenerateOptions {
  model?: string;
  prompt: string;
  stream?: boolean;
  options?: {
    temperature?: number;
    top_p?: number;
    num_predict?: number;
  };
}

export interface OllamaGenerateResponse {
  model: string;
  response: string;
  done: boolean;
  done_reason?: string;
}

export async function generate(options: OllamaGenerateOptions): Promise<string> {
  const url = `${OLLAMA_BASE}/api/generate`;
  const body = {
    model: options.model || DEFAULT_MODEL,
    prompt: options.prompt,
    stream: options.stream ?? false,
    options: options.options ?? { temperature: 0.7, num_predict: 4096 },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama API error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as OllamaGenerateResponse;
  return data.response || '';
}

export async function listModels(): Promise<{ name: string }[]> {
  const res = await fetch(`${OLLAMA_BASE}/api/tags`);
  if (!res.ok) throw new Error(`Ollama API error ${res.status}`);
  const data = (await res.json()) as { models: { name: string }[] };
  return data.models || [];
}

export async function isAvailable(): Promise<boolean> {
  try {
    await fetch(`${OLLAMA_BASE}/api/tags`);
    return true;
  } catch {
    return false;
  }
}
