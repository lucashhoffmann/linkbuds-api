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
import { LinkPageEntity } from './link-page.entity';

@Entity({ name: 'link_page_images' })
export class LinkPageImageEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'link_page_id', type: 'uuid', nullable: false })
  linkPageId!: string;

  @ManyToOne(() => LinkPageEntity, (linkPage) => linkPage.images, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'link_page_id' })
  linkPage!: LinkPageEntity;

  @Column({ name: 'image_url', type: 'text', nullable: false })
  imageUrl!: string;

  @Column({ name: 'alt_text', type: 'varchar', length: 180, nullable: true })
  altText!: string | null;

  @Column({ name: 'target_url', type: 'text', nullable: true })
  targetUrl!: string | null;

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
