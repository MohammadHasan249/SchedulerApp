"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, User } from "lucide-react";

export default function SignupChoicePage() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Join Scheduler</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Choose how you'd like to get started
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Organization signup */}
        <Link href="/signup/org">
          <Card className="group hover:border-primary/50 hover:shadow-md transition-all cursor-pointer h-full">
            <CardHeader>
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-2 group-hover:bg-primary/20 transition-colors">
                <Building2 className="h-5 w-5" />
              </div>
              <CardTitle>Create Organization</CardTitle>
              <CardDescription>Set up your company and start scheduling</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                You'll create an organization account and become an admin
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* Employee signup */}
        <Link href="/signup/employee">
          <Card className="group hover:border-primary/50 hover:shadow-md transition-all cursor-pointer h-full">
            <CardHeader>
              <div className="h-10 w-10 rounded-lg bg-violet-500/10 text-violet-600 flex items-center justify-center mb-2 group-hover:bg-violet-500/20 transition-colors">
                <User className="h-5 w-5" />
              </div>
              <CardTitle>Join as Employee</CardTitle>
              <CardDescription>You were invited to join an organization</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Sign up with your email to access your schedule
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="underline underline-offset-4 hover:text-primary">
          Sign in
        </Link>
      </p>
    </div>
  );
}
