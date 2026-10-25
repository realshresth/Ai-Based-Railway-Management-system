/**
 * SMS sending. Choose a provider in backend/.env with SMS_PROVIDER:
 *   console   (default) - nothing is sent, the message is printed in the server console (good for testing)
 *   fast2sms  - needs FAST2SMS_API_KEY            (India, https://www.fast2sms.com)
 *   twilio    - needs TWILIO_SID, TWILIO_TOKEN and TWILIO_FROM (or TWILIO_MESSAGING_SID)
 */
function normalizePhone(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  const ten = digits.length >= 10 ? digits.slice(-10) : "";
  return /^[6-9]\d{9}$/.test(ten) ? ten : null; // Indian mobile numbers
}

const maskPhone = (p) => (p ? "XXXXXX" + p.slice(-4) : null);

async function sendSms(rawPhone, text) {
  const phone = normalizePhone(rawPhone);
  if (!phone) return { ok: false, status: "invalid_number" };
  const provider = (process.env.SMS_PROVIDER || "console").toLowerCase();

  try {
    if (provider === "fast2sms") {
      if (!process.env.FAST2SMS_API_KEY) return { ok: false, status: "no_api_key" };
      const res = await fetch("https://www.fast2sms.com/dev/bulkV2", {
        method: "POST",
        headers: { authorization: process.env.FAST2SMS_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ route: process.env.FAST2SMS_ROUTE || "q", message: text, numbers: phone, flash: 0 }),
        signal: AbortSignal.timeout(15000),
      });
      const body = await res.json().catch(() => ({}));
      return body.return === true ? { ok: true, status: "sent" } : { ok: false, status: "failed", detail: body.message || res.status };
    }
    if (provider === "twilio") {
      const { TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM, TWILIO_MESSAGING_SID } = process.env;
      if (!TWILIO_SID || !TWILIO_TOKEN || !(TWILIO_FROM || TWILIO_MESSAGING_SID)) return { ok: false, status: "no_api_key" };
      const form = new URLSearchParams({ To: "+91" + phone, Body: text });
      if (TWILIO_MESSAGING_SID) form.set("MessagingServiceSid", TWILIO_MESSAGING_SID); else form.set("From", TWILIO_FROM);
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
        method: "POST",
        headers: { Authorization: "Basic " + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
        body: form, signal: AbortSignal.timeout(15000),
      });
      const body = await res.json().catch(() => ({}));
      return res.ok ? { ok: true, status: "sent" } : { ok: false, status: "failed", detail: body.message || res.status };
    }
    console.log(`[SMS:console] to ${phone}: ${text}`);
    return { ok: true, status: "console" };
  } catch (e) {
    return { ok: false, status: "failed", detail: e.message };
  }
}

module.exports = { sendSms, normalizePhone, maskPhone };
