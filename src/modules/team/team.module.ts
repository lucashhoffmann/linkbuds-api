import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeamService } from './application/team.service';
import { CompanyInviteEntity } from './domain/entities/company-invite.entity';
import {
  InvitesController,
  TeamController,
} from './presentation/team.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CompanyInviteEntity])],
  controllers: [TeamController, InvitesController],
  providers: [TeamService],
})
export class TeamModule {}
