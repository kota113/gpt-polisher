# GPT Polisher

URL: https://gpt-polisher.kota113.com  


GPT Polisher is a hosted remote MCP server that rewrites ChatGPT's responses with Gemini to make them clearer and more concise without modifying information.

## How it works

1. ChatGPT connects to `/mcp` and starts MCP OAuth.
2. The Worker redirects the user to Google OAuth.
3. The user selects an existing Google Cloud project or creates one in the setup UI.
4. GPT Polisher uses the selected project's Gemini quota to rewrite responses.

Google credentials are encrypted before storage and are never stored in plaintext.

## Connect to ChatGPT

1. Open the hosted GPT Polisher website and copy its MCP endpoint.
2. In ChatGPT, create a custom MCP app or connector using that endpoint.
3. Select OAuth authentication and follow the Google sign-in and project setup flow.

## Tools

- `rewrite_response` — rewrites an AI response for clarity and concision while preserving its facts and language.
- `connection_info` — shows the connected Google account and selected quota project.

## Google Cloud requirements

The selected project must be allowed to use the Gemini API. GPT Polisher attempts to enable it during setup. Creating a project requires the appropriate Google Cloud permission and does not automatically attach a billing account.
