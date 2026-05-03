import { getUser } from "@/lib/auth/getUser";

export default async function OrganizationSettingsPage() {
  const user = await getUser();

  if (user.role !== "org_admin") {
    return (
      <div>
        <h1 className="text-2xl font-semibold">Organization Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Only organization admins can access this page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Organization Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Customize your organization's appearance and branding.
        </p>
      </div>
      <p className="text-sm text-muted-foreground">Theme customization coming soon.</p>
    </div>
  );
}
