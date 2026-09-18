export type ChannelIdentity = {
  id: string;
  organizationId: string;
  provider: string;
  externalId: string;
  displayName: string | null;
  lastInboundAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ChannelLinkCode = {
  id: string;
  organizationId: string;
  code: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
};
