export interface AdministrationResult {
  success?: string;
  error?: string;
  invitationPath?: string;
}

export interface StaffInvitation {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: "pending" | "accepted" | "revoked";
  created_at: string;
  expires_at: string;
}
