import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { GetAuth } from 'src/shared/decorators/get-auth.decorator';
import { AppException } from 'src/shared/errors/app.exception';
import { ERROR_CODES } from 'src/shared/errors/error-catalog';
import { AuthGuard } from 'src/shared/guards/auth.guard';
import { TransformResponseInterceptor } from 'src/shared/interceptors';
import { ZodValidationPipe } from 'src/shared/pipes/zod-validation.pipe';
import type { AuthPayload } from 'src/shared/types/auth-payload.types';
import { CompanyDomainService } from '../application/company-domain.service';
import {
  createCompanyDomainDto,
  type CreateCompanyDomainDto,
} from '../application/dto/company-domain.dto';

@Controller('company/domain')
@UseInterceptors(TransformResponseInterceptor)
@UseGuards(AuthGuard)
export class CompanyDomainController {
  constructor(private readonly companyDomainService: CompanyDomainService) {}

  @Get()
  get(@GetAuth() auth: AuthPayload) {
    return this.companyDomainService.get(auth);
  }

  @Post()
  create(
    @GetAuth() auth: AuthPayload,
    @Body(new ZodValidationPipe(createCompanyDomainDto))
    dto: CreateCompanyDomainDto,
  ) {
    return this.companyDomainService.create(auth, dto);
  }

  @Post(':id/verify')
  verify(
    @GetAuth() auth: AuthPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.companyDomainService.verify(auth, id);
  }

  @Delete(':id')
  delete(
    @GetAuth() auth: AuthPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.companyDomainService.delete(auth, id);
  }
}

/** Public: Caddy asks before issuing an on-demand certificate (2xx = allowed). */
@Controller('public/domains')
export class PublicDomainController {
  constructor(private readonly companyDomainService: CompanyDomainService) {}

  @Get('tls-check')
  async tlsCheck(@Query('domain') domain?: string) {
    if (!(await this.companyDomainService.isTlsAllowed(domain ?? ''))) {
      throw new AppException(ERROR_CODES.COMPANY_DOMAIN_NOT_FOUND);
    }

    return { ok: true };
  }
}
