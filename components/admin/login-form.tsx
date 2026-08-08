"use client";

import { useEffect, useId, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Field, FieldContent, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

type FormState =
  | { readonly status: "idle" }
  | { readonly status: "submitting" }
  | { readonly status: "error"; readonly message: string }
  | { readonly status: "locked"; readonly retryAfterSeconds: number };

/**
 * The generic message D6 requires: unknown username, wrong password, and
 * (were the form ever reachable in that state, which it isn't - see
 * `app/admin/layout.tsx`'s fail-closed gate) a disabled panel all render
 * identically here. There is deliberately no server response field this
 * component reads to distinguish them.
 */
const INVALID_CREDENTIALS_MESSAGE = "Invalid username or password.";
const NETWORK_ERROR_MESSAGE = "Could not reach the server. Check your connection and try again.";
const UNEXPECTED_ERROR_MESSAGE = "Something went wrong. Please try again.";

function parseRetryAfterSeconds(response: Response): number {
  const header = response.headers.get("Retry-After");
  if (header === null) {
    return 0;
  }
  const parsed = Number.parseInt(header, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/**
 * The admin login form: username/password, submitted via `fetch` to
 * `POST /api/admin/auth/login` rather than a native navigation, so a
 * failed attempt can render inline instead of a full page reload.
 *
 * `next` is passed in already validated by `app/admin/login/page.tsx` -
 * this component just hands it to `router.push` on success, never parses
 * or re-derives it, so the open-redirect guard lives in exactly one place.
 */
export function LoginForm({ next }: { readonly next: string }) {
  const router = useRouter();
  const usernameId = useId();
  const passwordId = useId();
  const errorId = useId();
  const [state, setState] = useState<FormState>({ status: "idle" });

  useEffect(() => {
    if (state.status !== "locked" || state.retryAfterSeconds <= 0) {
      return;
    }
    const timer = setTimeout(() => {
      setState((current) =>
        current.status === "locked"
          ? { status: "locked", retryAfterSeconds: current.retryAfterSeconds - 1 }
          : current,
      );
    }, 1000);
    return () => clearTimeout(timer);
  }, [state]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const username = formData.get("username");
    const password = formData.get("password");
    if (typeof username !== "string" || typeof password !== "string") {
      return;
    }

    setState({ status: "submitting" });

    let response: Response;
    try {
      response = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
    } catch {
      setState({ status: "error", message: NETWORK_ERROR_MESSAGE });
      return;
    }

    if (response.ok) {
      router.push(next);
      router.refresh();
      return;
    }

    if (response.status === 429) {
      const retryAfterSeconds = parseRetryAfterSeconds(response);
      if (retryAfterSeconds > 0) {
        setState({ status: "locked", retryAfterSeconds });
      } else {
        setState({ status: "error", message: "Too many attempts. Please try again shortly." });
      }
      return;
    }

    if (response.status === 401 || response.status === 400) {
      setState({ status: "error", message: INVALID_CREDENTIALS_MESSAGE });
      return;
    }

    setState({ status: "error", message: UNEXPECTED_ERROR_MESSAGE });
  }

  const isSubmitting = state.status === "submitting";
  const isLocked = state.status === "locked" && state.retryAfterSeconds > 0;
  const errorMessage =
    state.status === "error"
      ? state.message
      : isLocked && state.status === "locked"
        ? `Too many attempts. Try again in ${state.retryAfterSeconds}s.`
        : null;

  return (
    <form
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
      className="flex flex-col gap-5"
    >
      <Field data-invalid={errorMessage !== null}>
        <FieldLabel htmlFor={usernameId}>Username</FieldLabel>
        <FieldContent>
          <Input
            id={usernameId}
            name="username"
            type="text"
            autoComplete="username"
            autoFocus
            required
            disabled={isSubmitting || isLocked}
            aria-invalid={errorMessage !== null}
            aria-describedby={errorMessage !== null ? errorId : undefined}
          />
        </FieldContent>
      </Field>
      <Field data-invalid={errorMessage !== null}>
        <FieldLabel htmlFor={passwordId}>Password</FieldLabel>
        <FieldContent>
          <Input
            id={passwordId}
            name="password"
            type="password"
            autoComplete="current-password"
            required
            disabled={isSubmitting || isLocked}
            aria-invalid={errorMessage !== null}
            aria-describedby={errorMessage !== null ? errorId : undefined}
          />
        </FieldContent>
      </Field>
      {errorMessage !== null && <FieldError id={errorId}>{errorMessage}</FieldError>}
      <Button type="submit" disabled={isSubmitting || isLocked} className="w-full">
        {isSubmitting ? <Spinner /> : "Sign in"}
      </Button>
    </form>
  );
}
