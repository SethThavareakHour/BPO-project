import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import {
  SRS_REVIEW_PROMPT,
  OPPM_REVIEW_PROMPT,
  FEEDBACK_GENERATION_PROMPT,
} from "@/lib/prompts";
import type { AIReport } from "@/types";

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
  const modelName = process.env.AI_MODEL ?? "gpt-4o";
  return openai(modelName);
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

  const { text } = await generateText({
    model: getModel(),
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

  // Stamp generatedAt if the model forgot it
  if (!report.generatedAt) {
    report.generatedAt = new Date().toISOString();
  }

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
  const { text } = await generateText({
    model: getModel(),
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
