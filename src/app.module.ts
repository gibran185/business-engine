import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { CustomersModule } from './modules/customers/customers.module';
import { MerchantsModule } from './modules/merchants/merchants.module';
import { ServicesModule } from './modules/services/services.module';
import { PrismaModule } from './prisma/prisma.module';
import { TenancyModule } from './tenancy/tenancy.module';

const pinoLogger = LoggerModule.forRoot({
  pinoHttp: {
    level: process.env.LOG_LEVEL ?? 'info',
    ...(process.env.NODE_ENV !== 'production' && {
      transport: {
        target: 'pino-pretty',
        options: { singleLine: true, colorize: true },
      },
    }),
  },
});

@Module({
  imports: [
    { ...pinoLogger, global: true },
    PrismaModule,
    TenancyModule,
    AuthModule,
    CustomersModule,
    MerchantsModule,
    ServicesModule,
    AppointmentsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
