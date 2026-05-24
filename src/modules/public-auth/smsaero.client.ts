import { backendEnv } from "@backend/config/env";
import { ValidationError } from "@backend/shared/errors/app-error";

type SmsAeroResponse = {
  success?: boolean;
  message?: string;
  data?: unknown;
};

export async function sendSmsCode(phone: string, code: string) {
  const text = `FoodLike: ваш код для входа ${code}. Никому его не сообщайте.`;

  if (!backendEnv.smsAeroEnabled) {
    console.info(`[sms-dev] ${phone}: ${text}`);
    return;
  }

  if (!backendEnv.smsAeroEmail || !backendEnv.smsAeroApiKey) {
    throw new ValidationError("SMS Aero не настроен: укажите SMSAERO_EMAIL и SMSAERO_API_KEY.");
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
    console.error("[smsaero] send failed", {
      status: response.status,
      payload,
    });
    throw new ValidationError(
      payload?.message ??
        "SMS Aero не отправил код. Проверьте API-ключ, подпись отправителя и баланс.",
    );
  }
}
