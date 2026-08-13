import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { Repository } from 'typeorm';
import { UserEntity } from 'src/modules/user/domain/entities/user.entity';
import { ERROR_CODES } from 'src/shared/constants/errors.constants';
import { UnauthorizedException } from 'src/shared/exceptions/business.exception';
import type { TokenService } from '../ports/token.service';
import { LoginAuthDto } from '../dto/login-auth.dto';

@Injectable()
export class LoginAuthUseCase {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @Inject('TokenService') private readonly tokens: TokenService,
  ) {}

  async execute(dto: LoginAuthDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.userRepository.findOne({
      where: { email },
      relations: { company: true },
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
        company: {
          id: true,
          name: true,
          email: true,
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException(ERROR_CODES.AUTH_INVALID_CREDENTIALS);
    }

    const isPasswordValid = await argon2.verify(user.password, dto.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException(ERROR_CODES.AUTH_INVALID_CREDENTIALS);
    }

    const payload = {
      id: user.id,
      companyId: user.company.id,
    };

    return {
      token: this.tokens.signAccess(payload),
      refreshToken: this.tokens.signRefresh(payload),
    };
  }
}
