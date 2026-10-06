import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AdminApiKeyGuard } from 'src/shared/guards/admin-api-key.guard';
import { TransformResponseInterceptor } from 'src/shared/interceptors';
import { ZodValidationPipe } from 'src/shared/pipes/zod-validation.pipe';
import { CompanyConditionsService } from '../application/company-conditions.service';
import {
  createCompanyConditionDto,
  searchCompaniesDto,
  type CreateCompanyConditionDto,
} from '../application/dto/company-condition.dto';
import {
  createPlanDto,
  updatePlanDto,
  type CreatePlanDto,
  type UpdatePlanDto,
} from '../application/dto/plan.dto';

/** Internal API. Usage: docs/admin-condicoes.md */
@Controller('admin')
@UseGuards(AdminApiKeyGuard)
@UseInterceptors(TransformResponseInterceptor)
export class AdminConditionsController {
  constructor(private readonly conditionsService: CompanyConditionsService) {}

  @Get('plans')
  listPlans() {
    return this.conditionsService.listPlans();
  }

  @Post('plans')
  createPlan(@Body(new ZodValidationPipe(createPlanDto)) dto: CreatePlanDto) {
    return this.conditionsService.createPlan(dto);
  }

  @Patch('plans/:code')
  updatePlan(
    @Param('code') code: string,
    @Body(new ZodValidationPipe(updatePlanDto)) dto: UpdatePlanDto,
  ) {
    return this.conditionsService.updatePlan(code, dto);
  }

  @Get('companies')
  searchCompanies(
    @Query(new ZodValidationPipe(searchCompaniesDto)) query: { q: string },
  ) {
    return this.conditionsService.searchCompanies(query.q);
  }

  @Get('companies/:companyId')
  getCompany(@Param('companyId', new ParseUUIDPipe()) companyId: string) {
    return this.conditionsService.getCompany(companyId);
  }

  @Post('companies/:companyId/conditions')
  createCondition(
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
    @Body(new ZodValidationPipe(createCompanyConditionDto))
    dto: CreateCompanyConditionDto,
  ) {
    return this.conditionsService.create(companyId, dto);
  }

  @Delete('conditions/:conditionId')
  revokeCondition(
    @Param('conditionId', new ParseUUIDPipe()) conditionId: string,
  ) {
    return this.conditionsService.revoke(conditionId);
  }
}
