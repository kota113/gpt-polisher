import {handle} from "@astrojs/cloudflare/handler";
import OAuthProvider from "@cloudflare/workers-oauth-provider";
import {GoogleHandler} from "./google-handler";
import {MyMCP} from "./index";
import {Hono} from "hono";
import type {OAuthHelpers} from "@cloudflare/workers-oauth-provider";
import {PrivateMCP} from "./private/mcp/agent";
import {createPrivateMcpRoutes} from "./private/mcp/routes";

export {MyMCP, PrivateMCP};

const pageHandler = new Hono<{ Bindings: Env & { OAUTH_PROVIDER: OAuthHelpers } }>();
pageHandler.route("/", GoogleHandler);
pageHandler.all("*", (c) => handle(c.req.raw, c.env, c.executionCtx as ExecutionContext));

export default new OAuthProvider({
  apiHandlers: {
    "/mcp": MyMCP.serve("/mcp"),
    "/private/mcp": createPrivateMcpRoutes(PrivateMCP.serve("/private/mcp", { binding: "PRIVATE_MCP_OBJECT" })),
  },
  authorizeEndpoint: "/authorize",
  clientRegistrationEndpoint: "/register",
  defaultHandler: pageHandler,
  tokenEndpoint: "/token",
});
