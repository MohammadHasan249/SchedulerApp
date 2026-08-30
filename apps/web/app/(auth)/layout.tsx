import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-background">
      {/* Left brand panel */}
      <div className="relative hidden lg:flex lg:w-[420px] shrink-0 flex-col items-center justify-center overflow-hidden bg-sidebar px-12 gap-8">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-1/3 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-primary/30 via-chart-2/20 to-chart-3/10 blur-3xl" />
        </div>

        <div className="flex flex-col items-center text-center gap-4">
          <Link href="/" className="text-2xl font-bold tracking-tight text-sidebar-foreground">
            Workplix
          </Link>
          <p className="text-sm text-sidebar-foreground/50 max-w-xs">
            Workforce scheduling made simple. Manage shifts, time-off, and your whole team in one place.
          </p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          {["Drag-and-drop schedule builder", "Real-time notifications", "Shift swap management", "PIN clock-in kiosk"].map((f) => (
            <div key={f} className="flex items-center gap-2.5 text-sm text-sidebar-foreground/60">
              <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
              {f}
            </div>
          ))}
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
