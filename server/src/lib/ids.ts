import { customAlphabet, nanoid } from "nanoid";

// Invite codes: short, spoken-friendly, no visually ambiguous characters (0/O, 1/I).
const INVITE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const inviteCodeGenerator = customAlphabet(INVITE_ALPHABET, 6);

/** Generate a new id, optionally prefixed (e.g. "usr_xxxxxxxxxxxx"). */
export function newId(prefix?: string): string {
  const id = nanoid(14);
  return prefix ? `${prefix}_${id}` : id;
}

/** Generate a 6-char invite code, e.g. "GROW42". */
export function newInviteCode(): string {
  return inviteCodeGenerator();
}
