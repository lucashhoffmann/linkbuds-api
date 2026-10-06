import { LinkPageEntity } from 'src/modules/link-page/domain/entities/link-page.entity';
import {
  LinkPageFooterMode,
  LinkPageFooterSize,
  LinkPageFooterStyle,
} from 'src/modules/link-page/domain/enums/link-page-footer-mode.enum';
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

  /** Default footer copied into new pages. */
  @Column({
    name: 'footer_mode',
    type: 'varchar',
    length: 20,
    nullable: false,
    default: LinkPageFooterMode.LINKBUDS,
  })
  footerMode!: LinkPageFooterMode;

  @Column({ name: 'footer_text', type: 'varchar', length: 160, nullable: true })
  footerText!: string | null;

  @Column({ name: 'footer_url', type: 'text', nullable: true })
  footerUrl!: string | null;

  @Column({ name: 'footer_logo_url', type: 'text', nullable: true })
  footerLogoUrl!: string | null;

  @Column({
    name: 'footer_style',
    type: 'varchar',
    length: 10,
    default: 'TEXT',
  })
  footerStyle!: LinkPageFooterStyle;

  @Column({
    name: 'footer_background_color',
    type: 'varchar',
    length: 7,
    nullable: true,
  })
  footerBackgroundColor!: string | null;

  @Column({
    name: 'footer_border_color',
    type: 'varchar',
    length: 7,
    nullable: true,
  })
  footerBorderColor!: string | null;

  @Column({ name: 'footer_color', type: 'varchar', length: 7, nullable: true })
  footerColor!: string | null;

  @Column({ name: 'footer_bold', type: 'boolean', default: false })
  footerBold!: boolean;

  @Column({
    name: 'footer_font_size',
    type: 'varchar',
    length: 10,
    default: 'SMALL',
  })
  footerFontSize!: LinkPageFooterSize;

  @Column({
    name: 'footer_logo_size',
    type: 'varchar',
    length: 10,
    default: 'SMALL',
  })
  footerLogoSize!: LinkPageFooterSize;

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
