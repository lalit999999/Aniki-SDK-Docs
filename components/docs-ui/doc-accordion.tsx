"use client";

import { Children, isValidElement } from "react";
import type { ReactElement, ReactNode } from "react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface AccordionItemPanelProps {
  title?: string;
  open?: boolean;
  children?: ReactNode;
}

/**
 * The `:::accordion-item{title open}` marker `DocAccordion` reads back out
 * of its `children` via `React.Children` - the same compound-component
 * pattern `TabPanel`/`StepPanel` use. Never dispatched on its own (D3):
 * only ever encountered as a child while `accordion` recurses into its
 * body, by which point `accordion`'s own `deriveAttrs` has already
 * rejected more than one default-open item under `type="single"`.
 */
export function AccordionItemPanel({ children }: AccordionItemPanelProps) {
  return <>{children}</>;
}

/**
 * `::::accordion{type=single|multiple}` over `components/ui/accordion`.
 * Radix supplies the expand/collapse animation, keyboard behaviour, and
 * `aria-expanded` wiring (D15) - this component only maps each
 * `AccordionItemPanel` to an `AccordionItem`/`AccordionTrigger`/
 * `AccordionContent` triple and works out which items start open.
 *
 * `type="single"` renders with `collapsible` so the one open item can also
 * be closed - Radix's own default (`collapsible={false}`) would otherwise
 * force exactly one item to always stay open, which nothing in the
 * grammar asks for.
 *
 * A collapsed item's content stays mounted in the DOM (Radix animates the
 * height of real content, it doesn't unmount it), so a heading inside an
 * `accordion-item` keeps consuming the shared heading queue in document
 * order exactly like any other nested directive - correct, and not
 * something to "optimize" by only rendering the open item's body.
 *
 * A Client Component: expand/collapse is interactive state (D10).
 *
 * @example
 * ```md
 * ::::accordion{type=single}
 * :::accordion-item{title="Is it free?" open}
 * Yes, MIT licensed.
 * :::
 * :::accordion-item{title="Does it support streaming?"}
 * Yes.
 * :::
 * ::::
 * ```
 */
export function DocAccordion({
  type = "single",
  children,
}: {
  type?: "single" | "multiple";
  children?: ReactNode;
}) {
  const items = Children.toArray(children).filter(
    (child): child is ReactElement<AccordionItemPanelProps> => isValidElement(child),
  );
  const values = items.map((_, index) => `item-${index}`);
  const openValues = values.filter((_, index) => items[index]?.props.open === true);

  if (items.length === 0) {
    return null;
  }

  const rows = items.map((item, index) => (
    <AccordionItem key={values[index]} value={values[index]}>
      <AccordionTrigger>{item.props.title}</AccordionTrigger>
      <AccordionContent>{item}</AccordionContent>
    </AccordionItem>
  ));

  if (type === "multiple") {
    return (
      <Accordion type="multiple" defaultValue={openValues}>
        {rows}
      </Accordion>
    );
  }

  return (
    <Accordion type="single" collapsible defaultValue={openValues[0]}>
      {rows}
    </Accordion>
  );
}
