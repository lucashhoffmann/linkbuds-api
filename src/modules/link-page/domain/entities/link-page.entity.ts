import { CompanyEntity } from 'src/modules/company/domain/entities/company.entity';
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
import { LinkPageStatus } from '../enums/link-page-status.enum';
import { LinkPageType } from '../enums/link-page-type.enum';

@Entity({ name: 'link_pages' })
export class LinkPageEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'company_id', type: 'uuid', nullable: false })
  companyId!: string;

  @ManyToOne(() => CompanyEntity, (company) => company.linkPages, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'company_id' })
  company!: CompanyEntity;

  @Column({ name: 'name', length: 120, nullable: false })
  name!: string;

  @Column({ name: 'slug', length: 160, nullable: false })
  slug!: string;

  @Column({ name: 'type', type: 'varchar', length: 20, nullable: false })
  type!: LinkPageType;

  @Column({ name: 'status', type: 'varchar', length: 20, nullable: false })
  status!: LinkPageStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt!: Date | null;
}
