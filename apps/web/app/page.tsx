"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Calendar,
  Users,
  Clock,
  ArrowRight,
  CheckCircle2,
  Zap,
  BarChart3,
  Shield,
  Sparkles,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0 },
};

const container = (stagger = 0.08) => ({
  hidden: {},
  show: {
    transition: { staggerChildren: stagger },
  },
});

const features = [
  {
    icon: Calendar,
    title: "Smart Scheduling",
    description:
      "Create and manage shift schedules effortlessly with drag-and-drop flexibility and automatic assignments.",
  },
  {
    icon: Users,
    title: "Team Management",
    description:
      "Organize employees by branches and job roles, manage availability windows, and track performance.",
  },
  {
    icon: Clock,
    title: "Time Off & Requests",
    description:
      "Handle vacation requests, sick leave, and shift swaps with streamlined approval workflows.",
  },
  {
    icon: Zap,
    title: "Auto-Assignment",
    description:
      "Let the system intelligently assign shifts based on availability, qualifications, and workload.",
  },
  {
    icon: BarChart3,
    title: "Real-time Reports",
    description:
      "Track attendance, hours worked, and workforce metrics with comprehensive analytics dashboards.",
  },
  {
    icon: Shield,
    title: "Multi-tenant",
    description:
      "Support multiple organizations and branches with complete data isolation and role-based access.",
  },
];

const stats = [
  { label: "Shifts Managed", value: "10,000+" },
  { label: "Team Members", value: "5,000+" },
  { label: "Active Users", value: "500+" },
];

const benefits = [
  "Reduce scheduling time by 80%",
  "Minimize labor costs with optimized assignments",
  "Improve employee satisfaction with transparent schedules",
  "Real-time visibility across all branches",
  "Mobile-friendly interface for on-the-go management",
  "Scalable for businesses of any size",
];

const mockShifts = [
  { day: "Mon", name: "Sarah K.", time: "9AM–5PM", color: "bg-chart-1" },
  { day: "Tue", name: "James O.", time: "8AM–4PM", color: "bg-chart-2" },
  { day: "Wed", name: "Priya R.", time: "12PM–8PM", color: "bg-chart-3" },
  { day: "Thu", name: "Sarah K.", time: "9AM–5PM", color: "bg-chart-1" },
  { day: "Fri", name: "James O.", time: "10AM–6PM", color: "bg-chart-4" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <motion.nav
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md"
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <span className="text-xl font-bold tracking-tight text-foreground">Workplix</span>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost">Log in</Button>
            </Link>
            <Link href="/signup">
              <Button>
                Get Started
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-[-10rem] h-[36rem] w-[56rem] -translate-x-1/2 rounded-full bg-gradient-to-br from-primary/25 via-chart-2/20 to-chart-3/10 blur-3xl" />
        </div>

        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
          <motion.div
            initial="hidden"
            animate="show"
            variants={container()}
            className="mx-auto max-w-3xl text-center"
          >
            <motion.div
              variants={fadeUp}
              transition={{ duration: 0.5 }}
              className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm"
            >
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Built for fast-moving teams
            </motion.div>

            <motion.h1
              variants={fadeUp}
              transition={{ duration: 0.5 }}
              className="text-5xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl"
            >
              Workforce scheduling
              <span className="block bg-gradient-to-r from-primary via-chart-2 to-chart-1 bg-clip-text text-transparent">
                made simple
              </span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              transition={{ duration: 0.5 }}
              className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl"
            >
              Streamline your team scheduling with intelligent shift management, real-time
              analytics, and automated employee assignments.
            </motion.p>

            <motion.div
              variants={fadeUp}
              transition={{ duration: 0.5 }}
              className="mt-10 flex flex-col justify-center gap-4 sm:flex-row"
            >
              <Link href="/signup">
                <Button size="lg" className="h-12 px-6 text-base">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline" className="h-12 px-6 text-base">
                  Sign In
                </Button>
              </Link>
            </motion.div>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.4 }}
            variants={container(0.1)}
            className="mx-auto mt-20 grid max-w-2xl grid-cols-3 gap-8 border-t border-border pt-12"
          >
            {stats.map((stat) => (
              <motion.div key={stat.label} variants={fadeUp} className="text-center">
                <div className="text-3xl font-bold text-foreground sm:text-4xl">{stat.value}</div>
                <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="border-t border-border py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.3 }}
            variants={container()}
            className="mx-auto mb-16 max-w-2xl text-center"
          >
            <motion.h2 variants={fadeUp} className="text-4xl font-bold text-foreground sm:text-5xl">
              Powerful features
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-4 text-lg text-muted-foreground">
              Everything you need to manage your workforce efficiently
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.15 }}
            variants={container(0.07)}
            className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
          >
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <motion.div key={feature.title} variants={fadeUp} whileHover={{ y: -4 }}>
                  <Card className="h-full border border-border p-8 shadow-sm transition-shadow hover:shadow-lg hover:shadow-primary/5">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-foreground">{feature.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {feature.description}
                    </p>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="border-t border-border bg-muted/40 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 md:grid-cols-2">
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.3 }}
              variants={container(0.06)}
              className="space-y-8"
            >
              <motion.h2 variants={fadeUp} className="text-4xl font-bold text-foreground">
                Why choose Workplix?
              </motion.h2>
              <ul className="space-y-4">
                {benefits.map((benefit) => (
                  <motion.li key={benefit} variants={fadeUp} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-6 w-6 flex-shrink-0 text-primary" />
                    <span className="text-lg text-foreground/90">{benefit}</span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5 }}
            >
              <Card className="border border-border p-6 shadow-xl shadow-primary/5">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">This Week</span>
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                    Auto-assigned
                  </span>
                </div>
                <div className="space-y-2">
                  {mockShifts.map((shift) => (
                    <div
                      key={shift.day}
                      className="flex items-center gap-3 rounded-lg border border-border bg-background p-3"
                    >
                      <span className="w-9 text-xs font-semibold text-muted-foreground">
                        {shift.day}
                      </span>
                      <span className={`h-8 w-1.5 rounded-full ${shift.color}`} />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-foreground">{shift.name}</div>
                        <div className="text-xs text-muted-foreground">{shift.time}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t border-border py-24 sm:py-32">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.4 }}
            variants={container(0.08)}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-chart-2 px-8 py-16 text-center sm:px-16"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.18),transparent_60%)]" />
            <motion.h2
              variants={fadeUp}
              className="text-4xl font-bold text-primary-foreground sm:text-5xl"
            >
              Ready to transform your scheduling?
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="mx-auto mt-4 max-w-xl text-lg text-primary-foreground/80"
            >
              Join hundreds of teams already using Workplix to manage their workforce.
            </motion.p>
            <motion.div
              variants={fadeUp}
              className="mt-8 flex flex-col justify-center gap-4 sm:flex-row"
            >
              <Link href="/signup">
                <Button
                  size="lg"
                  className="h-12 bg-background px-6 text-base text-foreground hover:bg-background/90"
                >
                  Start Your Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/login">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 border-primary-foreground/40 bg-transparent px-6 text-base text-primary-foreground hover:bg-primary-foreground/10"
                >
                  Sign In to Your Account
                </Button>
              </Link>
            </motion.div>
            <motion.p variants={fadeUp} className="mt-6 text-sm text-primary-foreground/70">
              No credit card required. Setup takes 5 minutes.
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <span className="font-semibold text-foreground">Workplix</span>
          <p className="text-sm text-muted-foreground">© 2026 Workplix. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
