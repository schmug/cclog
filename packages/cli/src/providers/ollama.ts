import type { LLMProvider, CompletionOptions } from "./interface.js";

export class OllamaProvider implements LLMProvider {
  readonly name = "ollama";

  constructor(
    private readonly baseUrl: string,
    private readonly embeddingModel: string,
    private readonly completionModel: string
  ) {}

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`);
      return res.ok;
    } catch {
      return false;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const res = await fetch(`${this.baseUrl}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.embeddingModel, input: text }),
    });
    if (!res.ok) {
      throw new Error(`Ollama embed error: ${res.status} ${res.statusText}`);
    }
    const data = await res.json() as { embeddings: number[][] };
    return data.embeddings[0];
  }

  async generateCompletion(prompt: string, options?: CompletionOptions): Promise<string> {
    const body: Record<string, unknown> = {
      model: this.completionModel,
      prompt,
      stream: false,
      options: {
        num_predict: options?.maxTokens,
        temperature: options?.temperature,
      },
    };
    if (options?.systemPrompt) {
      body.system = options.systemPrompt;
    }
    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`Ollama generate error: ${res.status} ${res.statusText}`);
    }
    const data = await res.json() as { response: string };
    return data.response;
  }
}
