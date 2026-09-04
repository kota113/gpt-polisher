import {handle} from "@astrojs/cloudflare/handler";
import OAuthProvider from "@cloudflare/workers-oauth-provider";
import {GoogleHandler} from "./google-handler";
import {MyMCP} from "./index";

export {MyMCP};

const googleRoutes = new Set(["/authorize", "/callback"]);

const pageHandler: ExportedHandler<Env> = {
  fetch(request, env, ctx) {
    const pathname = new URL(request.url).pathname;
    if (googleRoutes.has(pathname) || pathname.startsWith("/api/setup")) {
      return GoogleHandler.fetch(request, env, ctx);
    }
    return handle(request, env, ctx);
  },
};

export default new OAuthProvider({
  apiHandler: MyMCP.serve("/mcp"),
  apiRoute: "/mcp",
  authorizeEndpoint: "/authorize",
  clientRegistrationEndpoint: "/register",
  defaultHandler: pageHandler,
  tokenEndpoint: "/token",
});