import { Sidebar } from "@/components/ui/sidebar";
import { HelpAssistant } from "@/components/ui/help-assistant";
import { prisma } from "@/lib/db/prisma";
import { getRoleLabel } from "@/lib/auth/roles";
import { requireUserSession } from "@/lib/auth/session";

import { logoutAction } from "../login/actions";

export default async function PrivateLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireUserSession();
  const currentUser = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { name: true },
  });
  const enabledModules = await prisma.organizationModule.findMany({
    where: {
      organizationId: session.activeOrgId,
      isEnabled: true,
    },
    select: {
      moduleKey: true,
    },
  });

  return (
    <div className="private-shell">
      <Sidebar
        enabledModules={enabledModules.map((module) => module.moduleKey)}
        logoutAction={logoutAction}
        sessionName={currentUser?.name ?? session.email}
      />

      <main className="private-main">
        <div className="private-content">{children}</div>
        <HelpAssistant roleLabel={getRoleLabel(session.role)} />
      </main>
    </div>
  );
}
