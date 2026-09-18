import type { EmailAddress, EmailClientConfig, SendEmailInput } from "./types";

function normalizeToken(token: string): string {
  const trimmed = token.trim();
  if (trimmed.toLowerCase().startsWith("zoho-enczapikey")) {
    return trimmed;
  }
  return `Zoho-enczapikey ${trimmed}`;
}

function toRecipient(address: EmailAddress) {
  return {
    email_address: {
      address: address.address,
      ...(address.name ? { name: address.name } : {}),
    },
  };
}

export type EmailClient = {
  send: (input: SendEmailInput) => Promise<unknown>;
};

export async function createEmailClient(config: EmailClientConfig): Promise<EmailClient> {
  const { SendMailClient: Client } = await import("zeptomail");
  const client = new Client({
    url: config.url ?? "api.zeptomail.com/",
    token: normalizeToken(config.token),
  });

  return {
    async send(input) {
      const recipients = Array.isArray(input.to) ? input.to : [input.to];

      return client.sendMail({
        from: {
          address: config.from.address,
          ...(config.from.name ? { name: config.from.name } : {}),
        },
        to: recipients.map(toRecipient),
        ...(input.replyTo
          ? {
              reply_to: [
                {
                  address: input.replyTo.address,
                  ...(input.replyTo.name ? { name: input.replyTo.name } : {}),
                },
              ],
            }
          : {}),
        subject: input.subject,
        htmlbody: input.html,
        ...(input.text ? { textbody: input.text } : {}),
      });
    },
  };
}
