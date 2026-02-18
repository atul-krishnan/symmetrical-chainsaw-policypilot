import mammoth from "mammoth";
import pdfParse from "pdf-parse";

import type { PolicyObligation, RoleTrack } from "@/lib/types";

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 24);
}

function inferRoleTrack(sentence: string): RoleTrack {
  const lowered = sentence.toLowerCase();
  if (lowered.includes("board") || lowered.includes("executive") || lowered.includes("leadership")) {
    return "exec";
  }
  if (lowered.includes("engineer") || lowered.includes("developer") || lowered.includes("model") || lowered.includes("prompt")) {
    return "builder";
  }
  return "general";
}

function inferSeverity(sentence: string): "low" | "medium" | "high" {
  const lowered = sentence.toLowerCase();
  if (
    lowered.includes("must") ||
    lowered.includes("required") ||
    lowered.includes("prohibited") ||
    lowered.includes("never")
  ) {
    return "high";
  }

  if (lowered.includes("should") || lowered.includes("recommended")) {
    return "medium";
  }

  return "low";
}

export async function extractTextFromFile(file: File): Promise<string> {
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  if (file.type === "text/plain") {
    return fileBuffer.toString("utf8");
  }

  if (
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    return result.value;
  }

  if (file.type === "application/pdf") {
    const result = await pdfParse(fileBuffer);
    return result.text;
  }

  throw new Error("Unsupported file type");
}

export function extractObligations(
  text: string,
  orgId: string,
  policyId: string,
): Omit<PolicyObligation, "id" | "createdAt">[] {
  const candidates = splitSentences(text).filter((sentence) =>
    /(must|should|required|prohibited|never|only|approval)/i.test(sentence),
  );

  return candidates.slice(0, 18).map((sentence, index) => ({
    orgId,
    policyId,
    title: `Obligation ${index + 1}`,
    detail: sentence,
    severity: inferSeverity(sentence),
    roleTrack: inferRoleTrack(sentence),
  }));
}
