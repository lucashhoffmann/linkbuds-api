import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LinkPageEntity } from './domain/entities/link-page.entity';

@Module({
  imports: [TypeOrmModule.forFeature([LinkPageEntity])],
})
export class LinkPageModule {}
