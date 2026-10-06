import { LinkPageEntity } from 'src/modules/link-page/domain/entities/link-page.entity';
import { CompanyConditionEntity } from 'src/modules/plan/domain/entities/company-condition.entity';
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

  /** Billing/contact email; starts as the owner's email. */
  @Column({ name: 'email', nullable: false })
  email!: string;

  @Column({ name: 'plan_id', type: 'uuid' })
  planId!: string;

  @ManyToOne(() => PlanEntity)
  @JoinColumn({ name: 'plan_id' })
  plan!: PlanEntity;

  @OneToMany(() => CompanyConditionEntity, (condition) => condition.company)
  conditions!: CompanyConditionEntity[];

  @OneToMany(() => UserEntity, (user) => user.company)
  users!: UserEntity[];

  @OneToMany(() => LinkPageEntity, (linkPage) => linkPage.company)
  linkPages!: LinkPageEntity[];

  @OneToMany(() => CompanyDomainEntity, (domain) => domain.company)
  domains!: CompanyDomainEntity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt!: Date | null;
}
