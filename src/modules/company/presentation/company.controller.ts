import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from 'src/shared/guards/auth.guard';
import { TransformResponseInterceptor } from 'src/shared/interceptors';
import { ZodValidationPipe } from 'src/shared/pipes/zod-validation.pipe';
import {
  createCompanyDto,
  type CreateCompanyDto,
} from '../application/dto/create-company.dto';
import {
  updateCompanyDto,
  type UpdateCompanyDto,
} from '../application/dto/update-company.dto';
import { CreateCompanyUseCase } from '../application/use-cases/create-company.use-case';
import { DeleteCompanyUseCase } from '../application/use-cases/delete-company.use-case';
import { GetCompanyUseCase } from '../application/use-cases/get-company.use-case';
import { ListCompaniesUseCase } from '../application/use-cases/list-companies.use-case';
import { UpdateCompanyUseCase } from '../application/use-cases/update-company.use-case';

@Controller('companies')
@UseInterceptors(TransformResponseInterceptor)
@UseGuards(AuthGuard)
export class CompanyController {
  constructor(
    private readonly createCompanyUseCase: CreateCompanyUseCase,
    private readonly listCompaniesUseCase: ListCompaniesUseCase,
    private readonly getCompanyUseCase: GetCompanyUseCase,
    private readonly updateCompanyUseCase: UpdateCompanyUseCase,
    private readonly deleteCompanyUseCase: DeleteCompanyUseCase,
  ) {}

  @Post()
  create(@Body(new ZodValidationPipe(createCompanyDto)) dto: CreateCompanyDto) {
    return this.createCompanyUseCase.execute(dto);
  }

  @Get()
  list() {
    return this.listCompaniesUseCase.execute();
  }

  @Get(':id')
  get(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.getCompanyUseCase.execute(id);
  }

  @Put(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateCompanyDto)) dto: UpdateCompanyDto,
  ) {
    return this.updateCompanyUseCase.execute(id, dto);
  }

  @Delete(':id')
  delete(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.deleteCompanyUseCase.execute(id);
  }
}
