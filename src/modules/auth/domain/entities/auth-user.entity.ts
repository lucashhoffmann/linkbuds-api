import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Read model of the better-auth `user` table (identity). Written only by better-auth. */
@Entity({ name: 'user', synchronize: false })
export class AuthUserEntity {
  @PrimaryColumn({ name: 'id', type: 'text' })
  id!: string;

  @Column({ name: 'name', type: 'text' })
  name!: string;

  @Column({ name: 'email', type: 'text' })
  email!: string;

  @Column({ name: 'image', type: 'text', nullable: true })
  image!: string | null;
}
