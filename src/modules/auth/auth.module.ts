import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanyEntity } from '../company/domain/entities/company.entity';
import { UserEntity } from '../user/domain/entities/user.entity';
import * as UseCases from './application/use-cases';
import { AuthController } from './presentation/auth.controller';
import { BetterAuthController } from './presentation/better-auth.controller';

const useCases = Object.values(UseCases);

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, CompanyEntity])],
  controllers: [AuthController, BetterAuthController],
  providers: [...useCases],
  exports: [...useCases],
})
export class AuthModule {}
