export type StaffMember = {
  id: string;
  userId: string;
  role: string;
  user: { name: string; email: string; phoneNumber?: string | null };
};
export type StaffInvitation = {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  organizationName?: string;
};
export type StaffAccess = { userId: string; role: string };
export type StaffMemberRowProps = {
  member: StaffMember;
  access: StaffAccess;
  busy: boolean;
  onChange: (id: string, role: string) => void;
  onRemove: (id: string) => void;
};
export type StaffPermissionsProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};
export type PhoneInvitation = {
  id: string;
  phoneNumber: string;
  role: string;
  organizationName?: string;
  expiresAt: string;
};
