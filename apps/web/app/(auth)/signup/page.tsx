"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, User } from "lucide-react";
import { BRAND } from "@/lib/brand";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

export default function SignupChoicePage() {
  return (
    <motion.div initial="hidden" animate="show" variants={container} className="space-y-6">
      <motion.div variants={fadeUp} className="text-center">
        <h1 className="text-2xl font-bold text-foreground">Join {BRAND.displayName}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Choose how you&apos;d like to get started
        </p>
      </motion.div>

      <div className={`grid grid-cols-1 gap-4 ${BRAND.lockedOrgSlug ? "" : "md:grid-cols-2"}`}>
        {/* Organization signup — disabled on locked-org brand variants */}
        {!BRAND.lockedOrgSlug && (
          <motion.div variants={fadeUp} whileHover={{ y: -4 }}>
            <Link href="/signup/org">
              <Card className="group h-full cursor-pointer transition-shadow hover:shadow-lg hover:shadow-primary/10">
                <CardHeader>
                  <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-2 group-hover:bg-primary/20 transition-colors">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <CardTitle>Create Organization</CardTitle>
                  <CardDescription>Set up your company and start scheduling</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    You&apos;ll create an organization account and become an admin
                  </p>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        )}

        {/* Employee signup */}
        <motion.div variants={fadeUp} whileHover={{ y: -4 }}>
          <Link href="/signup/employee">
            <Card className="group h-full cursor-pointer transition-shadow hover:shadow-lg hover:shadow-primary/10">
              <CardHeader>
                <div className="h-10 w-10 rounded-lg bg-chart-2/10 text-chart-2 flex items-center justify-center mb-2 group-hover:bg-chart-2/20 transition-colors">
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
        </motion.div>
      </div>

      <motion.p variants={fadeUp} className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="underline underline-offset-4 hover:text-primary">
          Sign in
        </Link>
      </motion.p>
    </motion.div>
  );
}
