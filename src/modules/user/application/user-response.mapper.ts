import { UserEntity } from '../domain/entities/user.entity';

/** Expects the `identity` relation loaded. */
export function toUserResponse(user: UserEntity) {
  return {
    id: user.id,
    name: user.identity.name,
    email: user.identity.email,
    image: user.identity.image,
    role: user.role,
    createdAt: user.createdAt,
  };
}
