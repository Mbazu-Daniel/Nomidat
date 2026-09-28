import { createFileRoute } from "@tanstack/react-router";
import { AcceptInvitation } from "@/components/workspace/accept-invitation";
export const Route = createFileRoute("/accept-invitation/$invitationId")({
  component: InvitationPage,
});
function InvitationPage() {
  const { invitationId } = Route.useParams();
  return <AcceptInvitation invitationId={invitationId} />;
}
