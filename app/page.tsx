import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { GithubIcon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { CopyCommand } from "@/components/docs/copy-command";
import { siteConfig } from "@/config/site";

/**
 * Landing page shell. This is deliberately minimal - a hero and one code
 * sample - not the full 12-section marketing page from the product brief,
 * which is its own, later task.
 */
export default function Home() {
  return (
    <div className="relative flex flex-1 flex-col items-center overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_-20%,color-mix(in_oklch,var(--primary),transparent_85%),transparent_60%)]"
      />
      <section className="mx-auto flex max-w-3xl flex-col items-center px-6 py-24 text-center sm:py-32">
        <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
          Build production-ready AI agents
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          {siteConfig.name} is a provider-agnostic TypeScript SDK for building AI agents you can
          inspect, test, and trust in production.
        </p>

        <div className="mt-8">
          <CopyCommand command={`npm install ${siteConfig.packageName}`} />
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Button asChild size="lg">
            <Link href="/docs">Read the docs</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <a href={siteConfig.links.sdkRepo} target="_blank" rel="noreferrer noopener">
              <HugeiconsIcon icon={GithubIcon} strokeWidth={2} />
              View on GitHub
            </a>
          </Button>
        </div>

        <pre className="mt-16 w-full overflow-x-auto rounded-xl border border-border bg-muted p-6 text-left text-sm">
          <code className="font-mono text-foreground">{`import { Agent, Runner } from "${siteConfig.packageName}";

const agent = new Agent({
  name: "assistant",
  instructions: "You are a helpful assistant.",
});

const result = await new Runner().run(agent, "Hello!");
console.log(result.output);`}</code>
        </pre>
      </section>
    </div>
  );
}
