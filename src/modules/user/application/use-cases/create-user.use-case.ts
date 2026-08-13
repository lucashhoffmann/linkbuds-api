import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { Repository } from 'typeorm';
import { CompanyEntity } from 'src/modules/company/domain/entities/company.entity';
import { ERROR_CODES } from 'src/shared/constants/errors.constants';
import {
  ConflictException,
  NotFoundException,
} from 'src/shared/exceptions/business.exception';
import { AuthPayload } from 'src/shared/types/auth-payload.types';
import { UserEntity } from '../../domain/entities/user.entity';
import { CreateUserDto } from '../dto/create-user.dto';
import { toUserResponse } from './user-response.mapper';

@Injectable()
export class CreateUserUseCase {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(CompanyEntity)
    private readonly companyRepository: Repository<CompanyEntity>,
  ) {}

  async execute(auth: AuthPayload, dto: CreateUserDto) {
    const companyId = dto.companyId ?? auth.companyId;
    const company = await this.companyRepository.findOne({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException(ERROR_CODES.COMPANY_NOT_FOUND);
    }

    const email = dto.email.trim().toLowerCase();
    const userWithEmail = await this.userRepository.findOne({
      where: { email },
    });

    if (userWithEmail) {
      throw new ConflictException(ERROR_CODES.USER_EMAIL_ALREADY_EXISTS);
    }

    const user = this.userRepository.create({
      name: dto.name.trim(),
      email,
      password: await argon2.hash(dto.password),
      company,
    });

    return toUserResponse(await this.userRepository.save(user));
  }
}
