import {useState} from "react";
import {marked} from "marked";
import {examples} from "../examples";
import {Brand} from "./Brand";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

const instruction = "After drafting a response, always call the GPT Polisher rewrite_response tool and provide it with the original response and the user's question. Use only the rewritten text returned by the tool as your final answer.";

const prompts: Record<string, string> = {
  "rag-en": "Explain the cases where RAG should be used and where it should not.",
  "rag-ja": "RAGを使うべきケースと、使わない方がよいケースを比較して",
  "tesla-ja": "Teslaは人間に比べFSDの事故率が低いと公称しているが、比較対象は適切？保険会社や警察のデータから、Tesla自体の事故率が高くないか調べて",
  "workers-en": "Explain the difference between Cloudflare Workers and a typical serverless environment",
  "workers-ja": "Cloudflare Workersと一般的なサーバーレス環境の違いを説明して",
};

const markdownClassName = "text-[13px] leading-[1.65] text-neutral-800 [&_a]:text-indigo-700 [&_a]:underline [&_a]:underline-offset-2 [&_blockquote]:my-[1em] [&_blockquote]:border-l-3 [&_blockquote]:border-neutral-300 [&_blockquote]:pl-3 [&_blockquote]:text-neutral-600 [&_h1]:mt-[1.5em] [&_h1]:mb-[0.6em] [&_h1]:text-xl [&_h1]:leading-tight [&_h1]:font-semibold [&_h2]:mt-[1.5em] [&_h2]:mb-[0.6em] [&_h2]:text-lg [&_h2]:leading-tight [&_h2]:font-semibold [&_h3]:mt-[1.4em] [&_h3]:mb-[0.55em] [&_h3]:text-base [&_h3]:leading-snug [&_h3]:font-semibold [&_h4]:mt-[1.3em] [&_h4]:mb-[0.5em] [&_h4]:text-sm [&_h4]:leading-snug [&_h4]:font-semibold [&_hr]:my-5 [&_hr]:border-0 [&_hr]:border-t [&_hr]:border-neutral-300 [&_li]:my-[0.3em] [&_li>p]:my-0 [&_ol]:my-[0.9em] [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-[0.9em] [&_pre]:my-[1em] [&_pre]:overflow-auto [&_pre]:rounded-lg [&_pre]:bg-zinc-900 [&_pre]:p-3 [&_pre]:text-neutral-100 [&_code]:font-mono [&_strong]:font-semibold [&_table]:my-[1em] [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs [&_th]:border [&_th]:border-neutral-300 [&_th]:bg-neutral-100 [&_th]:p-1.75 [&_th]:text-left [&_th]:align-top [&_td]:border [&_td]:border-neutral-300 [&_td]:p-1.75 [&_td]:text-left [&_td]:align-top [&_ul]:my-[0.9em] [&_ul]:list-disc [&_ul]:pl-5 [&>:first-child]:mt-0 [&>:last-child]:mb-0 [&_:not(pre)>code]:rounded-sm [&_:not(pre)>code]:bg-neutral-100 [&_:not(pre)>code]:px-1 [&_:not(pre)>code]:py-px";

type Example = (typeof examples)[number];

function renderMarkdown(value: string): string {
  const rendered = marked.parse(value);
  return typeof rendered === "string" ? rendered : "";
}

export function LandingPage({endpoint}: { endpoint: string }) {
  const [copied, setCopied] = useState(false);
  const [selected, setSelected] = useState<Example | null>(null);

  const copyInstruction = async () => {
    await navigator.clipboard.writeText(instruction);
    setCopied(true);
  };

  return (
    <div
      className="min-h-screen min-w-[320px] bg-[radial-gradient(circle_at_50%_-20%,#e8edff_0,transparent_38%),#fafafa] font-sans text-neutral-950">
      <main className="mx-auto w-full max-w-240 px-6 pt-7 pb-12 max-sm:px-4 max-sm:pt-5 max-sm:pb-9">
        <nav className="flex items-center justify-between gap-4"><Brand/></nav>
        <section className="mx-auto mt-23 max-w-170 text-center max-sm:mt-16.5">
          <span
            className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-600">
            <span className="text-indigo-600">✦</span> Powered by Gemini
          </span>
          <h1 className="mt-4.5 mb-3.5 text-[clamp(38px,7vw,64px)] leading-[1.02] tracking-[-.03em]">Tired
            of GPTinguish?</h1>
          <p className="mx-auto my-0 max-w-145 text-base leading-[1.65] text-neutral-600">An MCP server that uses
            Gemini to refine ChatGPT's responses. <br/>Same smartness in much more readable text.</p>
          <div
            className="mx-auto mt-7.5 flex max-w-155 items-center gap-2.5 rounded-[10px] border border-neutral-200 bg-white px-3 py-2.5 text-left shadow-[0_1px_2px_#00000008]">
            <code className="overflow-hidden text-xs text-ellipsis whitespace-nowrap text-neutral-700">{endpoint}</code>
          </div>
        </section>

        <section className="mx-auto mt-20 max-w-190 max-sm:mt-13.5">
          <header className="text-center">
            <h2 className="m-0 text-[30px] tracking-[-.04em]">Connect it to ChatGPT</h2>
            <p className="mx-auto mt-2.5 mb-0 max-w-140 text-sm leading-relaxed text-neutral-500">Connect the MCP
              server once, then add an instruction to make GPT Polisher the final editing step.</p>
          </header>
          <div className="mt-7 rounded-[14px] border border-neutral-200 bg-white shadow-[0_8px_24px_#00000008]">
            <div className="px-6.5 py-6 max-sm:p-5">
              <h3 className="m-0 flex items-center gap-3 font-semibold text-[15px] tracking-[-.01em]">
                <span
                  className="grid size-7 shrink-0 place-items-center rounded-full border border-neutral-300 bg-white text-xs font-[650] text-neutral-600">1</span>
                Turn on Developer mode
              </h3>
              <div className="mt-5.25 ml-10">
                <p className="m-0 text-[13px] leading-[1.55] text-neutral-500">In <a
                  className="text-zinc-900 underline-offset-3 underline" href="https://chatgpt.com/#settings/Security" target="_blank"
                  rel="noreferrer">ChatGPT</a>, open <span
                  className="inline-block rounded-[5px] border border-neutral-200 bg-neutral-100 px-1.25 py-px font-mono text-[11px] text-neutral-700">Settings → Security and login</span> and
                  turn on <span
                    className="inline-block rounded-[5px] border border-neutral-200 bg-neutral-100 px-1.25 py-px font-mono text-[11px] text-neutral-700">Developer mode</span>.
                </p>
              </div>
            </div>
            <div className="border-t border-[#ededed] px-6.5 py-6 max-sm:p-5">
              <h3 className="m-0 flex items-center gap-3 font-semibold text-[15px] tracking-[-.01em]">
                <span
                  className="grid size-7 shrink-0 place-items-center rounded-full border border-neutral-300 bg-white text-xs font-[650] text-neutral-600">2</span>
                Connect GPT Polisher
              </h3>
              <div className="mt-5.25 ml-10">
                <p className="m-0 text-[13px] leading-[1.55] text-neutral-500">Go to <a
                  className="text-zinc-900 underline-offset-3 underline" href="https://chatgpt.com/plugins" target="_blank"
                  rel="noreferrer">ChatGPT Plugins</a>,
                  select the plus button, and connect this server URL in Developer mode.</p>
                <p className="mt-1.25 mb-0 text-[13px] leading-[1.55] text-neutral-500"><span
                  className="inline-block rounded-[5px] border border-neutral-200 bg-neutral-100 px-1.25 py-px font-mono text-[11px] text-neutral-700">{endpoint}</span>
                </p>
                <p className="mt-1.25 mb-0 text-[13px] leading-[1.55] text-neutral-500">Complete the Google OAuth
                  and project-selection screens when prompted.</p>
              </div>
            </div>
            <div className="border-t border-[#ededed] px-6.5 py-6 max-sm:p-5">
              <h3 className="m-0 flex items-center gap-3 font-semibold text-[15px] tracking-[-.01em]">
                <span
                  className="grid size-7 shrink-0 place-items-center rounded-full border border-neutral-300 bg-white text-xs font-[650] text-neutral-600">3</span>
                Add the Custom Instruction
              </h3>
              <p className="mt-1.5 mb-0 ml-10 text-[13px] leading-[1.55] text-neutral-500">Paste this into ChatGPT’s Custom
                Instructions.</p>
              <div
                className="relative mt-4 ml-10 rounded-[10px] border border-neutral-200 bg-neutral-50 py-3.75 pr-12.5 pl-3.75 font-mono text-xs leading-relaxed whitespace-pre-wrap text-neutral-800">
                After drafting a response, always call the GPT Polisher <code>rewrite_response</code> tool and provide
                it with the original response and the user's question. Use only the rewritten text returned by the tool
                as your final answer.
                <button
                  className="absolute top-2.5 right-2.5 cursor-pointer rounded-md border border-neutral-300 bg-white px-2 py-1.25 font-[inherit] text-[11px] text-neutral-700 hover:bg-neutral-100"
                  type="button" onClick={copyInstruction}>{copied ? "Copied" : "Copy"}</button>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto mt-18 max-w-190">
          <header className="text-center">
            <h2 className="m-0 text-[30px] tracking-[-.04em]">See it in practice</h2>
            <p className="mx-auto mt-2.5 mb-0 max-w-140 text-sm leading-relaxed text-neutral-500">Open an example
              to compare the complete original response with its GPT Polisher result.</p>
          </header>
          <div className="mt-7 grid grid-cols-2 gap-3.5 max-sm:grid-cols-1">
            {examples.map((example) => (
              <button
                className="cursor-pointer rounded-[14px] border border-neutral-200 bg-white p-5 text-left text-neutral-900"
                type="button" key={example.id} onClick={() => setSelected(example)}>
                <span className="block text-xs text-neutral-500">{example.language}</span>
                <strong className="mt-1.5 block text-[15px]">{example.title}</strong>
                <small className="mt-4 block text-xs text-neutral-600">View full comparison →</small>
              </button>
            ))}
          </div>
        </section>
      </main>

      <Dialog open={selected !== null} onOpenChange={(open) => {
        if (!open) setSelected(null);
      }}>
        {selected && (
          <DialogContent
            className="block h-[min(820px,calc(100vh-32px))] w-[min(1200px,calc(100vw-32px))] max-w-none gap-0 overflow-hidden rounded-[14px] border border-neutral-300 bg-white p-0 text-neutral-900 shadow-[0_24px_80px_#00000040] ring-0 sm:max-w-none">
            <DialogHeader className="block gap-0 border-b border-neutral-200 px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <DialogTitle className="text-sm font-semibold">{selected.title} — {selected.language}</DialogTitle>
              </div>
              <DialogDescription
                className="mt-2.5 mb-0 font-mono text-xs leading-normal text-neutral-600">Prompt: {prompts[selected.id]}</DialogDescription>
            </DialogHeader>
            <div className="grid h-[calc(100%-92px)] grid-cols-2 max-sm:grid-cols-1">
              <article className="flex min-h-0 flex-col overflow-hidden border-r border-neutral-200 max-sm:border-r-0 max-sm:border-b">
                <h3 className="m-0 font-semibold shrink-0 border-b border-neutral-200 bg-white px-5 py-4 text-[13px]">Original</h3>
                <div
                  className={`${markdownClassName} overflow-auto p-5`}
                  dangerouslySetInnerHTML={{__html: renderMarkdown(selected.before)}}/>
              </article>
              <article className="flex min-h-0 flex-col overflow-hidden bg-neutral-50">
                <h3 className="m-0 font-semibold shrink-0 border-b border-neutral-200 bg-neutral-50 px-5 py-4 text-[13px]">GPT Polisher</h3>
                <div
                  className={`${markdownClassName} overflow-auto p-5`}
                  dangerouslySetInnerHTML={{__html: renderMarkdown(selected.after)}}/>
              </article>
            </div>
          </DialogContent>
        )}
      </Dialog>

      <p className="mx-auto mt-4.5 mb-0 max-w-190 text-center text-xs leading-[1.55] text-neutral-500">Only
        connect MCP servers you trust. Read <a className="text-zinc-900 underline-offset-3"
                                               href="https://developers.openai.com/api/docs/mcp#risks-and-safety"
                                               target="_blank" rel="noreferrer">MCP risks
          and safety</a> before connecting.</p>
    </div>
  );
}