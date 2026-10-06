import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { BetterAuthUser } from 'src/modules/auth/infra/better-auth.config';
import { GetAuth, GetIdentity } from 'src/shared/decorators/get-auth.decorator';
import { AuthGuard, SessionGuard } from 'src/shared/guards/auth.guard';
import { TransformResponseInterceptor } from 'src/shared/interceptors';
import { ZodValidationPipe } from 'src/shared/pipes/zod-validation.pipe';
import type { AuthPayload } from 'src/shared/types/auth-payload.types';
import {
  acceptInviteDto,
  createInviteDto,
  type AcceptInviteDto,
  type CreateInviteDto,
} from '../application/dto/team.dto';
import { TeamService } from '../application/team.service';

@Controller('team')
@UseGuards(AuthGuard)
@UseInterceptors(TransformResponseInterceptor)
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Get()
  get(@GetAuth() auth: AuthPayload) {
    return this.teamService.get(auth);
  }

  @Post('invites')
  invite(
    @GetAuth() auth: AuthPayload,
    @Body(new ZodValidationPipe(createInviteDto)) dto: CreateInviteDto,
  ) {
    return this.teamService.invite(auth, dto);
  }

  @Post('invites/:id/renew')
  renewInvite(
    @GetAuth() auth: AuthPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.teamService.renewInvite(auth, id);
  }

  @Delete('invites/:id')
  revokeInvite(
    @GetAuth() auth: AuthPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.teamService.revokeInvite(auth, id);
  }

  @Delete('members/:userId')
  removeMember(@GetAuth() auth: AuthPayload, @Param('userId') userId: string) {
    return this.teamService.removeMember(auth, userId);
  }
}

@Controller('invites')
@UseInterceptors(TransformResponseInterceptor)
@Throttle({ default: { limit: 20, ttl: 60000 } })
export class InvitesController {
  constructor(private readonly teamService: TeamService) {}

  @Get(':token')
  preview(@Param('token') token: string) {
    return this.teamService.preview(token);
  }

  /** Must run before any AuthGuard route, which would provision an own company. */
  @Post('accept')
  @UseGuards(SessionGuard)
  accept(
    @GetIdentity() identity: BetterAuthUser,
    @Body(new ZodValidationPipe(acceptInviteDto)) dto: AcceptInviteDto,
  ) {
    return this.teamService.accept(identity, dto.token);
  }
}
