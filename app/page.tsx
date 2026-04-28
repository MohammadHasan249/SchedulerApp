import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Users,
  Clock,
  ArrowRight,
  CheckCircle2,
  Zap,
  BarChart3,
  Shield,
} from "lucide-react";

export default function LandingPage() {
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
    { label: "Shifts Managed", value: "10000+" },
    { label: "Team Members", value: "5000+" },
    { label: "Active Users", value: "500+" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
      {/* Navigation */}
      <nav className="border-b border-slate-700/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">Scheduler App</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" className="text-slate-300 hover:text-white">
                Log in
              </Button>
            </Link>
            <Link href="/signup/org">
              <Button className="bg-primary hover:bg-primary/90">
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32">
        <div className="text-center space-y-8">
          <div className="space-y-4">
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white">
              Workforce Scheduling
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/60">
                Made Simple
              </span>
            </h1>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              Streamline your team scheduling with intelligent shift management, real-time analytics,
              and automated employee assignments.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup/org">
              <Button size="lg" className="bg-primary hover:bg-primary/90 text-base h-12">
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="text-base h-12 border-slate-600 hover:bg-slate-800">
                Sign In
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 mt-16 pt-16 border-t border-slate-700/50">
            {stats.map((stat) => (
              <div key={stat.label} className="space-y-2">
                <div className="text-3xl font-bold text-primary">{stat.value}</div>
                <div className="text-sm text-slate-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="border-t border-slate-700/50 py-20 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">Powerful Features</h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Everything you need to manage your workforce efficiently
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="p-8 rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-800/50 to-slate-900/50 hover:border-primary/50 transition-all hover:shadow-lg hover:shadow-primary/10"
                >
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="border-t border-slate-700/50 py-20 sm:py-32 bg-gradient-to-r from-primary/5 to-transparent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <h2 className="text-4xl font-bold text-white">Why Choose Scheduler App?</h2>
              <ul className="space-y-4">
                {[
                  "Reduce scheduling time by 80%",
                  "Minimize labor costs with optimized assignments",
                  "Improve employee satisfaction with transparent schedules",
                  "Real-time visibility across all branches",
                  "Mobile-friendly interface for on-the-go management",
                  "Scalable for businesses of any size",
                ].map((benefit) => (
                  <li key={benefit} className="flex items-start gap-3">
                    <CheckCircle2 className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-lg text-slate-300">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-slate-700/50 p-8 h-96 flex items-center justify-center">
              <div className="text-center space-y-4">
                <Calendar className="h-16 w-16 text-primary/40 mx-auto" />
                <p className="text-slate-400">Beautiful, intuitive dashboard</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t border-slate-700/50 py-20 sm:py-32">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
          <h2 className="text-4xl sm:text-5xl font-bold text-white">
            Ready to transform your scheduling?
          </h2>
          <p className="text-xl text-slate-400">
            Join hundreds of teams already using Scheduler App to manage their workforce.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup/org">
              <Button size="lg" className="bg-primary hover:bg-primary/90 text-base h-12">
                Start Your Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="text-base h-12 border-slate-600 hover:bg-slate-800">
                Sign In to Your Account
              </Button>
            </Link>
          </div>
          <p className="text-sm text-slate-500">No credit card required. Setup takes 5 minutes.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-700/50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-white" />
              </div>
              <span className="font-semibold text-white">Scheduler App</span>
            </div>
            <p className="text-sm text-slate-500">© 2024 Scheduler App. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
