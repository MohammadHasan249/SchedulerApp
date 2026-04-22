import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold">Authentication error</h1>
      <p className="text-muted-foreground">Something went wrong during sign-in. Please try again.</p>
      <Link href="/login" className={buttonVariants()}>
        Back to login
      </Link>
    </div>
  );
}
