import { LinkPageEntity } from 'src/modules/link-page/domain/entities/link-page.entity';
import { PlanEntity } from 'src/modules/plan/domain/entities/plan.entity';
import { UserEntity } from 'src/modules/user/domain/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CompanyDomainEntity } from './company-domain.entity';

@Entity({ name: 'company' })
export class CompanyEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'name', length: 120, nullable: false })
  name!: string;

  @Column({ name: 'email', nullable: false, unique: true })
  email!: string;

  @Column({ name: 'plan_id', type: 'uuid', nullable: true })
  planId!: string | null;

  @ManyToOne(() => PlanEntity, (plan) => plan.companiesUsingPlan, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'plan_id' })
  plan!: PlanEntity | null;

  @OneToMany(() => UserEntity, (user) => user.company)
  users!: UserEntity[];

  @OneToMany(() => LinkPageEntity, (linkPage) => linkPage.company)
  linkPages!: LinkPageEntity[];

  @OneToMany(() => PlanEntity, (plan) => plan.company)
  customPlans!: PlanEntity[];

  @OneToMany(() => CompanyDomainEntity, (domain) => domain.company)
  domains!: CompanyDomainEntity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt!: Date | null;
}
