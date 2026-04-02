import { computeCost } from "@cc-timetravel/shared";
import type {
  JournalEntry,
  UserEntry,
  AssistantEntry,
  ContentBlock,
  SessionRow,
  MessageRow,
  ToolUseRow,
} from "@cc-timetravel/shared";

/**
 * Parses a JSONL string into an array of typed JournalEntry objects.
 * Skips empty lines and silently drops malformed (non-JSON) lines.
 */
export function parseSessionJournal(content: string): JournalEntry[] {
  const entries: JournalEntry[] = [];
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      entries.push(JSON.parse(trimmed) as JournalEntry);
    } catch {
      // Skip malformed lines
    }
  }
  return entries;
}

/**
 * Returns plain text extracted from a message content value.
 * If content is a string, returns it as-is.
 * If content is an array of ContentBlocks, joins all "text" blocks with newline.
 */
function extractPlainText(content: string | ContentBlock[]): string {
  if (typeof content === "string") {
    return content;
  }
  return content
    .filter((block): block is Extract<ContentBlock, { type: "text" }> => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

export interface ExtractedSessionData {
  session: SessionRow;
  messages: MessageRow[];
  toolUses: ToolUseRow[];
  searchTexts: { content: string; contentType: string }[];
}

/**
 * Transforms raw JournalEntry[] into structured DB rows for a session.
 */
export function extractSessionData(
  sessionId: string,
  entries: JournalEntry[],
  userId: string,
): ExtractedSessionData {
  // -----------------------------------------------------------------------
  // Pass 1: collect tool_result content from user messages so we can link
  // them to tool_use blocks found in assistant messages.
  // -----------------------------------------------------------------------
  const toolResults = new Map<string, { content: string; isError: boolean }>();

  for (const entry of entries) {
    if (entry.type !== "user") continue;
    const userEntry = entry as UserEntry;
    const msgContent = userEntry.message.content;
    if (Array.isArray(msgContent)) {
      for (const block of msgContent) {
        if (block.type === "tool_result") {
          const resultContent =
            typeof block.content === "string"
              ? block.content
              : extractPlainText(block.content as ContentBlock[]);
          toolResults.set(block.tool_use_id, {
            content: resultContent,
            isError: block.is_error ?? false,
          });
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // Pass 2: walk entries, extract metadata + build rows.
  // -----------------------------------------------------------------------
  let projectPath = "";
  let slug = "";
  let gitBranch = "";
  let ccVersion = "";
  let firstPrompt = "";
  let minTimestamp = "";
  let maxTimestamp = "";

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCacheReadTokens = 0;
  let totalCacheCreationTokens = 0;

  const modelCounts = new Map<string, number>();
  const messages: MessageRow[] = [];
  const toolUses: ToolUseRow[] = [];
  const searchTexts: { content: string; contentType: string }[] = [];

  const updateTimestamp = (ts: string | undefined) => {
    if (!ts) return;
    if (!minTimestamp || ts < minTimestamp) minTimestamp = ts;
    if (!maxTimestamp || ts > maxTimestamp) maxTimestamp = ts;
  };

  const captureMetadata = (entry: JournalEntry) => {
    if (!projectPath && entry.cwd) projectPath = entry.cwd;
    if (!slug && entry.slug) slug = entry.slug;
    if (!gitBranch && entry.gitBranch) gitBranch = entry.gitBranch;
    if (!ccVersion && entry.version) ccVersion = String(entry.version);
  };

  for (const entry of entries) {
    captureMetadata(entry);
    updateTimestamp(entry.timestamp);

    if (entry.type === "user") {
      const userEntry = entry as UserEntry;
      const msgContent = userEntry.message.content;

      // Skip tool-result-only messages from the messages[] array? No — the
      // task says "2 user + 2 assistant = 4 messages", so both user entries
      // must be included. However the tool_result user message won't have
      // plain-text content so content_text will be empty.
      const plainText = extractPlainText(msgContent);

      if (!firstPrompt && plainText) firstPrompt = plainText;

      const messageRow: MessageRow = {
        id: userEntry.uuid ?? "",
        session_id: sessionId,
        parent_uuid: userEntry.parentUuid ?? "",
        role: "user",
        content_text: plainText,
        has_thinking: 0,
        input_tokens: 0,
        output_tokens: 0,
        cache_read_tokens: 0,
        cache_creation_tokens: 0,
        model: "",
        timestamp: userEntry.timestamp ?? "",
      };

      messages.push(messageRow);

      if (plainText) {
        searchTexts.push({ content: plainText, contentType: "user_message" });
      }
    } else if (entry.type === "assistant") {
      const assistantEntry = entry as AssistantEntry;
      const msg = assistantEntry.message;
      const usage = msg.usage;

      const inputTokens = usage.input_tokens ?? 0;
      const outputTokens = usage.output_tokens ?? 0;
      const cacheReadTokens = usage.cache_read_input_tokens ?? usage.cache_creation ?? 0;
      const cacheCreationTokens = usage.cache_creation_input_tokens ?? 0;

      totalInputTokens += inputTokens;
      totalOutputTokens += outputTokens;
      totalCacheReadTokens += cacheReadTokens;
      totalCacheCreationTokens += cacheCreationTokens;

      const model = msg.model ?? "";
      if (model) {
        modelCounts.set(model, (modelCounts.get(model) ?? 0) + 1);
      }

      const hasThinking = msg.content.some((b) => b.type === "thinking") ? 1 : 0;
      const plainText = extractPlainText(msg.content);

      const messageRow: MessageRow = {
        id: assistantEntry.uuid ?? "",
        session_id: sessionId,
        parent_uuid: assistantEntry.parentUuid ?? "",
        role: "assistant",
        content_text: plainText,
        has_thinking: hasThinking,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cache_read_tokens: cacheReadTokens,
        cache_creation_tokens: cacheCreationTokens,
        model,
        timestamp: assistantEntry.timestamp ?? "",
      };

      messages.push(messageRow);

      if (plainText) {
        searchTexts.push({ content: plainText, contentType: "assistant_message" });
      }

      // Extract tool_use blocks
      for (const block of msg.content) {
        if (block.type === "tool_use") {
          const result = toolResults.get(block.id);
          const toolUseRow: ToolUseRow = {
            id: block.id,
            message_id: assistantEntry.uuid ?? "",
            session_id: sessionId,
            tool_name: block.name,
            input_json: JSON.stringify(block.input),
            output_text: result?.content ?? "",
            is_error: result?.isError ? 1 : 0,
            timestamp: assistantEntry.timestamp ?? "",
          };
          toolUses.push(toolUseRow);
        }
      }
    }
  }

  // Determine primary model by frequency
  let primaryModel = "";
  let maxCount = 0;
  for (const [model, count] of modelCounts.entries()) {
    if (count > maxCount) {
      maxCount = count;
      primaryModel = model;
    }
  }

  // Compute cost
  const totalCost = computeCost(
    primaryModel,
    totalInputTokens,
    totalOutputTokens,
    totalCacheReadTokens,
    totalCacheCreationTokens,
  );

  // Compute duration
  const durationSeconds =
    minTimestamp && maxTimestamp
      ? Math.round((new Date(maxTimestamp).getTime() - new Date(minTimestamp).getTime()) / 1000)
      : 0;

  // Derive project_name from last path segment
  const projectName = projectPath ? projectPath.split("/").filter(Boolean).at(-1) ?? "" : "";

  const session: SessionRow = {
    id: sessionId,
    project_path: projectPath,
    project_name: projectName,
    slug,
    git_branch: gitBranch,
    first_prompt: firstPrompt,
    summary: "",
    message_count: messages.length,
    total_input_tokens: totalInputTokens,
    total_output_tokens: totalOutputTokens,
    total_cache_read_tokens: totalCacheReadTokens,
    total_cache_creation_tokens: totalCacheCreationTokens,
    total_cost: totalCost,
    model: primaryModel,
    cc_version: ccVersion,
    user_id: userId,
    created_at: minTimestamp,
    modified_at: maxTimestamp,
    duration_seconds: durationSeconds,
  };

  return { session, messages, toolUses, searchTexts };
}
