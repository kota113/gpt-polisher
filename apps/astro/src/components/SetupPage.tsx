import {useEffect, useState} from "react";
import {Brand} from "./Brand";

type Project = { projectId: string; displayName?: string };
type SetupData = { projects: Project[] };

const fieldClass = "h-10 w-full rounded-lg border border-neutral-300 bg-white px-[11px] font-[inherit] text-[13px] text-neutral-900 shadow-[0_1px_2px_#00000008] outline-none focus:border-zinc-900 focus:shadow-[0_0_0_3px_#18181b18]";
const buttonClass = "inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-zinc-900 bg-zinc-900 px-3.5 font-[inherit] text-[13px] font-semibold text-white transition-colors duration-150 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-55 [&_svg]:size-[15px]";

export function SetupPage({state}: { state: string }) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!state) {
      setError("Missing setup state");
      return;
    }

    const controller = new AbortController();
    fetch(`/api/setup?state=${encodeURIComponent(state)}`, {signal: controller.signal})
      .then(async (response) => {
        const data = await response.json() as SetupData & { error?: string };
        if (!response.ok) {
          setError(data.error ?? "Failed to load projects");
          return;
        }
        setProjects(data.projects);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "Failed to load projects");
      });
    return () => controller.abort();
  }, [state]);

  const submit = async (form: HTMLFormElement, path: string) => {
    setSubmitting(true);
    setError("");
    try {
      const body = new URLSearchParams();
      for (const [key, value] of new FormData(form)) body.set(key, String(value));
      const response = await fetch(path, {method: "POST", body});
      const data = await response.json() as { redirectTo?: string; error?: string };
      if (!response.ok || !data.redirectTo) {
        setError(data.error ?? "Setup failed");
        setSubmitting(false);
        return;
      }
      window.location.assign(data.redirectTo);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Setup failed");
      setSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen min-w-[320px] bg-[radial-gradient(circle_at_50%_-20%,#e8edff_0,transparent_38%),#fafafa] font-sans text-neutral-950">
      <main className="mx-auto w-full max-w-240 px-6 pt-7 pb-12 max-sm:px-4 max-sm:pt-5 max-sm:pb-9">
        <nav className="flex items-center justify-between gap-4">
          <Brand/>
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-2.25 py-1.25 text-xs font-[550] text-neutral-600">
          <span className="size-1.5 rounded-full bg-green-600"/> Secure connection
        </span>
        </nav>
        <section className="mx-auto mt-18 max-w-140 max-sm:mt-12">
          <a
            className="inline-flex items-center gap-1.75 text-[13px] text-neutral-600 no-underline hover:text-neutral-900"
            href="/">
            <svg className="size-3.75" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="m15 18-6-6 6-6"/>
            </svg>
            Back to GPT Polisher
          </a>
          <div
            className="mt-5 overflow-hidden rounded-[14px] border border-neutral-200 bg-white shadow-[0_10px_28px_#0000000a]">
            <header className="border-b border-[#f0f0f0] px-7 pt-7 pb-5 max-sm:px-5">
              <h1 className="m-0 text-2xl tracking-[-.035em]">Choose your Cloud project</h1>
              <p className="mt-2 mb-0 text-sm leading-[1.55] text-neutral-500">Gemini requests will use the selected
                project’s API quota and billing configuration.</p>
            </header>
            <div className="px-7 pt-5 pb-7 max-sm:px-5">
              {error && <p
                className="mt-0 mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs leading-normal text-red-800"
                role="alert">{error}</p>}
              {projects === null ? !error && <p className="m-0 text-[13px] text-neutral-500">Loading projects…</p> : (
                <>
                  <form className="flex flex-col gap-2" onSubmit={(event) => {
                    event.preventDefault();
                    void submit(event.currentTarget, "/api/setup/select");
                  }}>
                    <input type="hidden" name="state" value={state}/>
                    <label className="text-[13px] font-semibold" htmlFor="project-id">Existing project</label>
                    <select className={fieldClass} id="project-id" name="projectId" required defaultValue="">
                      {projects?.length ? <option value="" disabled>Select a project</option> :
                        <option value="" disabled>No active projects available</option>}
                      {projects?.map((project) => <option key={project.projectId}
                                                          value={project.projectId}>{project.displayName ?? project.projectId} — {project.projectId}</option>)}
                    </select>
                    <p className="m-0 text-xs leading-normal text-neutral-500">Only projects your Google account can
                      access
                      are listed.</p>
                    <button className={buttonClass} type="submit" disabled={submitting || !projects?.length}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="m5 12 4 4L19 6"/>
                      </svg>
                      Use this project
                    </button>
                  </form>
                  <div
                    className="my-5.5 flex items-center gap-2.5 text-[11px] tracking-[.08em] text-neutral-400 uppercase">
                    <span className="h-px flex-1 bg-neutral-200"/>or<span className="h-px flex-1 bg-neutral-200"/>
                  </div>
                  <form className="flex flex-col gap-2" onSubmit={(event) => {
                    event.preventDefault();
                    void submit(event.currentTarget, "/api/setup/create");
                  }}>
                    <input type="hidden" name="state" value={state}/>
                    <label className="text-[13px] font-semibold" htmlFor="new-project-id">Create a new project</label>
                    <input className={fieldClass} id="new-project-id" name="projectId" pattern="[a-z][a-z0-9-]{5,29}"
                           placeholder="gemini-rewrite-12345" required/>
                    <p className="m-0 text-xs leading-normal text-neutral-500">6–30 lowercase letters, numbers, or
                      hyphens.</p>
                    <label className="text-[13px] font-semibold" htmlFor="display-name">Project name</label>
                    <input className={fieldClass} id="display-name" name="displayName" defaultValue="GPT Polisher"
                           required/>
                    <button
                      className={`${buttonClass} border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-100`}
                      type="submit" disabled={submitting}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
                        <path d="M12 5v14M5 12h14"/>
                      </svg>
                      Create and use project
                    </button>
                  </form>
                  <aside
                    className="mt-4.5 flex gap-2.25 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.75 text-xs leading-normal text-neutral-600">
                    <svg className="mt-px size-3.75 shrink-0" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                      <circle cx="12" cy="12" r="9"/>
                      <path d="M12 11v5M12 8h.01"/>
                    </svg>
                    <span>Creating a project requires the appropriate Google Cloud permission. Billing is not attached automatically.</span>
                  </aside>
                </>
              )}
            </div>
          </div>
          <p className="mt-4 mb-0 text-center text-xs text-neutral-500">Your Google credential is encrypted before it is
            stored.</p>
        </section>
      </main>
    </div>
  );
}