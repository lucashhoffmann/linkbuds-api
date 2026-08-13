import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanyEntity } from '../company/domain/entities/company.entity';
import { UserEntity } from '../user/domain/entities/user.entity';
import * as UseCases from './application/use-cases';
import { JwtTokenService } from './infra/jwt-token.service';
import { AuthController } from './presentation/auth.controller';

const useCases = Object.values(UseCases);

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, CompanyEntity])],
  controllers: [AuthController],
  providers: [
    ...useCases,
    { provide: 'TokenService', useClass: JwtTokenService },
  ],
  exports: [...useCases, 'TokenService'],
})
export class AuthModule {}
