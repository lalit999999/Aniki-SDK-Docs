/**
 * First focusable element on every page. Visually hidden until it
 * receives focus, at which point it becomes the fastest way for a
 * keyboard/screen-reader user to jump past the header and sidebar.
 */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-4 focus-visible:left-4 focus-visible:z-[100] focus-visible:rounded-md focus-visible:border focus-visible:border-border focus-visible:bg-background focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:font-medium focus-visible:text-foreground focus-visible:shadow-lg"
    >
      Skip to content
    </a>
  );
}
