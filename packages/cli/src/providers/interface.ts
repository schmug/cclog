export interface CompletionOptions {
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export interface LLMProvider {
  readonly name: string;
  generateEmbedding(text: string): Promise<number[]>;
  generateCompletion(prompt: string, options?: CompletionOptions): Promise<string>;
  isAvailable(): Promise<boolean>;
}
