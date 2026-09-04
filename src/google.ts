import { decryptString, encryptString, type EncryptedValue } from "./crypto";

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/cloud-platform",
  "https://www.googleapis.com/auth/generative-language.retriever",
].join(" ");

export type StoredGoogleCredential = {
  refreshToken: EncryptedValue;
  email: string;
  name: string;
  selectedProjectId?: string;
  updatedAt: string;
};

export type GoogleTokenResponse = {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  id_token?: string;
};

export async function exchangeCode(env: Env, code: string, redirectUri: string): Promise<GoogleTokenResponse> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });
  if (!response.ok) throw new Error(`Google token exchange failed: ${response.status} ${await response.text()}`);
  return (await response.json()) as GoogleTokenResponse;
}

export async function refreshAccessToken(env: Env, userId: string): Promise<string> {
  const stored = await env.USER_CREDENTIALS.get<StoredGoogleCredential>(`google:${userId}`, "json");
  if (!stored) throw new Error("Google credential not found. Reconnect the MCP app.");
  const refreshToken = await decryptString(stored.refreshToken, env.CREDENTIAL_ENCRYPTION_KEY);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) throw new Error(`Google token refresh failed: ${response.status} ${await response.text()}`);
  const body = (await response.json()) as GoogleTokenResponse;
  return body.access_token;
}

export async function saveRefreshToken(
  env: Env,
  userId: string,
  refreshToken: string,
  profile: { email: string; name: string },
): Promise<void> {
  const existing = await env.USER_CREDENTIALS.get<StoredGoogleCredential>(`google:${userId}`, "json");
  const encrypted = await encryptString(refreshToken, env.CREDENTIAL_ENCRYPTION_KEY);
  const value: StoredGoogleCredential = {
    refreshToken: encrypted,
    email: profile.email,
    name: profile.name,
    selectedProjectId: existing?.selectedProjectId,
    updatedAt: new Date().toISOString(),
  };
  await env.USER_CREDENTIALS.put(`google:${userId}`, JSON.stringify(value));
}

export async function setSelectedProject(env: Env, userId: string, projectId: string): Promise<void> {
  const key = `google:${userId}`;
  const stored = await env.USER_CREDENTIALS.get<StoredGoogleCredential>(key, "json");
  if (!stored) throw new Error("Google credential not found");
  stored.selectedProjectId = projectId;
  stored.updatedAt = new Date().toISOString();
  await env.USER_CREDENTIALS.put(key, JSON.stringify(stored));
}

export async function getSelectedProject(env: Env, userId: string): Promise<string> {
  const stored = await env.USER_CREDENTIALS.get<StoredGoogleCredential>(`google:${userId}`, "json");
  if (!stored?.selectedProjectId) throw new Error("No Google Cloud project selected. Reconnect the MCP app.");
  return stored.selectedProjectId;
}

export async function getUserInfo(accessToken: string): Promise<{ id: string; email: string; name: string }> {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`Failed to fetch Google profile: ${response.status}`);
  const body = (await response.json()) as { sub: string; email: string; name?: string };
  return { id: body.sub, email: body.email, name: body.name ?? body.email };
}

export type CloudProject = {
  name: string;
  projectId: string;
  displayName?: string;
  state?: string;
};

export async function listProjects(accessToken: string): Promise<CloudProject[]> {
  const projects: CloudProject[] = [];
  let pageToken = "";
  do {
    const url = new URL("https://cloudresourcemanager.googleapis.com/v3/projects:search");
    url.searchParams.set("pageSize", "200");
    url.searchParams.set("query", "state:ACTIVE");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) throw new Error(`Failed to list projects: ${response.status} ${await response.text()}`);
    const body = (await response.json()) as { projects?: CloudProject[]; nextPageToken?: string };
    projects.push(...(body.projects ?? []));
    pageToken = body.nextPageToken ?? "";
  } while (pageToken && projects.length < 1000);
  return projects;
}

export async function enableGeminiApi(accessToken: string, projectId: string): Promise<void> {
  const service = "generativelanguage.googleapis.com";
  const response = await fetch(
    `https://serviceusage.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/services/${service}:enable`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: "{}",
    },
  );
  if (!response.ok) throw new Error(`Failed to enable Gemini API for ${projectId}: ${response.status} ${await response.text()}`);
}

export async function createProject(accessToken: string, projectId: string, displayName: string): Promise<void> {
  const response = await fetch("https://cloudresourcemanager.googleapis.com/v3/projects", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ projectId, displayName }),
  });
  if (!response.ok) throw new Error(`Failed to create project: ${response.status} ${await response.text()}`);
  const operation = (await response.json()) as { name?: string; done?: boolean; error?: unknown };
  if (!operation.name) return;

  for (let i = 0; i < 20; i++) {
    const op = await fetch(`https://cloudresourcemanager.googleapis.com/v3/${operation.name}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!op.ok) throw new Error(`Failed to check project creation: ${op.status} ${await op.text()}`);
    const body = (await op.json()) as { done?: boolean; error?: { message?: string } };
    if (body.error) throw new Error(body.error.message ?? "Project creation failed");
    if (body.done) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Project creation is still in progress. Retry project selection shortly.");
}

export async function rewriteWithGemini(
  accessToken: string,
  projectId: string,
  userQuestion: string,
  originalAnswer: string,
): Promise<string> {
  const prompt = `You are a response editor.\n\nYour task is to rewrite the original answer to be easier to read.\n\nRules:\n1. Use only the information contained in the original answer. Do not add new facts, knowledge, reasoning, or fill in anything missing. The user question is provided only to help judge which parts are most relevant — do not use it as a source of information.\n2. Rewrite the answer to be clear and concise. If the original answer is already concise, make only minimal changes.\n3. Return ONLY the rewritten answer.\n4. Rewrite in the same language as the original answer.\n\n<user_question>\n${userQuestion}\n</user_question>\n\n<original_answer>\n${originalAnswer}\n</original_answer>`;

  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "x-goog-user-project": projectId,
        "x-goog-api-client": "gpt-polisher/0.1.0",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }),
    },
  );
  if (!response.ok) throw new Error(`Gemini API failed: ${response.status} ${await response.text()}`);
  const body = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  if (!text) throw new Error("Gemini returned no text");
  return text;
}
