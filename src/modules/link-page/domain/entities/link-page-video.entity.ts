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
import { LinkPageMediaSize } from '../enums/link-page-media-size.enum';
import { LinkPageEntity } from './link-page.entity';

@Entity({ name: 'link_page_videos' })
export class LinkPageVideoEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'link_page_id', type: 'uuid', nullable: false })
  linkPageId!: string;

  @ManyToOne(() => LinkPageEntity, (linkPage) => linkPage.videos, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'link_page_id' })
  linkPage!: LinkPageEntity;

  @Column({ name: 'url', type: 'text', nullable: false })
  url!: string;

  @Column({ name: 'title', type: 'varchar', length: 120, nullable: true })
  title!: string | null;

  @Column({ name: 'autoplay', type: 'boolean', default: false })
  autoplay!: boolean;

  @Column({ name: 'controls', type: 'boolean', default: true })
  controls!: boolean;

  @Column({
    name: 'size',
    type: 'varchar',
    length: 10,
    default: LinkPageMediaSize.MEDIUM,
  })
  size!: LinkPageMediaSize;

  @Column({ name: 'custom_height', type: 'integer', nullable: true })
  customHeight!: number | null;

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
