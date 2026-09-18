import type { EmailClient } from "./client";
import type { OrganizationInvitationEmailInput } from "./types";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function sendOrganizationInvitationEmail(
  email: EmailClient,
  input: OrganizationInvitationEmailInput,
): Promise<void> {
  const org = escapeHtml(input.organizationName);
  const inviterName = escapeHtml(input.invitedByUsername);
  const inviterEmail = escapeHtml(input.invitedByEmail);
  const link = escapeHtml(input.inviteLink);

  const text = [
    `${inviterName} (${input.invitedByEmail}) invited you to join ${input.organizationName} on Nomidat.`,
    "",
    `Accept the invitation: ${input.inviteLink}`,
  ].join("\n");

  const html = `
    <div style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
      <p><strong>${inviterName}</strong> (${inviterEmail}) invited you to join <strong>${org}</strong> on Nomidat.</p>
      <p><a href="${link}">Accept invitation</a></p>
      <p style="color:#555;font-size:12px;">If the button does not work, open this URL:<br/>${link}</p>
    </div>
  `.trim();

  await email.send({
    to: { address: input.email },
    subject: `You're invited to join ${input.organizationName}`,
    html,
    text,
    replyTo: {
      address: input.invitedByEmail,
      name: input.invitedByUsername,
    },
  });
}
