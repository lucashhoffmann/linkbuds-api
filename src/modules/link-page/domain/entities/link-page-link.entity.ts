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
import { LinkPageContactType } from '../enums/link-page-contact-type.enum';
import { LinkPageLinkKind } from '../enums/link-page-link-kind.enum';
import { LinkPageLinkPlacement } from '../enums/link-page-link-placement.enum';
import { LinkPageEntity } from './link-page.entity';

@Entity({ name: 'link_page_links' })
export class LinkPageLinkEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'link_page_id', type: 'uuid', nullable: false })
  linkPageId!: string;

  @ManyToOne(() => LinkPageEntity, (linkPage) => linkPage.links, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'link_page_id' })
  linkPage!: LinkPageEntity;

  @Column({ name: 'placement', type: 'varchar', length: 20, nullable: false })
  placement!: LinkPageLinkPlacement;

  @Column({ name: 'kind', type: 'varchar', length: 20, nullable: false })
  kind!: LinkPageLinkKind;

  @Column({ name: 'label', length: 120, nullable: false })
  label!: string;

  @Column({ name: 'url', type: 'text', nullable: true })
  url!: string | null;

  @Column({ name: 'contact_type', type: 'varchar', length: 20, nullable: true })
  contactType!: LinkPageContactType | null;

  @Column({
    name: 'contact_value',
    type: 'varchar',
    length: 180,
    nullable: true,
  })
  contactValue!: string | null;

  @Column({ name: 'text_color', type: 'varchar', length: 7, nullable: false })
  textColor!: string;

  @Column({
    name: 'background_color',
    type: 'varchar',
    length: 7,
    nullable: false,
  })
  backgroundColor!: string;

  @Column({ name: 'border_color', type: 'varchar', length: 7, nullable: false })
  borderColor!: string;

  @Column({ name: 'border_enabled', type: 'boolean', default: false })
  borderEnabled!: boolean;

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
