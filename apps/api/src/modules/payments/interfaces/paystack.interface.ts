export interface PaystackApiResponse<T> {
  status: boolean;
  message: string;
  data: T;
}

export interface PaystackTransaction {
  id: number;
  status: string;
  reference: string;
  amount: number;
  currency: string;
  paid_at: string | null;
  channel: string | null;
}

export interface PaystackInitializeResponse {
  authorization_url: string;
  access_code: string;
  reference: string;
}

export interface PaystackChargeSuccessEvent {
  event: "charge.success";
  data: PaystackTransaction;
}

export interface PaystackWebhookRequest {
  signature?: string;
  rawBody: Buffer;
  body: unknown;
}
