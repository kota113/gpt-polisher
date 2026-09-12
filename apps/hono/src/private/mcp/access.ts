export type PrivateIdentity = { email: string; emailVerified: boolean };

export function requestsPrivateMcp(resource: string | string[] | undefined, requestUrl: string): boolean {
  const expected = new URL("/private/mcp", requestUrl).href;
  return (Array.isArray(resource) ? resource : [resource]).some((value) => value === expected);
}

export function isPrivateEmailAllowed(allowedEmails: string | undefined, identity: unknown): identity is PrivateIdentity {
  if (!identity || typeof identity !== "object" || !("email" in identity) ||
      !("emailVerified" in identity) || identity.emailVerified !== true || typeof identity.email !== "string") return false;
  const emails = (allowedEmails ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
  return emails.includes(identity.email.trim().toLowerCase());
}
