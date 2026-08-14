import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'parameters' })
export class ParameterEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('IDX_parameters_feature', { unique: true })
  @Column({ name: 'feature', type: 'varchar', length: 100, nullable: false })
  feature!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: false })
  isActive!: boolean;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt!: Date | null;

  @Column({
    name: 'accounts_uuids',
    type: 'json',
    nullable: true,
    default: null,
  })
  accountsUuids!: string[] | null;

  @Column({ name: 'payload', type: 'jsonb', nullable: true, default: null })
  payload!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt!: Date | null;
}
