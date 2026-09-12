import { isPrivateEmailAllowed } from "./access.ts";

/** OAuthProvider validates the token before this authorization boundary. */
export function createPrivateMcpRoutes(handler: ExportedHandler<Env>): ExportedHandler<Env> & Required<Pick<ExportedHandler<Env>, "fetch">> {
  return {
    async fetch(request, env, ctx) {
      if (!isPrivateEmailAllowed(env.PRIVATE_MCP_ALLOWED_EMAILS, ctx.props)) {
        return new Response("Forbidden", { status: 403 });
      }
      return handler.fetch!(request, env, ctx);
    },
  };
}
