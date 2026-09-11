export interface GroupItem {
  id: string;
  groupName: string;
  assignedAdmin: string;
  members: string[];
  membersCount: number;
  status: 'ACTIVE' | 'INACTIVE' | 'RESTRICTED' | 'SUSPENDED' | 'DISABLED' | 'PENDING';
  createdDate?: string;
  isDisabled?: boolean;
  isDeactivated?: boolean;
}
