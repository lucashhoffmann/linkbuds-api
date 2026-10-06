import { SocialPlatform } from '../enums/social-platform.enum';
import { CompanyEntity } from 'src/modules/company/domain/entities/company.entity';
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
import { LinkPageBackgroundType } from '../enums/link-page-background-type.enum';
import { LinkPageFooterMode } from '../enums/link-page-footer-mode.enum';
import { LinkPageLayout } from '../enums/link-page-layout.enum';
import { LinkPageStatus } from '../enums/link-page-status.enum';
import { LinkPageType } from '../enums/link-page-type.enum';
import { LinkPageImageEntity } from './link-page-image.entity';
import { LinkPageLinkEntity } from './link-page-link.entity';
import { LinkPageSocialLinkEntity } from './link-page-social-link.entity';

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

  /** Set only for POST pages. */
  @Column({ name: 'parent_page_id', type: 'uuid', nullable: true })
  parentPageId!: string | null;

  @ManyToOne(() => LinkPageEntity, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parent_page_id' })
  parentPage!: LinkPageEntity | null;

  @Column({ name: 'post_network', type: 'varchar', length: 20, nullable: true })
  postNetwork!: SocialPlatform | null;

  @Column({ name: 'post_url', type: 'text', nullable: true })
  postUrl!: string | null;

  @Column({ name: 'status', type: 'varchar', length: 20, nullable: false })
  status!: LinkPageStatus;

  @Column({
    name: 'layout',
    type: 'varchar',
    length: 20,
    nullable: false,
    default: LinkPageLayout.LAYOUT_1,
  })
  layout!: LinkPageLayout;

  @Column({
    name: 'background_type',
    type: 'varchar',
    length: 20,
    nullable: false,
    default: LinkPageBackgroundType.SOLID,
  })
  backgroundType!: LinkPageBackgroundType;

  @Column({
    name: 'background_color',
    type: 'varchar',
    length: 7,
    nullable: false,
    default: '#FFFFFF',
  })
  backgroundColor!: string;

  @Column({ name: 'background_image_url', type: 'text', nullable: true })
  backgroundImageUrl!: string | null;

  @Column({ name: 'avatar_url', type: 'text', nullable: true })
  avatarUrl!: string | null;

  @Column({ name: 'title', length: 140, nullable: false, default: '' })
  title!: string;

  @Column({ name: 'subtitle', type: 'text', nullable: true })
  subtitle!: string | null;

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

  @OneToMany(() => LinkPageLinkEntity, (link) => link.linkPage)
  links!: LinkPageLinkEntity[];

  @OneToMany(
    () => LinkPageSocialLinkEntity,
    (socialLink) => socialLink.linkPage,
  )
  socialLinks!: LinkPageSocialLinkEntity[];

  @OneToMany(() => LinkPageImageEntity, (image) => image.linkPage)
  images!: LinkPageImageEntity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt!: Date | null;
}
