import { createHash } from "crypto";

export const CHAT_RETENTION_HOURS = 24;
export const CHAT_MAX_MESSAGE_LENGTH = 1000;
export const CHAT_POLL_MS = 8000;

export function hashGuestToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function guestLabelFromHash(hash: string) {
  return `Guest ${hash.slice(0, 6).toUpperCase()}`;
}

export function cleanChatMessage(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, CHAT_MAX_MESSAGE_LENGTH);
}
