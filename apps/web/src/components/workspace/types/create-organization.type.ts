export type CreateOrganizationProps = {
  onCreated: (organization: { id: string; name: string; slug?: string }) => void;
  onCancel?: () => void;
};
