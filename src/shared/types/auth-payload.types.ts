import type { UserRole } from 'src/modules/user/domain/enums/user-role.enum';

export interface AuthPayload {
  id: string;
  companyId: string;
  role: UserRole;
}
