export type CreateBusinessProps = {
  onCreated: (business: { id: string; name: string; slug?: string }) => void;
  onCancel?: () => void;
};
