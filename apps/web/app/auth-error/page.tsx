import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function AuthErrorPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-4 overflow-hidden bg-background px-4 text-center">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-1/3 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-primary/20 via-chart-2/15 to-chart-3/10 blur-3xl" />
      </div>
      <h1 className="text-2xl font-semibold text-foreground">Authentication error</h1>
      <p className="text-muted-foreground">Something went wrong during sign-in. Please try again.</p>
      <Link href="/login" className={buttonVariants()}>
        Back to login
      </Link>
    </div>
  );
}
