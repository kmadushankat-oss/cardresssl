import type { Metadata } from "next";

import { Sidebar } from "@/components/admin/sidebar";
import { UserMenu } from "@/components/admin/user-menu";
import { navForRole } from "@/lib/admin-nav";
import { ROLE_LABELS } from "@/lib/permissions";
import { requireStaff } from "@/lib/session";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s | Car Dress SL Admin" },
  robots: { index: false, follow: false },
};

/**
 * The guarded dashboard shell.
 *
 * Lives in a `(dashboard)` route group so that `/admin/sign-in` sits outside
 * it — otherwise the guard below would redirect a signed-out visitor to a page
 * that redirects them straight back.
 */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  // Guards the whole dashboard in one place. Individual pages still assert
  // their own permission — this only establishes that the visitor is staff.
  const user = await requireStaff();

  return (
    <div className="min-h-screen bg-surface">
      <Sidebar sections={navForRole(user.role)}>
        <UserMenu
          name={user.name}
          email={user.email}
          roleLabel={ROLE_LABELS[user.role]}
        />
      </Sidebar>

      <div className="lg:pl-64">
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
