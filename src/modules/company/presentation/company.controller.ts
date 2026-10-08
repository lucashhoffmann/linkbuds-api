import {
  Body,
  Controller,
  Patch,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { GetAuth } from 'src/shared/decorators/get-auth.decorator';
import { AuthGuard } from 'src/shared/guards/auth.guard';
import { TransformResponseInterceptor } from 'src/shared/interceptors';
import { ZodValidationPipe } from 'src/shared/pipes/zod-validation.pipe';
import type { AuthPayload } from 'src/shared/types/auth-payload.types';
import { CompanyService } from '../application/company.service';
import {
  updateCompanyDto,
  type UpdateCompanyDto,
} from '../application/dto/company.dto';

@Controller('company')
@UseInterceptors(TransformResponseInterceptor)
@UseGuards(AuthGuard)
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Patch()
  update(
    @GetAuth() auth: AuthPayload,
    @Body(new ZodValidationPipe(updateCompanyDto)) dto: UpdateCompanyDto,
  ) {
    return this.companyService.update(auth, dto);
  }
}
