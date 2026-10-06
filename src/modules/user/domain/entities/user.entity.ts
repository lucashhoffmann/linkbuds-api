import { AuthUserEntity } from 'src/modules/auth/domain/entities/auth-user.entity';
import { CompanyEntity } from 'src/modules/company/domain/entities/company.entity';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserRole } from '../enums/user-role.enum';

/**
 * Membership of a better-auth identity in a company. Same id as `user.id`;
 * name/email live only in the identity.
 */
@Entity({ name: 'users' })
export class UserEntity {
  @PrimaryColumn({ name: 'id', type: 'text' })
  id!: string;

  @OneToOne(() => AuthUserEntity)
  @JoinColumn({ name: 'id' })
  identity!: AuthUserEntity;

  @Column({ name: 'company_id', type: 'uuid' })
  companyId!: string;

  @ManyToOne(() => CompanyEntity, (company) => company.users, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'company_id' })
  company!: CompanyEntity;

  @Column({ name: 'role', type: 'varchar', length: 20 })
  role!: UserRole;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt!: Date | null;
}
