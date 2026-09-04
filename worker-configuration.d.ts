interface Env {
  OAUTH_KV: KVNamespace;
  USER_CREDENTIALS: KVNamespace;
  MCP_OBJECT: DurableObjectNamespace;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  COOKIE_ENCRYPTION_KEY: string;
  CREDENTIAL_ENCRYPTION_KEY: string;
  HOSTED_DOMAIN?: string;
}
