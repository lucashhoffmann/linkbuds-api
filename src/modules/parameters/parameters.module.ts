import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParameterEntity } from './domain/entities/parameter.entity';
import { ParametersSeeder } from './seeders/parameters.seeder';

@Module({
  imports: [TypeOrmModule.forFeature([ParameterEntity])],
  providers: [ParametersSeeder],
  exports: [TypeOrmModule],
})
export class ParametersModule {}
