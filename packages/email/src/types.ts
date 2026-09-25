export type EmailAddress = {
  address: string;
  name?: string;
};

export type SendEmailInput = {
  to: EmailAddress | EmailAddress[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: EmailAddress;
  attachments?: Array<{ name: string; mimeType: string; content: string }>;
};

export type EmailClientConfig = {
  token: string;
  /** ZeptoMail API host, e.g. `api.zeptomail.com/` */
  url?: string;
  from: EmailAddress;
};

export type OrganizationInvitationEmailInput = {
  email: string;
  invitedByUsername: string;
  invitedByEmail: string;
  organizationName: string;
  inviteLink: string;
};
