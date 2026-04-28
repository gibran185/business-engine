import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CreateServiceDto } from './dto/create-service.dto.js';
import type { UpdateServiceDto } from './dto/update-service.dto.js';

function mapService<T extends { price: Prisma.Decimal }>(row: T) {
  return {
    ...row,
    price: row.price.toString(),
  };
}

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) {}

  async create(merchantId: string, dto: CreateServiceDto) {
    const merchant = await this.prisma.merchants.findUnique({
      where: { id: merchantId },
      select: { id: true },
    });
    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    const created = await this.prisma.services.create({
      data: {
        merchant_id: merchantId,
        name: dto.name,
        description: dto.description,
        price: new Prisma.Decimal(dto.price),
        duration_minutes: dto.durationMinutes ?? 30,
        is_active: dto.isActive ?? true,
      },
    });

    return mapService(created);
  }

  async findAll(merchantId: string) {
    const merchant = await this.prisma.merchants.findUnique({
      where: { id: merchantId },
      select: { id: true },
    });
    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    const rows = await this.prisma.services.findMany({
      where: { merchant_id: merchantId },
      orderBy: [{ is_active: 'desc' }, { name: 'asc' }],
    });

    return rows.map((r) => mapService(r));
  }

  async findOne(merchantId: string, serviceId: string) {
    const row = await this.prisma.services.findFirst({
      where: { id: serviceId, merchant_id: merchantId },
    });
    if (!row) {
      throw new NotFoundException('Service not found for this merchant');
    }
    return mapService(row);
  }

  async update(merchantId: string, serviceId: string, dto: UpdateServiceDto) {
    const existing = await this.prisma.services.findFirst({
      where: { id: serviceId, merchant_id: merchantId },
    });
    if (!existing) {
      throw new NotFoundException('Service not found for this merchant');
    }

    const data: Prisma.servicesUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.price !== undefined) data.price = new Prisma.Decimal(dto.price);
    if (dto.durationMinutes !== undefined) {
      data.duration_minutes = dto.durationMinutes;
    }
    if (dto.isActive !== undefined) data.is_active = dto.isActive;

    if (Object.keys(data).length === 0) {
      return mapService(existing);
    }

    const updated = await this.prisma.services.update({
      where: { id: serviceId },
      data,
    });

    return mapService(updated);
  }

  async remove(merchantId: string, serviceId: string) {
    const existing = await this.prisma.services.findFirst({
      where: { id: serviceId, merchant_id: merchantId },
    });
    if (!existing) {
      throw new NotFoundException('Service not found for this merchant');
    }

    const apptCount = await this.prisma.appointments.count({
      where: { merchant_id: merchantId, service_id: serviceId },
    });
    if (apptCount > 0) {
      throw new ConflictException(
        'Cannot delete a service that has appointments. Deactivate it instead.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.staff_services.deleteMany({
        where: { merchant_id: merchantId, service_id: serviceId },
      });
      await tx.services.delete({ where: { id: serviceId } });
    });
  }
}
