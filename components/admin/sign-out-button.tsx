"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Logout04Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/**
 * Signs the operator out and returns to the login page. Always navigates
 * away in its `finally` clause, even if the logout request itself fails
 * (a rare network error) - the operator's intent is to leave the admin
 * area, and `/admin/login` re-checking the session on arrival is a safe
 * fallback either way.
 */
export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSignOut(): Promise<void> {
    setPending(true);
    try {
      await fetch("/api/admin/auth/logout", { method: "POST" });
    } finally {
      router.push("/admin/login");
      router.refresh();
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Sign out"
      onClick={() => {
        void handleSignOut();
      }}
      disabled={pending}
    >
      {pending ? <Spinner /> : <HugeiconsIcon icon={Logout04Icon} strokeWidth={2} />}
    </Button>
  );
}
