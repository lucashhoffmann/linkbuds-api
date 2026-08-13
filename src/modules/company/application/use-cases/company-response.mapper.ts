import { CompanyEntity } from '../../domain/entities/company.entity';

export function toCompanyResponse(company: CompanyEntity) {
  return {
    id: company.id,
    name: company.name,
    email: company.email,
    createdAt: company.createdAt,
    updatedAt: company.updatedAt,
    deletedAt: company.deletedAt,
  };
}
