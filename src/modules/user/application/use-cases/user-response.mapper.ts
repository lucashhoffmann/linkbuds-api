import { UserEntity } from '../../domain/entities/user.entity';

export function toUserResponse(user: UserEntity) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    company: user.company
      ? {
          id: user.company.id,
          name: user.company.name,
          email: user.company.email,
        }
      : undefined,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    deletedAt: user.deletedAt,
  };
}
