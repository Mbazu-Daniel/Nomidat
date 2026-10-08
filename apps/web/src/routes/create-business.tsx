import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CreateBusiness } from "@/components/workspace/create-business";
import { rememberActiveOrg, resolveOrgSlug } from "@/lib/active-org";

export const Route = createFileRoute("/create-business")({
  component: CreateBusinessPage,
});

function CreateBusinessPage() {
  const navigate = useNavigate();
  return (
    <main className="workspace-main">
      <CreateBusiness
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
