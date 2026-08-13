import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { GetAuth } from 'src/shared/decorators/get-auth.decorator';
import { AuthGuard } from 'src/shared/guards/auth.guard';
import { TransformResponseInterceptor } from 'src/shared/interceptors';
import { ZodValidationPipe } from 'src/shared/pipes/zod-validation.pipe';
import type { AuthPayload } from 'src/shared/types/auth-payload.types';
import {
  loginAuthDto,
  type LoginAuthDto,
} from '../application/dto/login-auth.dto';
import {
  registerUserAndCompanyDto,
  type RegisterUserAndCompanyDto,
} from '../application/dto/register-user-and-company.dto';
import {
  GetSessionUseCase,
  LoginAuthUseCase,
  RegisterUserAndCompanyUseCase,
} from '../application/use-cases';

@Controller('auth')
@UseInterceptors(TransformResponseInterceptor)
export class AuthController {
  constructor(
    private readonly registerUserAndCompanyUseCase: RegisterUserAndCompanyUseCase,
    private readonly loginAuthUseCase: LoginAuthUseCase,
    private readonly getSessionUseCase: GetSessionUseCase,
  ) {}

  @Post()
  login(@Body(new ZodValidationPipe(loginAuthDto)) dto: LoginAuthDto) {
    return this.loginAuthUseCase.execute(dto);
  }

  @Post('login')
  loginAlias(@Body(new ZodValidationPipe(loginAuthDto)) dto: LoginAuthDto) {
    return this.loginAuthUseCase.execute(dto);
  }

  @Post('register')
  register(
    @Body(new ZodValidationPipe(registerUserAndCompanyDto))
    dto: RegisterUserAndCompanyDto,
  ) {
    return this.registerUserAndCompanyUseCase.execute(dto);
  }

  @Get('session')
  @UseGuards(AuthGuard)
  getSession(@GetAuth() auth: AuthPayload) {
    return this.getSessionUseCase.execute(auth);
  }
}
