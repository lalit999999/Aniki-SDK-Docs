import { commandsOnly, parseTerminalLines } from "@/lib/doc-components/terminal";

import { CopyButton } from "./copy-button";

/**
 * A recorded terminal session - window chrome, a `$`/`>` prompt per
 * command line, and a copy control that copies commands only, prompts
 * stripped (via `commandsOnly`). Routed from the fence language
 * (`` ```terminal ``) in `markdown-nodes.tsx` rather than a directive, so
 * it stays a real `code` mdast node like every other fence.
 *
 * A Server Component: `CopyButton` is the only interactive piece, composed
 * in rather than pulling the whole block behind a client boundary (D10).
 *
 * @example
 * ```md
 * ```terminal
 * $ npm install
 * added 1 package in 2s
 * ```
 * ```
 */
export function Terminal({ code }: { code: string }) {
  const lines = parseTerminalLines(code);
  const commands = commandsOnly(lines);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-foreground text-background">
      <div className="flex items-center justify-between border-b border-background/10 px-4 py-2">
        <div className="flex gap-1.5" aria-hidden="true">
          <span className="size-2.5 rounded-full bg-background/20" />
          <span className="size-2.5 rounded-full bg-background/20" />
          <span className="size-2.5 rounded-full bg-background/20" />
        </div>
        {commands.length > 0 && (
          <CopyButton
            text={commands}
            label="Copy commands"
            className="text-background/70 hover:bg-background/10 hover:text-background focus-visible:ring-background/50"
          />
        )}
      </div>
      <div className="overflow-x-auto">
        <pre className="px-4 py-3 text-sm">
          <code className="grid font-mono">
            {lines.map((line, index) => (
              <span key={index} className="whitespace-pre">
                {line.kind === "command" ? (
                  <>
                    <span aria-hidden="true" className="mr-2 text-background/50 select-none">
                      {line.prompt}
                    </span>
                    {line.text}
                  </>
                ) : (
                  <span className="text-background/70">{line.text.length > 0 ? line.text : " "}</span>
                )}
              </span>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
}
