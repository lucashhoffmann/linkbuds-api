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
import type { TextRun } from '../../application/dto/link-page.dto';
import { LinkPageFooterStyle } from '../enums/link-page-footer-mode.enum';
import { LinkPageEntity } from './link-page.entity';

@Entity({ name: 'link_page_texts' })
export class LinkPageTextEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'link_page_id', type: 'uuid', nullable: false })
  linkPageId!: string;

  @ManyToOne(() => LinkPageEntity, (linkPage) => linkPage.texts, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'link_page_id' })
  linkPage!: LinkPageEntity;

  /** Formatted runs; `\n` inside `text` = line break. Never HTML. */
  @Column({ name: 'content', type: 'jsonb', default: () => "'[]'" })
  content!: TextRun[];

  /** Same shapes as the footer; colors apply to PILL and BOX. */
  @Column({ name: 'style', type: 'varchar', length: 10, default: 'TEXT' })
  style!: LinkPageFooterStyle;

  @Column({ name: 'align', type: 'varchar', length: 10, default: 'LEFT' })
  align!: 'LEFT' | 'CENTER' | 'RIGHT';

  @Column({
    name: 'background_color',
    type: 'varchar',
    length: 7,
    nullable: true,
  })
  backgroundColor!: string | null;

  @Column({ name: 'border_color', type: 'varchar', length: 7, nullable: true })
  borderColor!: string | null;

  /** PILL/BOX: fill the content width instead of hugging the text. */
  @Column({ name: 'full_width', type: 'boolean', default: false })
  fullWidth!: boolean;

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
