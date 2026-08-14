import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CompanyDomainStatus } from '../enums/company-domain-status.enum';
import { CompanyEntity } from './company.entity';

@Entity({ name: 'company_domains' })
export class CompanyDomainEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'company_id', type: 'uuid', nullable: false })
  companyId!: string;

  @ManyToOne(() => CompanyEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company!: CompanyEntity;

  @Column({ name: 'hostname', length: 253, nullable: false })
  hostname!: string;

  @Column({ name: 'status', type: 'varchar', length: 20, nullable: false })
  status!: CompanyDomainStatus;

  @Column({ name: 'verification_token', length: 160, nullable: false })
  verificationToken!: string;

  @Column({ name: 'verified_at', type: 'timestamp', nullable: true })
  verifiedAt!: Date | null;

  @Column({ name: 'last_checked_at', type: 'timestamp', nullable: true })
  lastCheckedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt!: Date | null;
}
