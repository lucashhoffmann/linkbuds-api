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
import { UserEntity } from '../../domain/entities/user.entity';
import { UpdateUserDto } from '../dto/update-user.dto';
import { toUserResponse } from './user-response.mapper';

@Injectable()
export class UpdateUserUseCase {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(CompanyEntity)
    private readonly companyRepository: Repository<CompanyEntity>,
  ) {}

  async execute(id: string, dto: UpdateUserDto) {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: { company: true },
    });

    if (!user) {
      throw new NotFoundException(ERROR_CODES.USER_NOT_FOUND);
    }

    if (dto.email) {
      const email = dto.email.trim().toLowerCase();
      const userWithEmail = await this.userRepository.findOne({
        where: { email },
      });

      if (userWithEmail && userWithEmail.id !== user.id) {
        throw new ConflictException(ERROR_CODES.USER_EMAIL_ALREADY_EXISTS);
      }

      user.email = email;
    }

    if (dto.name) {
      user.name = dto.name.trim();
    }

    if (dto.password) {
      user.password = await argon2.hash(dto.password);
    }

    if (dto.companyId) {
      const company = await this.companyRepository.findOne({
        where: { id: dto.companyId },
      });

      if (!company) {
        throw new NotFoundException(ERROR_CODES.COMPANY_NOT_FOUND);
      }

      user.company = company;
    }

    return toUserResponse(await this.userRepository.save(user));
  }
}
