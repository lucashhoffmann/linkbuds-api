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
import { SocialPlatform } from '../enums/social-platform.enum';
import { LinkPageEntity } from './link-page.entity';

@Entity({ name: 'link_page_social_links' })
export class LinkPageSocialLinkEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'link_page_id', type: 'uuid', nullable: false })
  linkPageId!: string;

  @ManyToOne(() => LinkPageEntity, (linkPage) => linkPage.socialLinks, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'link_page_id' })
  linkPage!: LinkPageEntity;

  @Column({ name: 'platform', type: 'varchar', length: 20, nullable: false })
  platform!: SocialPlatform;

  @Column({ name: 'url', type: 'text', nullable: false })
  url!: string;

  @Column({ name: 'sort_order', type: 'integer', nullable: false, default: 0 })
  sortOrder!: number;

  @Column({ name: 'active', type: 'boolean', default: true })
  active!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt!: Date | null;
}
