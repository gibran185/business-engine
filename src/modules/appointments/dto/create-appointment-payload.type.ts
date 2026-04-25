import type { CreateAppointmentDto } from './create-appointment.dto.js';

/** Service layer: merchant from the URL, not from the client body. */
export type CreateAppointmentPayload = CreateAppointmentDto & {
  merchantId: string;
};
