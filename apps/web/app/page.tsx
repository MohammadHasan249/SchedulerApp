"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
  ListPlus,
  Wand2,
  BellRing,
  CreditCard,
  Wallet,
  CalendarClock,
  MessageSquare,
} from "lucide-react";

const MotionButton = motion.create(Button);

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
  { label: "Shifts Managed", value: "1,000+" },
  { label: "Team Members", value: "300+" },
  { label: "Active Users", value: "200+" },
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

const howItWorks = [
  {
    step: "01",
    icon: ListPlus,
    title: "Set up your team",
    description: "Add branches, job roles, and employee availability in a few minutes.",
  },
  {
    step: "02",
    icon: Wand2,
    title: "Build the schedule",
    description: "Drag and drop shifts, or let auto-assignment fill them based on availability.",
  },
  {
    step: "03",
    icon: BellRing,
    title: "Team stays in sync",
    description: "Everyone gets notified instantly and can swap shifts or request time off.",
  },
];

const integrations = [
  { icon: CreditCard, title: "POS Systems", description: "Sync shifts with point-of-sale hours" },
  { icon: Wallet, title: "Payroll", description: "Export approved hours for payroll runs" },
  { icon: CalendarClock, title: "Calendar Sync", description: "Push schedules to Google & Outlook" },
  { icon: MessageSquare, title: "Team Chat", description: "Send shift alerts to Slack & Teams" },
];

const faqs = [
  {
    question: "How long does it take to get set up?",
    answer:
      "Most teams are up and running in under 5 minutes. Create your organization, add your branches and job roles, invite your team, and you're ready to build your first schedule.",
  },
  {
    question: "Can employees check their schedules from their phones?",
    answer:
      "Yes. Employees can view their schedule, request time off, and swap shifts from the mobile app.",
  },
  {
    question: "How does clocking in and out work?",
    answer:
      "Clocking in and out happens at a PIN-based kiosk that an admin sets up on-site, keeping time tracking tied to the actual location.",
  },
  {
    question: "Does Workplix support multiple branches or locations?",
    answer:
      "Yes. You can manage multiple branches under one organization, each with its own schedules, job roles, and staff, while still getting a unified view across all locations.",
  },
  {
    question: "Is there a free plan?",
    answer:
      "Yes — Workplix is free to get started for small teams, with plans that scale as your team and number of branches grow.",
  },
  {
    question: "Can I import my existing schedules and employees?",
    answer:
      "Yes. Our team can help you migrate existing employee lists and recurring schedules when you get started — just reach out after signing up.",
  },
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
              <MotionButton
                variant="ghost"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
              >
                Log in
              </MotionButton>
            </Link>
            <Link href="/signup">
              <MotionButton
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                className="group"
              >
                Get Started
                <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </MotionButton>
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
                <MotionButton
                  size="lg"
                  className="group h-12 px-6 text-base"
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                >
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-0.5" />
                </MotionButton>
              </Link>
              <Link href="/login">
                <MotionButton
                  size="lg"
                  variant="outline"
                  className="h-12 px-6 text-base"
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                >
                  Sign In
                </MotionButton>
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

      {/* How It Works Section */}
      <section id="how-it-works" className="border-t border-border py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.3 }}
            variants={container()}
            className="mx-auto mb-16 max-w-2xl text-center"
          >
            <motion.h2 variants={fadeUp} className="text-4xl font-bold text-foreground sm:text-5xl">
              How it works
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-4 text-lg text-muted-foreground">
              From setup to a fully staffed schedule in three steps
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            variants={container(0.12)}
            className="grid gap-6 md:grid-cols-3"
          >
            {howItWorks.map((item) => {
              const Icon = item.icon;
              return (
                <motion.div key={item.step} variants={fadeUp} whileHover={{ y: -4 }}>
                  <Card className="h-full border border-border p-8 text-center shadow-sm transition-shadow hover:shadow-lg hover:shadow-primary/5">
                    <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/20">
                      <Icon className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <div className="mb-1 text-xs font-semibold tracking-wide text-primary">
                      STEP {item.step}
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-foreground">{item.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {item.description}
                    </p>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="border-t border-border py-24 sm:py-32">
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

      {/* Integrations Section */}
      <section id="integrations" className="border-t border-border py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.3 }}
            variants={container()}
            className="mx-auto mb-16 max-w-2xl text-center"
          >
            <motion.h2 variants={fadeUp} className="text-4xl font-bold text-foreground sm:text-5xl">
              Fits into your stack
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-4 text-lg text-muted-foreground">
              Workplix connects with the tools you already use to run your business
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.15 }}
            variants={container(0.08)}
            className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
          >
            {integrations.map((item) => {
              const Icon = item.icon;
              return (
                <motion.div key={item.title} variants={fadeUp} whileHover={{ y: -4 }}>
                  <Card className="h-full items-center border border-border p-6 text-center shadow-sm transition-shadow hover:shadow-lg hover:shadow-primary/5">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="mb-1 text-sm font-semibold text-foreground">{item.title}</h3>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {item.description}
                    </p>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="border-t border-border py-24 sm:py-32">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.3 }}
            variants={container()}
            className="mx-auto mb-12 max-w-2xl text-center"
          >
            <motion.h2 variants={fadeUp} className="text-4xl font-bold text-foreground sm:text-5xl">
              Frequently asked questions
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-4 text-lg text-muted-foreground">
              Everything you need to know before getting started
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            variants={fadeUp}
          >
            <Card className="border border-border px-6 py-2 shadow-sm">
              <Accordion>
                {faqs.map((faq) => (
                  <AccordionItem key={faq.question} value={faq.question}>
                    <AccordionTrigger>{faq.question}</AccordionTrigger>
                    <AccordionContent>{faq.answer}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </Card>
          </motion.div>
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
              Set up your first schedule in minutes — no credit card required.
            </motion.p>
            <motion.div
              variants={fadeUp}
              className="mt-8 flex flex-col justify-center gap-4 sm:flex-row"
            >
              <Link href="/signup">
                <MotionButton
                  size="lg"
                  className="group h-12 bg-background px-6 text-base text-foreground hover:bg-background/90"
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                >
                  Start Your Free Trial
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-0.5" />
                </MotionButton>
              </Link>
              <Link href="/login">
                <MotionButton
                  size="lg"
                  variant="outline"
                  className="h-12 border-primary-foreground/40 bg-transparent px-6 text-base text-primary-foreground hover:bg-primary-foreground/10"
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                >
                  Sign In to Your Account
                </MotionButton>
              </Link>
            </motion.div>
            <motion.p variants={fadeUp} className="mt-6 text-sm text-primary-foreground/70">
              No credit card required. Setup takes 5 minutes.
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <span className="text-lg font-semibold text-foreground">Workplix</span>
              <p className="mt-3 max-w-xs text-sm text-muted-foreground">
                Workforce scheduling made simple. Manage shifts, time-off, and your whole team in
                one place.
              </p>
            </div>

            <div>
              <h4 className="mb-3 text-sm font-semibold text-foreground">Product</h4>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li>
                  <Link href="#features" className="hover:text-primary">
                    Features
                  </Link>
                </li>
                <li>
                  <Link href="#how-it-works" className="hover:text-primary">
                    How it works
                  </Link>
                </li>
                <li>
                  <Link href="#integrations" className="hover:text-primary">
                    Integrations
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="mb-3 text-sm font-semibold text-foreground">Company</h4>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li>
                  <Link href="#faq" className="hover:text-primary">
                    FAQ
                  </Link>
                </li>
                <li>
                  <a href="mailto:contact@workplix.app" className="hover:text-primary">
                    Contact
                  </a>
                </li>
                <li>
                  <Link href="/signup" className="hover:text-primary">
                    Get Started
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="mb-3 text-sm font-semibold text-foreground">Legal</h4>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li className="cursor-default">Privacy Policy</li>
                <li className="cursor-default">Terms of Service</li>
              </ul>
            </div>
          </div>

          <div className="mt-12 border-t border-border pt-8 text-center">
            <p className="text-sm text-muted-foreground">© 2026 Workplix. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
