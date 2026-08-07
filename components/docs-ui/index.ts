/**
 * Public entry point for the documentation component library - the
 * presentational half of the Step 8 deliverable (D3). This is what a
 * future landing page section, or any other consumer outside this
 * directory, should import a component from - not a direct path into an
 * individual file, which stays free to be renamed or split without
 * breaking a caller.
 *
 * Deliberately excluded: `MarkdownNodes` and `UnknownDirective`. Both are
 * rendering-pipeline internals (D6) - the mdast recursion engine and its
 * D5 fallback card - not members of the fifteen-strong component family
 * this library actually offers. `MarkdownBody` (`components/docs`) is the
 * intended entry point for rendering a full markdown document; nothing
 * outside `components/docs-ui` should call `MarkdownNodes` directly.
 *
 * Every prop type here is derived with `ComponentProps<typeof X>` rather
 * than hand-duplicated, so it can never drift from the component's actual
 * signature - a component whose props change and a barrel export that
 * silently goes stale is exactly the kind of bug a derived type can't
 * have.
 *
 * @example
 * ```tsx
 * import { Callout, Steps, StepPanel } from "@/components/docs-ui";
 * import type { CalloutType } from "@/components/docs-ui";
 * ```
 */

import type { ComponentProps } from "react";

import { Callout, CALLOUT_TYPES } from "./callout";
import { CodeBlock } from "./code-block";
import { CopyButton } from "./copy-button";
import { Terminal } from "./terminal";
import { DocTabs, TabPanel } from "./doc-tabs";
import { CodeGroup } from "./code-group";
import { StepPanel, Steps } from "./steps";
import { AccordionItemPanel, DocAccordion } from "./doc-accordion";
import { CardsGrid, DocCard } from "./cards";
import { Feature, FeatureGrid } from "./feature-grid";
import { DocBadge } from "./doc-badge";
import { FileTree } from "./file-tree";
import { ApiEndpoint, HTTP_METHODS } from "./api-endpoint";
import { Playground, PLAYGROUND_STATUSES } from "./playground";
import { PackageInstall } from "./package-install";

export type { CalloutType } from "./callout";
export type { CodeBlockProps } from "./code-block";
export type { DocBadgeVariant } from "./doc-badge";
export type { HttpMethod } from "./api-endpoint";
export type { PlaygroundStatus } from "./playground";

export {
  AccordionItemPanel,
  ApiEndpoint,
  CALLOUT_TYPES,
  CardsGrid,
  Callout,
  CodeBlock,
  CodeGroup,
  CopyButton,
  DocAccordion,
  DocBadge,
  DocCard,
  DocTabs,
  Feature,
  FeatureGrid,
  FileTree,
  HTTP_METHODS,
  PLAYGROUND_STATUSES,
  PackageInstall,
  Playground,
  StepPanel,
  Steps,
  TabPanel,
  Terminal,
};

export type AccordionItemPanelProps = ComponentProps<typeof AccordionItemPanel>;
export type ApiEndpointProps = ComponentProps<typeof ApiEndpoint>;
export type CalloutProps = ComponentProps<typeof Callout>;
export type CardsGridProps = ComponentProps<typeof CardsGrid>;
export type CodeGroupProps = ComponentProps<typeof CodeGroup>;
export type CopyButtonProps = ComponentProps<typeof CopyButton>;
export type DocAccordionProps = ComponentProps<typeof DocAccordion>;
export type DocBadgeProps = ComponentProps<typeof DocBadge>;
export type DocCardProps = ComponentProps<typeof DocCard>;
export type DocTabsProps = ComponentProps<typeof DocTabs>;
export type FeatureProps = ComponentProps<typeof Feature>;
export type FeatureGridProps = ComponentProps<typeof FeatureGrid>;
export type FileTreeProps = ComponentProps<typeof FileTree>;
export type PackageInstallProps = ComponentProps<typeof PackageInstall>;
export type PlaygroundProps = ComponentProps<typeof Playground>;
export type StepPanelProps = ComponentProps<typeof StepPanel>;
export type StepsProps = ComponentProps<typeof Steps>;
export type TabPanelProps = ComponentProps<typeof TabPanel>;
export type TerminalProps = ComponentProps<typeof Terminal>;
