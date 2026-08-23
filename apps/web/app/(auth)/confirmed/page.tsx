"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ConfirmedPage() {
  return (
    <Suspense>
      <ConfirmedCard />
    </Suspense>
  );
}

function ConfirmedCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    const code = searchParams.get("code");
    const supabase = createClient();

    if (code) {
      // PKCE flow: an explicit code to exchange for a session.
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        setStatus(error ? "error" : "success");
      });
      return;
    }

    // Implicit flow: Supabase puts tokens in the URL hash fragment instead of
    // a `code` query param. The client SDK auto-detects and consumes that
    // hash on load (detectSessionInUrl), establishing a session before this
    // effect runs — just check whether that already succeeded.
    supabase.auth.getSession().then(({ data }) => {
      setStatus(data.session ? "success" : "error");
    });
  }, [searchParams]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="shadow-lg shadow-primary/5">
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
              <Link href="/login">
                <Button variant="outline" className="w-full">
                  Back to sign in
                </Button>
              </Link>
            )}
          </CardContent>
        )}
      </Card>
    </motion.div>
  );
}
