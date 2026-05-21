import { generateText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import {
  SRS_REVIEW_PROMPT,
  OPPM_REVIEW_PROMPT,
  FEEDBACK_GENERATION_PROMPT,
} from "@/lib/prompts";
import type { AIReport } from "@/types";

export class ReviewProviderUnavailableError extends Error {
  constructor() {
    super(
      "No LLM review provider is configured. Set LLM_PROVIDER=deepseek, DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, and AI_MODEL to enable AI reviews.",
    );
    this.name = "ReviewProviderUnavailableError";
  }
}

export function isReviewProviderConfigured(): boolean {
  const provider = process.env.LLM_PROVIDER?.toLowerCase();
  if (provider === "deepseek") {
    return Boolean(process.env.DEEPSEEK_API_KEY && process.env.AI_MODEL);
  }
  if (provider === "openrouter") {
    return Boolean(process.env.OPENROUTER_API_KEY && process.env.AI_MODEL);
  }
  return false;
}

// ─────────────────────────────────────────────
// Model Configuration
// Swap the provider/model here when you decide on a specific one.
// Examples:
//   openai("gpt-4o")
//   openai("gpt-4-turbo")
//   anthropic("claude-3-5-sonnet-20241022")  → npm install @ai-sdk/anthropic
//   google("gemini-1.5-pro")                 → npm install @ai-sdk/google
// ─────────────────────────────────────────────
function getModel() {
  const providerName = process.env.LLM_PROVIDER?.toLowerCase();
  const modelName = process.env.AI_MODEL;

  if (!modelName) {
    throw new ReviewProviderUnavailableError();
  }

  if (providerName === "deepseek") {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new ReviewProviderUnavailableError();

    const provider = createOpenAI({
      apiKey,
      baseURL: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
    });

    return provider(modelName);
  }

  if (providerName === "openrouter") {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new ReviewProviderUnavailableError();

    const provider = createOpenAI({
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
    });

    return provider(modelName);
  }

  throw new ReviewProviderUnavailableError();
}

async function generateDeepSeekText({
  messages,
  temperature,
  maxOutputTokens,
}: {
  messages: Array<{ role: "system" | "user"; content: string }>;
  temperature: number;
  maxOutputTokens: number;
}): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const modelName = process.env.AI_MODEL;

  if (!apiKey || !modelName) {
    throw new ReviewProviderUnavailableError();
  }

  const baseURL = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
  const response = await fetch(`${baseURL.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: modelName,
      messages,
      temperature,
      max_tokens: maxOutputTokens,
    }),
  });

  const body = (await response.json().catch(() => null)) as
    | {
        choices?: Array<{ message?: { content?: string } }>;
        error?: { message?: string };
      }
    | null;

  if (!response.ok) {
    throw new Error(
      body?.error?.message ??
        `DeepSeek request failed with HTTP ${response.status}.`,
    );
  }

  return body?.choices?.[0]?.message?.content?.trim() ?? "";
}

async function generateConfiguredText({
  messages,
  temperature,
  maxOutputTokens,
}: {
  messages: Array<{ role: "system" | "user"; content: string }>;
  temperature: number;
  maxOutputTokens: number;
}): Promise<string> {
  if (process.env.LLM_PROVIDER?.toLowerCase() === "deepseek") {
    return generateDeepSeekText({ messages, temperature, maxOutputTokens });
  }

  const { text } = await generateText({
    model: getModel(),
    messages,
    temperature,
    maxOutputTokens,
  });

  return text;
}

export async function ocrImageWithDeepSeek(
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  if (!isReviewProviderConfigured()) {
    throw new ReviewProviderUnavailableError();
  }

  const providerName = process.env.LLM_PROVIDER?.toLowerCase();
  if (providerName !== "deepseek") {
    throw new ReviewProviderUnavailableError();
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  const modelName = process.env.AI_MODEL;

  if (!apiKey || !modelName) {
    throw new ReviewProviderUnavailableError();
  }

  const baseURL = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
  const response = await fetch(`${baseURL.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: modelName,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Extract all readable text from this document image. Return only the extracted text, preserving headings, labels, table rows, and list items as plain text.",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${buffer.toString("base64")}`,
              },
            },
          ],
        },
      ],
      temperature: 0,
    }),
  });

  const body = (await response.json().catch(() => null)) as
    | { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new Error(
      body?.error?.message ?? `DeepSeek OCR request failed with HTTP ${response.status}.`,
    );
  }

  return body?.choices?.[0]?.message?.content?.trim() ?? "";
}

// ─────────────────────────────────────────────
// Review a document (SRS or OPPM)
// Returns a parsed AIReport object
// ─────────────────────────────────────────────
export async function reviewDocument(
  content: string,
  type: "SRS" | "OPPM",
): Promise<AIReport> {
  const systemPrompt = type === "SRS" ? SRS_REVIEW_PROMPT : OPPM_REVIEW_PROMPT;

  // Truncate content if too large (model context limit safety)
  const maxChars = 60_000;
  const truncated =
    content.length > maxChars
      ? content.slice(0, maxChars) +
        "\n\n[Document truncated due to length. Please review the visible portion.]"
      : content;

  const text = await generateConfiguredText({
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: `Please review the following ${type} document and return your analysis as a JSON object.\n\n---\n\n${truncated}`,
      },
    ],
    temperature: 0.2, // Low temperature for consistent, structured output
    maxOutputTokens: 4096,
  });

  // Strip markdown code fences if the model wraps the JSON anyway
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let report: AIReport;
  try {
    report = JSON.parse(cleaned) as AIReport;
  } catch (err) {
    throw new Error(
      `AI returned non-JSON response. Raw output:\n${text.slice(0, 500)}\n\nParse error: ${String(err)}`,
    );
  }

  report.generatedAt = new Date().toISOString();

  return report;
}

// ─────────────────────────────────────────────
// Generate written feedback from an existing AIReport
// Called when advisor clicks "Generate AI Feedback"
// ─────────────────────────────────────────────
export async function generateFeedbackFromReport(
  report: AIReport,
  documentName: string,
  projectName: string,
): Promise<string> {
  const text = await generateConfiguredText({
    messages: [
      {
        role: "system",
        content: FEEDBACK_GENERATION_PROMPT,
      },
      {
        role: "user",
        content: `
Document Name: ${documentName}
Project Name: ${projectName}
Document Type: ${report.documentType}

AI Review Report (JSON):
${JSON.stringify(report, null, 2)}

Please write the advisor feedback message now.
        `.trim(),
      },
    ],
    temperature: 0.6, // Slightly higher for more natural prose
    maxOutputTokens: 1024,
  });

  return text.trim();
}
