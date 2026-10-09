import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CreateOrganization } from "@/components/workspace/create-organization";
import { rememberActiveOrg, resolveOrgSlug } from "@/lib/active-org";

export const Route = createFileRoute("/create-organization")({
  component: CreateBusinessPage,
});

function CreateBusinessPage() {
  const navigate = useNavigate();
  return (
    <main className="workspace-main">
      <CreateOrganization
        onCancel={() => void navigate({ to: "/" })}
        onCreated={async (business) => {
          rememberActiveOrg(business.id);
          const slug = business.slug ?? (await resolveOrgSlug(business.id));
          if (slug) void navigate({ to: "/$orgSlug", params: { orgSlug: slug } });
          else void navigate({ to: "/" });
        }}
      />
    </main>
  );
}
