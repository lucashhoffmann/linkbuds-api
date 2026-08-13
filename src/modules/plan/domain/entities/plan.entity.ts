import { CompanyEntity } from 'src/modules/company/domain/entities/company.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PlanType } from '../enums/plan-type.enum';

@Entity({ name: 'plans' })
export class PlanEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'name', length: 120, nullable: false })
  name!: string;

  @Column({ name: 'code', length: 80, nullable: false, unique: true })
  code!: string;

  @Column({ name: 'type', type: 'varchar', length: 20, nullable: false })
  type!: PlanType;

  @Column({ name: 'max_client_pages', type: 'integer', nullable: false })
  maxClientPages!: number;

  @Column({ name: 'price_cents', type: 'integer', nullable: false })
  priceCents!: number;

  @Column({ name: 'company_id', type: 'uuid', nullable: true })
  companyId!: string | null;

  @ManyToOne(() => CompanyEntity, (company) => company.customPlans, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'company_id' })
  company!: CompanyEntity | null;

  @OneToMany(() => CompanyEntity, (company) => company.plan)
  companiesUsingPlan!: CompanyEntity[];

  @Column({ name: 'active', type: 'boolean', default: true })
  active!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
