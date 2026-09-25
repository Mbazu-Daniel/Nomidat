export type CreateBusinessProps = {
  onCreated: (business: { id: string; name: string }) => void;
  onCancel?: () => void;
};
