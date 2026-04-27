import { CalendarDays } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-background">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-[420px] shrink-0 flex-col items-center justify-center bg-sidebar px-12 gap-8">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/40">
            <CalendarDays className="h-8 w-8 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-sidebar-foreground tracking-tight">Scheduler</h1>
            <p className="text-sm text-sidebar-foreground/50 mt-1 max-w-xs">
              Workforce scheduling made simple. Manage shifts, time-off, and your whole team in one place.
            </p>
          </div>
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
