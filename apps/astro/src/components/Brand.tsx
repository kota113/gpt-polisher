export function Brand() {
  return (
    <a className="inline-flex items-center gap-2.5 text-sm font-[650] text-neutral-900 no-underline" href="/">
      <span
        className="grid h-7.5 w-7.5 place-items-center rounded-lg border border-neutral-300 bg-white shadow-[0_1px_2px_#0000000d]">
        <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
             aria-hidden="true">
          <path d="M7 3v4M5 5h4M17 17v4m-2-2h4M5 19l14-14"/>
          <path d="M15 3h4a2 2 0 0 1 2 2v4"/>
        </svg>
      </span>
      <span>GPT Polisher</span>
    </a>
  );
}