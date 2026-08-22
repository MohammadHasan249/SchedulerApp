"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ConfirmedPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    const code = searchParams.get("code");
    if (!code) {
      setStatus("error");
      return;
    }

    const supabase = createClient();
    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      setStatus(error ? "error" : "success");
    });
  }, [searchParams]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {status === "loading" && "Confirming your email…"}
          {status === "success" && "Email confirmed"}
          {status === "error" && "Confirmation failed"}
        </CardTitle>
        <CardDescription>
          {status === "loading" && "Just a moment while we verify your account."}
          {status === "success" && "Your account is ready. You can now sign in."}
          {status === "error" &&
            "This confirmation link is invalid or has expired. Please try signing up again or request a new link."}
        </CardDescription>
      </CardHeader>
      {status !== "loading" && (
        <CardContent>
          {status === "success" ? (
            <Button className="w-full" onClick={() => router.push("/login")}>
              Continue to sign in
            </Button>
          ) : (
            <Button variant="outline" className="w-full" asChild>
              <Link href="/login">Back to sign in</Link>
            </Button>
          )}
        </CardContent>
      )}
    </Card>
  );
}
