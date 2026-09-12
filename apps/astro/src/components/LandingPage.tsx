import {useEffect, useState} from "react";
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

export type Lang = "en" | "ja";

const instruction = "After drafting a response, always call the GPT Polisher rewrite_response tool and provide it with the original response and the user's question. Use only the rewritten text returned by the tool as your final answer.";

const prompts: Record<string, string> = {
  "australia-election-ja": "オーストラリアの次の選挙の争点を調べて",
  "rag-en": "Explain the cases where RAG should be used and where it should not.",
  "rag-ja": "RAGを使うべきケースと、使わない方がよいケースを比較して",
  "tesla-ja": "Teslaは人間に比べFSDの事故率が低いと公称しているが、比較対象は適切？保険会社や警察のデータから、Tesla自体の事故率が高くないか調べて",
  "workers-en": "Explain the difference between Cloudflare Workers and a typical serverless environment",
  "workers-ja": "Cloudflare Workersと一般的なサーバーレス環境の違いを説明して",
};

const exampleMeta: Record<
  string,
  {
    titles: { en: string; ja: string };
    languages: { en: string; ja: string };
  }
> = {
  "australia-election-ja": {
    titles: { en: "Issues in Australia's next election", ja: "オーストラリア次期選挙の争点" },
    languages: { en: "Japanese", ja: "日本語" },
  },
  "rag-en": {
    titles: { en: "RAG decision guide", ja: "RAG導入の判断基準" },
    languages: { en: "English", ja: "英語" },
  },
  "workers-en": {
    titles: { en: "Cloudflare Workers comparison", ja: "Cloudflare Workersの比較" },
    languages: { en: "English", ja: "英語" },
  },
  "rag-ja": {
    titles: { en: "RAG decision criteria", ja: "RAGの判断基準" },
    languages: { en: "Japanese", ja: "日本語" },
  },
  "workers-ja": {
    titles: { en: "Cloudflare Workers comparison", ja: "Cloudflare Workersの比較" },
    languages: { en: "Japanese", ja: "日本語" },
  },
  "tesla-ja": {
    titles: { en: "Tesla accident rate comparison", ja: "Teslaの事故率比較" },
    languages: { en: "Japanese", ja: "日本語" },
  },
};

const translations = {
  en: {
    badge: "✦ Powered by Gemini",
    heroTitle: "Tired of GPTinguish?",
    heroDesc: (
      <>
        An MCP server that uses Gemini to refine ChatGPT's responses.
        <br className="max-sm:hidden" />
        Same smartness in much more readable text.
      </>
    ),
    connectTitle: "Connect it to ChatGPT",
    connectDesc: "Connect the MCP server once, then add a custom instruction to make GPT Polisher the final editing step.",
    step1Title: "Turn on Developer mode",
    step1Desc: (
      <>
        In{" "}
        <a
          className="text-zinc-900 underline underline-offset-3"
          href="https://chatgpt.com/#settings/Security"
          target="_blank"
          rel="noreferrer"
        >
          ChatGPT
        </a>
        , open{" "}
        <span className="inline-block rounded-[5px] border border-neutral-200 bg-neutral-100 px-1.25 py-px font-mono text-[11px] text-neutral-700">
          Settings → Security and login
        </span>{" "}
        and turn on{" "}
        <span className="inline-block rounded-[5px] border border-neutral-200 bg-neutral-100 px-1.25 py-px font-mono text-[11px] text-neutral-700">
          Developer mode
        </span>
        .
      </>
    ),
    step2Title: "Connect GPT Polisher",
    step2Desc: (endpoint: string) => (
      <>
        <p className="m-0 text-[13px] leading-[1.55] text-neutral-500">
          Go to{" "}
          <a
            className="text-zinc-900 underline underline-offset-3"
            href="https://chatgpt.com/plugins"
            target="_blank"
            rel="noreferrer"
          >
            ChatGPT Plugins
          </a>
          , select the plus button, and connect this server URL in Developer mode.
        </p>
        <p className="mt-1.25 mb-0 text-[13px] leading-[1.55] text-neutral-500">
          <span className="inline-block rounded-[5px] border border-neutral-200 bg-neutral-100 px-1.25 py-px font-mono text-[11px] text-neutral-700">
            {endpoint}
          </span>
        </p>
        <p className="mt-1.25 mb-0 text-[13px] leading-[1.55] text-neutral-500">
          Complete the Google OAuth and project-selection screens when prompted.
        </p>
      </>
    ),
    step3Title: "Add the Custom Instruction",
    step3Desc: "Paste this into ChatGPT’s Custom Instructions.",
    instructionNode: (
      <>
        After drafting a response, always call the GPT Polisher <code>rewrite_response</code> tool and provide
        it with the original response and the user's question. Use only the rewritten text returned by the tool
        as your final answer.
      </>
    ),
    instructionText: instruction,
    copy: "Copy",
    copied: "Copied",
    seeInPracticeTitle: "See it in practice",
    seeInPracticeDesc: "Compare the original response with its polished result using GPT Polisher.",
    viewFullComparison: "View full comparison →",
    dialogOriginal: "Original (ChatGPT)",
    dialogPolished: "GPT Polisher (Rewritten)",
    promptLabel: "Prompt: ",
    safetyNotice: (
      <>
        Only connect MCP servers you trust. Read{" "}
        <a
          className="text-zinc-900 underline underline-offset-3"
          href="https://developers.openai.com/api/docs/mcp#risks-and-safety"
          target="_blank"
          rel="noreferrer"
        >
          MCP risks and safety
        </a>{" "}
        before connecting.
      </>
    ),
  },
  ja: {
    badge: "✦ Powered by Gemini",
    heroTitle: "GPT構文にうんざりしていませんか？",
    heroDesc: (
      <>
        ChatGPTの回答をGeminiで自然に推敲・リライトするMCPサーバー。
        <br className="max-sm:hidden" />
        かしこさはそのままに、圧倒的に読みやすい文章へ整えます。
      </>
    ),
    connectTitle: "ChatGPTに接続",
    connectDesc: "MCPサーバーを一度接続し、カスタム指示を追加するだけで、GPT Polisherが最後の推敲を担当します。",
    step1Title: "開発者モードを有効にする",
    step1Desc: (
      <>
        <a
          className="text-zinc-900 underline underline-offset-3"
          href="https://chatgpt.com/#settings/Security"
          target="_blank"
          rel="noreferrer"
        >
          ChatGPT
        </a>
        を開き、
        <span className="inline-block rounded-[5px] border border-neutral-200 bg-neutral-100 px-1.25 py-px font-mono text-[11px] text-neutral-700">
          設定 → セキュリティ
        </span>
        から
        <span className="inline-block rounded-[5px] border border-neutral-200 bg-neutral-100 px-1.25 py-px font-mono text-[11px] text-neutral-700">
          開発者モード（Developer mode）
        </span>
        をオンにします。
      </>
    ),
    step2Title: "GPT Polisherを接続する",
    step2Desc: (endpoint: string) => (
      <>
        <p className="m-0 text-[13px] leading-[1.55] text-neutral-500">
          <a
            className="text-zinc-900 underline underline-offset-3"
            href="https://chatgpt.com/plugins"
            target="_blank"
            rel="noreferrer"
          >
            ChatGPT Plugins
          </a>
          へアクセスして「＋」ボタンを押し、開発者モードでこのサーバーURLを登録します。
        </p>
        <p className="mt-1.25 mb-0 text-[13px] leading-[1.55] text-neutral-500">
          <span className="inline-block rounded-[5px] border border-neutral-200 bg-neutral-100 px-1.25 py-px font-mono text-[11px] text-neutral-700">
            {endpoint}
          </span>
        </p>
        <p className="mt-1.25 mb-0 text-[13px] leading-[1.55] text-neutral-500">
          画面の案内に従ってGoogleアカウント連携とGoogle Cloudプロジェクトの選択を完了してください。
        </p>
      </>
    ),
    step3Title: "カスタム指示を追加する",
    step3Subtitle: "ChatGPTの「カスタム指示」（Custom Instructions）に以下を貼り付けます。",
    step3Desc: "ChatGPTの「カスタム指示」（Custom Instructions）に以下を貼り付けます。",
    instructionNode: (
      <>
        回答を作成した後は、必ずGPT Polisherの <code>rewrite_response</code> ツールを呼び出し、下書きの回答とユーザーの質問を渡してください。ツールから返された推敲後のテキストのみを最終的な回答として出力してください。
      </>
    ),
    instructionText: instruction,
    copy: "コピー",
    copied: "コピー完了",
    seeInPracticeTitle: "実際の推敲例",
    seeInPracticeDesc: "ChatGPTの元の回答とGPT Polisherによる推敲結果を比較できます。",
    viewFullComparison: "比較の詳細を見る →",
    dialogOriginal: "元の回答（ChatGPT）",
    dialogPolished: "GPT Polisher（推敲後）",
    promptLabel: "プロンプト: ",
    safetyNotice: (
      <>
        信頼できるMCPサーバーにのみ接続してください。接続前に{" "}
        <a
          className="text-zinc-900 underline underline-offset-3"
          href="https://developers.openai.com/api/docs/mcp#risks-and-safety"
          target="_blank"
          rel="noreferrer"
        >
          MCPのセキュリティとリスク
        </a>{" "}
        をご確認ください。
      </>
    ),
  },
};

const markdownClassName = "text-[13px] leading-[1.65] text-neutral-800 [&_a]:text-indigo-700 [&_a]:underline [&_a]:underline-offset-2 [&_blockquote]:my-[1em] [&_blockquote]:border-l-3 [&_blockquote]:border-neutral-300 [&_blockquote]:pl-3 [&_blockquote]:text-neutral-600 [&_h1]:mt-[1.5em] [&_h1]:mb-[0.6em] [&_h1]:text-xl [&_h1]:leading-tight [&_h1]:font-semibold [&_h2]:mt-[1.5em] [&_h2]:mb-[0.6em] [&_h2]:text-lg [&_h2]:leading-tight [&_h2]:font-semibold [&_h3]:mt-[1.4em] [&_h3]:mb-[0.55em] [&_h3]:text-base [&_h3]:leading-snug [&_h3]:font-semibold [&_h4]:mt-[1.3em] [&_h4]:mb-[0.5em] [&_h4]:text-sm [&_h4]:leading-snug [&_h4]:font-semibold [&_hr]:my-5 [&_hr]:border-0 [&_hr]:border-t [&_hr]:border-neutral-300 [&_li]:my-[0.3em] [&_li>p]:my-0 [&_ol]:my-[0.9em] [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-[0.9em] [&_pre]:my-[1em] [&_pre]:overflow-auto [&_pre]:rounded-lg [&_pre]:bg-zinc-900 [&_pre]:p-3 [&_pre]:text-neutral-100 [&_code]:font-mono [&_strong]:font-semibold [&_table]:my-[1em] [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs [&_th]:border [&_th]:border-neutral-300 [&_th]:bg-neutral-100 [&_th]:p-1.75 [&_th]:text-left [&_th]:align-top [&_td]:border [&_td]:border-neutral-300 [&_td]:p-1.75 [&_td]:text-left [&_td]:align-top [&_ul]:my-[0.9em] [&_ul]:list-disc [&_ul]:pl-5 [&>:first-child]:mt-0 [&>:last-child]:mb-0 [&_:not(pre)>code]:rounded-sm [&_:not(pre)>code]:bg-neutral-100 [&_:not(pre)>code]:px-1 [&_:not(pre)>code]:py-px";

type Example = (typeof examples)[number];

function renderMarkdown(value: string): string {
  const rendered = marked.parse(value);
  return typeof rendered === "string" ? rendered : "";
}

export function LandingPage({
  endpoint,
  initialLang = "en",
}: {
  endpoint: string;
  initialLang?: Lang;
}) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const [copied, setCopied] = useState(false);
  const [selected, setSelected] = useState<Example | null>(null);

  const t = translations[lang];

  useEffect(() => {
    const saved = localStorage.getItem("gpt_polisher_lang") as Lang | null;
    if (saved === "en" || saved === "ja") {
      setLang(saved);
      document.documentElement.lang = saved;
    } else {
      const browserLang = navigator.language.toLowerCase();
      if (browserLang.startsWith("ja")) {
        setLang("ja");
        document.documentElement.lang = "ja";
      }
    }
  }, []);

  useEffect(() => {
    document.title =
      lang === "ja"
        ? "GPT Polisher - ChatGPTの回答をGeminiで自然に推敲"
        : "GPT Polisher - Refine ChatGPT responses with Gemini";
  }, [lang]);

  const handleLangChange = (nextLang: Lang) => {
    setLang(nextLang);
    localStorage.setItem("gpt_polisher_lang", nextLang);
    document.documentElement.lang = nextLang;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("lang", nextLang);
      window.history.replaceState({}, "", url.toString());
    } catch {}
  };

  const copyInstruction = async () => {
    await navigator.clipboard.writeText(t.instructionText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sortedExamples = [...examples].sort((a, b) => {
    if (lang === "ja") {
      const aIsJa = a.id.endsWith("-ja") ? 0 : 1;
      const bIsJa = b.id.endsWith("-ja") ? 0 : 1;
      return aIsJa - bIsJa;
    }
    const aIsEn = a.id.endsWith("-en") ? 0 : 1;
    const bIsEn = b.id.endsWith("-en") ? 0 : 1;
    return aIsEn - bIsEn;
  });

  return (
    <div className="min-h-screen min-w-[320px] bg-[radial-gradient(circle_at_50%_-20%,#e8edff_0,transparent_38%),#fafafa] font-sans text-neutral-950">
      <main className="mx-auto w-full max-w-240 px-6 pt-7 pb-12 max-sm:px-4 max-sm:pt-5 max-sm:pb-9">
        <nav className="flex items-center justify-between gap-4">
          <Brand />
          <div
            className="flex items-center rounded-full border border-neutral-200 bg-white/90 p-0.5 text-xs font-medium text-neutral-600 shadow-[0_1px_2px_#00000008] backdrop-blur-xs"
            role="group"
            aria-label="Language selection"
          >
            <div className="flex items-center pl-2 pr-1 text-neutral-400">
              <svg
                className="size-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                <path d="M2 12h20" />
              </svg>
            </div>
            <button
              type="button"
              onClick={() => handleLangChange("en")}
              className={`cursor-pointer rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
                lang === "en"
                  ? "bg-neutral-900 text-white font-semibold shadow-xs"
                  : "text-neutral-600 hover:text-neutral-950"
              }`}
              aria-pressed={lang === "en"}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => handleLangChange("ja")}
              className={`cursor-pointer rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
                lang === "ja"
                  ? "bg-neutral-900 text-white font-semibold shadow-xs"
                  : "text-neutral-600 hover:text-neutral-950"
              }`}
              aria-pressed={lang === "ja"}
            >
              日本語
            </button>
          </div>
        </nav>

        <section className="mx-auto mt-23 max-w-170 text-center max-sm:mt-16.5">
          <span className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-600">
            <span className="text-indigo-600">✦</span> {t.badge.replace(/^✦\s*/, "")}
          </span>
          <h1 className="mt-4.5 mb-3.5 text-[clamp(34px,6.5vw,64px)] leading-[1.08] tracking-[-.03em]">
            {t.heroTitle}
          </h1>
          <p className="mx-auto my-0 max-w-145 text-base leading-[1.65] text-neutral-600">{t.heroDesc}</p>
          <div className="mx-auto mt-7.5 flex max-w-155 items-center gap-2.5 rounded-[10px] border border-neutral-200 bg-white px-3 py-2.5 text-left shadow-[0_1px_2px_#00000008]">
            <code className="overflow-hidden text-xs text-ellipsis whitespace-nowrap text-neutral-700">{endpoint}</code>
          </div>
        </section>

        <section className="mx-auto mt-20 max-w-190 max-sm:mt-13.5">
          <header className="text-center">
            <h2 className="m-0 text-[30px] tracking-[-.04em]">{t.connectTitle}</h2>
            <p className="mx-auto mt-2.5 mb-0 max-w-140 text-sm leading-relaxed text-neutral-500">
              {t.connectDesc}
            </p>
          </header>
          <div className="mt-7 rounded-[14px] border border-neutral-200 bg-white shadow-[0_8px_24px_#00000008]">
            <div className="px-6.5 py-6 max-sm:p-5">
              <h3 className="m-0 flex items-center gap-3 font-semibold text-[15px] tracking-[-.01em]">
                <span className="grid size-7 shrink-0 place-items-center rounded-full border border-neutral-300 bg-white text-xs font-[650] text-neutral-600">
                  1
                </span>
                {t.step1Title}
              </h3>
              <div className="mt-5.25 ml-10">
                <p className="m-0 text-[13px] leading-[1.55] text-neutral-500">{t.step1Desc}</p>
              </div>
            </div>
            <div className="border-t border-[#ededed] px-6.5 py-6 max-sm:p-5">
              <h3 className="m-0 flex items-center gap-3 font-semibold text-[15px] tracking-[-.01em]">
                <span className="grid size-7 shrink-0 place-items-center rounded-full border border-neutral-300 bg-white text-xs font-[650] text-neutral-600">
                  2
                </span>
                {t.step2Title}
              </h3>
              <div className="mt-5.25 ml-10">{t.step2Desc(endpoint)}</div>
            </div>
            <div className="border-t border-[#ededed] px-6.5 py-6 max-sm:p-5">
              <h3 className="m-0 flex items-center gap-3 font-semibold text-[15px] tracking-[-.01em]">
                <span className="grid size-7 shrink-0 place-items-center rounded-full border border-neutral-300 bg-white text-xs font-[650] text-neutral-600">
                  3
                </span>
                {t.step3Title}
              </h3>
              <p className="mt-1.5 mb-0 ml-10 text-[13px] leading-[1.55] text-neutral-500">{t.step3Desc}</p>
              <div className="relative mt-4 ml-10 rounded-[10px] border border-neutral-200 bg-neutral-50 py-3.75 pr-16 pl-3.75 font-mono text-xs leading-relaxed whitespace-pre-wrap text-neutral-800">
                {t.instructionNode}
                <button
                  className="absolute top-2.5 right-2.5 cursor-pointer rounded-md border border-neutral-300 bg-white px-2.5 py-1.25 font-[inherit] text-[11px] font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
                  type="button"
                  onClick={copyInstruction}
                >
                  {copied ? t.copied : t.copy}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto mt-18 max-w-190">
          <header className="text-center">
            <h2 className="m-0 text-[30px] tracking-[-.04em]">{t.seeInPracticeTitle}</h2>
            <p className="mx-auto mt-2.5 mb-0 max-w-140 text-sm leading-relaxed text-neutral-500">
              {t.seeInPracticeDesc}
            </p>
          </header>
          <div className="mt-7 grid grid-cols-2 gap-3.5 max-sm:grid-cols-1">
            {sortedExamples.map((example) => {
              const meta = exampleMeta[example.id];
              const title = meta ? meta.titles[lang] : example.title;
              const exampleLang = meta ? meta.languages[lang] : example.language;
              return (
                <button
                  className="cursor-pointer rounded-[14px] border border-neutral-200 bg-white p-5 text-left text-neutral-900 transition-all hover:border-neutral-300 hover:shadow-xs"
                  type="button"
                  key={example.id}
                  onClick={() => setSelected(example)}
                >
                  <span className="block text-xs text-neutral-500">{exampleLang}</span>
                  <strong className="mt-1.5 block text-[15px]">{title}</strong>
                  <small className="mt-4 block text-xs font-medium text-neutral-600">
                    {t.viewFullComparison}
                  </small>
                </button>
              );
            })}
          </div>
        </section>
      </main>

      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        {selected && (
          <DialogContent className="block h-[min(820px,calc(100vh-32px))] w-[min(1200px,calc(100vw-32px))] max-w-none gap-0 overflow-hidden rounded-[14px] border border-neutral-300 bg-white p-0 text-neutral-900 shadow-[0_24px_80px_#00000040] ring-0 sm:max-w-none">
            <DialogHeader className="block gap-0 border-b border-neutral-200 px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <DialogTitle className="text-sm font-semibold">
                  {exampleMeta[selected.id] ? exampleMeta[selected.id].titles[lang] : selected.title} —{" "}
                  {exampleMeta[selected.id] ? exampleMeta[selected.id].languages[lang] : selected.language}
                </DialogTitle>
              </div>
              <DialogDescription className="mt-2.5 mb-0 font-mono text-xs leading-normal text-neutral-600">
                {t.promptLabel}
                {prompts[selected.id]}
              </DialogDescription>
            </DialogHeader>
            <div className="grid h-[calc(100%-92px)] grid-cols-2 max-sm:grid-cols-1">
              <article className="flex min-h-0 flex-col overflow-hidden border-r border-neutral-200 max-sm:border-r-0 max-sm:border-b">
                <h3 className="m-0 shrink-0 border-b border-neutral-200 bg-white px-5 py-4 text-[13px] font-semibold text-neutral-700">
                  {t.dialogOriginal}
                </h3>
                <div
                  className={`${markdownClassName} overflow-auto p-5`}
                  dangerouslySetInnerHTML={{__html: renderMarkdown(selected.before)}}
                />
              </article>
              <article className="flex min-h-0 flex-col overflow-hidden bg-neutral-50">
                <h3 className="m-0 shrink-0 border-b border-neutral-200 bg-neutral-50 px-5 py-4 text-[13px] font-semibold text-neutral-900">
                  {t.dialogPolished}
                </h3>
                <div
                  className={`${markdownClassName} overflow-auto p-5`}
                  dangerouslySetInnerHTML={{__html: renderMarkdown(selected.after)}}
                />
              </article>
            </div>
          </DialogContent>
        )}
      </Dialog>

      <p className="mx-auto mt-4.5 mb-0 max-w-190 text-center text-xs leading-[1.55] text-neutral-500">
        {t.safetyNotice}
      </p>
    </div>
  );
}