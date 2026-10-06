import { SocialPlatform } from '../enums/social-platform.enum';
import type { FormConfig } from '../form-fields';
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
import {
  LinkPageFooterMode,
  LinkPageFooterSize,
  LinkPageFooterStyle,
} from '../enums/link-page-footer-mode.enum';
import { LinkPageLayout } from '../enums/link-page-layout.enum';
import { LinkPageStatus } from '../enums/link-page-status.enum';
import { LinkPageType } from '../enums/link-page-type.enum';
import { LinkPageImageEntity } from './link-page-image.entity';
import { LinkPageVideoEntity } from './link-page-video.entity';
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

  /** Set only for sub-pages (POST, FORM). */
  @Column({ name: 'parent_page_id', type: 'uuid', nullable: true })
  parentPageId!: string | null;

  @ManyToOne(() => LinkPageEntity, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parent_page_id' })
  parentPage!: LinkPageEntity | null;

  @Column({ name: 'post_network', type: 'varchar', length: 20, nullable: true })
  postNetwork!: SocialPlatform | null;

  @Column({ name: 'post_url', type: 'text', nullable: true })
  postUrl!: string | null;

  /** FORM pages only: fields, button text and success message. */
  @Column({ name: 'form', type: 'jsonb', nullable: true })
  form!: FormConfig | null;

  /** FORM pages only: Apps Script URL that appends each answer to a Google Sheet. Never public. */
  @Column({ name: 'form_webhook_url', type: 'text', nullable: true })
  formWebhookUrl!: string | null;

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

  @Column({
    name: 'background_gradient_color',
    type: 'varchar',
    length: 7,
    nullable: false,
    default: '#FFFFFF',
  })
  backgroundGradientColor!: string;

  @Column({ name: 'title_bold', type: 'boolean', default: true })
  titleBold!: boolean;

  @Column({ name: 'subtitle_bold', type: 'boolean', default: false })
  subtitleBold!: boolean;

  @Column({ name: 'footer_bold', type: 'boolean', default: false })
  footerBold!: boolean;

  @Column({ name: 'title_color', type: 'varchar', length: 7, nullable: true })
  titleColor!: string | null;

  @Column({
    name: 'subtitle_color',
    type: 'varchar',
    length: 7,
    nullable: true,
  })
  subtitleColor!: string | null;

  @Column({ name: 'footer_color', type: 'varchar', length: 7, nullable: true })
  footerColor!: string | null;

  /** CUSTOM footer shape; background/border apply to PILL and BOX. */
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

  /** Owner's Google Tag Manager container (GTM-XXXX). Bio only; posts inherit. */
  @Column({
    name: 'gtm_container_id',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  gtmContainerId!: string | null;

  /** Owner's GA4 measurement ID (G-XXXX). Bio only; posts inherit. */
  @Column({
    name: 'ga4_measurement_id',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  ga4MeasurementId!: string | null;

  @OneToMany(() => LinkPageLinkEntity, (link) => link.linkPage)
  links!: LinkPageLinkEntity[];

  @OneToMany(
    () => LinkPageSocialLinkEntity,
    (socialLink) => socialLink.linkPage,
  )
  socialLinks!: LinkPageSocialLinkEntity[];

  @OneToMany(() => LinkPageImageEntity, (image) => image.linkPage)
  images!: LinkPageImageEntity[];

  @OneToMany(() => LinkPageVideoEntity, (video) => video.linkPage)
  videos!: LinkPageVideoEntity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt!: Date | null;
}
