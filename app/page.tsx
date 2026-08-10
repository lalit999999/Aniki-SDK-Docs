import Link from "next/link";

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
          {siteConfig.name} is a provider-agnostic TypeScript SDK for building
          AI agents you can inspect, test, and trust in production.
        </p>

        <div className="mt-8">
          <CopyCommand command={`npm install ${siteConfig.packageName}`} />
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Button asChild size="lg">
            <Link href="/docs">Read the docs</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <a
              href={siteConfig.links.sdkRepo}
              target="_blank"
              rel="noreferrer noopener"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="currentColor"
              >
                <path d="M12 2a10 10 0 0 0-3.162 19.487c.5.09.682-.217.682-.482v-1.69c-2.78.605-3.366-1.193-3.366-1.193-.455-1.157-1.11-1.466-1.11-1.466-.908-.621.069-.609.069-.609 1.004.071 1.532 1.032 1.532 1.032.893 1.53 2.343 1.088 2.915.832.09-.647.35-1.087.637-1.338-2.22-.253-4.555-1.11-4.555-4.941 0-1.09.39-1.98 1.03-2.678-.103-.253-.446-1.268.098-2.643 0 0 .84-.269 2.75 1.024a9.52 9.52 0 0 1 5 0c1.91-1.293 2.75-1.024 2.75-1.024.544 1.375.201 2.39.098 2.643.64.698 1.03 1.588 1.03 2.678 0 3.84-2.338 4.685-4.566 4.934.36.31.68.92.68 1.855v2.75c0 .267.18.576.688.48A10 10 0 0 0 12 2Z" />
              </svg>
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
