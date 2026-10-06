import { CompanyEntity } from 'src/modules/company/domain/entities/company.entity';
import { UserRole } from 'src/modules/user/domain/enums/user-role.enum';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Invite link shared by the OWNER. Only the sha256 of the token is stored. */
@Entity({ name: 'company_invites' })
export class CompanyInviteEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'company_id', type: 'uuid' })
  companyId!: string;

  @ManyToOne(() => CompanyEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company!: CompanyEntity;

  @Column({ name: 'email' })
  email!: string;

  @Column({ name: 'role', type: 'varchar', length: 20 })
  role!: UserRole;

  @Column({ name: 'token_hash', length: 64 })
  tokenHash!: string;

  @Column({ name: 'invited_by', type: 'text', nullable: true })
  invitedBy!: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt!: Date | null;

  @Column({ name: 'accepted_by', type: 'text', nullable: true })
  acceptedBy!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
