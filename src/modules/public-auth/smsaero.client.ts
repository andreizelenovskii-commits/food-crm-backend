import { backendEnv } from "@backend/config/env";

type SmsAeroResponse = {
  success?: boolean;
  message?: string;
};

export async function sendSmsCode(phone: string, code: string) {
  const text = `FoodLike: код подтверждения ${code}. Никому его не сообщайте.`;

  if (!backendEnv.smsAeroEnabled || !backendEnv.smsAeroEmail || !backendEnv.smsAeroApiKey) {
    console.info(`[sms-dev] ${phone}: ${text}`);
    return;
  }

  const body = new URLSearchParams({
    number: phone,
    sign: backendEnv.smsAeroSign,
    text,
    channel: "SERVICE",
  });
  const auth = Buffer.from(`${backendEnv.smsAeroEmail}:${backendEnv.smsAeroApiKey}`).toString("base64");
  const response = await fetch("https://gate.smsaero.ru/v2/sms/send", {
    method: "POST",
    headers: {
      authorization: `Basic ${auth}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const payload = await response.json().catch(() => null) as SmsAeroResponse | null;

  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.message ?? "Не удалось отправить SMS-код");
  }
}
