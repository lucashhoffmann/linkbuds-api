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
import { GetAuth } from 'src/shared/decorators/get-auth.decorator';
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
