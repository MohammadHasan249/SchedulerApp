"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { slugify } from "@/lib/utils/slugify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

const schema = z.object({
  orgName: z.string().min(2, "Organization name must be at least 2 characters"),
  orgSlug: z
    .string()
    .min(2, "Slug must be at least 2 characters")
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only"),
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type FormData = z.infer<typeof schema>;

export default function OrgSignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const orgName = watch("orgName");

  useEffect(() => {
    if (orgName) {
      setValue("orgSlug", slugify(orgName), { shouldValidate: false });
    }
  }, [orgName, setValue]);

  async function onSubmit(data: FormData) {
    setLoading(true);

    const res = await fetch("/api/org", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const json = await res.json();

    if (!res.ok) {
      const msg =
        json.error?.fieldErrors?.orgSlug?.[0] ??
        json.error?.message ??
        json.error ??
        "Something went wrong";
      toast.error(msg);
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error) {
      toast.error("Account created but sign-in failed. Please log in manually.");
      router.push("/login");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your organization</CardTitle>
        <CardDescription>Get started with your workforce scheduling platform</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="orgName">Organization name</Label>
            <Input id="orgName" placeholder="Acme Restaurants" {...register("orgName")} />
            {errors.orgName && (
              <p className="text-sm text-destructive">{errors.orgName.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="orgSlug">
              URL slug{" "}
              <span className="text-muted-foreground font-normal text-xs">
                (yourapp.com/acme)
              </span>
            </Label>
            <Input id="orgSlug" placeholder="acme-restaurants" {...register("orgSlug")} />
            {errors.orgSlug && (
              <p className="text-sm text-destructive">{errors.orgSlug.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="fullName">Your full name</Label>
            <Input id="fullName" placeholder="Jane Smith" {...register("fullName")} />
            {errors.fullName && (
              <p className="text-sm text-destructive">{errors.fullName.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" {...register("email")} />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating account…" : "Create account"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="underline underline-offset-4 hover:text-primary">
              Sign in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
