/**
 * Live PNR status. Two providers, chosen by what is set in backend/.env:
 *   1. RapidAPI   (RAPIDAPI_KEY)         -> GET https://<RAPIDAPI_HOST><RAPIDAPI_PNR_PATH>?pnrNumber=<pnr>
 *   2. IndianRailAPI (INDIAN_RAIL_API_KEY) -> http://indianrailapi.com/api/v2/PNRCheck/apikey/<key>/PNRNumber/<pnr>/
 * Keys stay on the server and are never sent to the browser.
 */

class PnrApiError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

async function getJson(url, headers = {}) {
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
    let body = null;
    try { body = await res.json(); } catch { /* non-JSON body */ }
    return { httpStatus: res.status, body };
  } catch {
    throw new PnrApiError("Could not reach the PNR service. Please try again.");
  }
}

const pick = (obj, ...keys) => {
  for (const k of keys) if (obj && obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
  return undefined;
};

// ---------------- RapidAPI ----------------
async function viaRapidApi(pnr) {
  const host = process.env.RAPIDAPI_HOST || "irctc1.p.rapidapi.com";
  const path = process.env.RAPIDAPI_PNR_PATH || "/api/v3/getPNRStatus";
  const url = `https://${host}${path}?pnrNumber=${encodeURIComponent(pnr)}`;

  const { httpStatus, body } = await getJson(url, {
    "x-rapidapi-key": process.env.RAPIDAPI_KEY,
    "x-rapidapi-host": host,
  });

  if (httpStatus === 401 || httpStatus === 403) {
    throw new PnrApiError("PNR service rejected the API key (check RAPIDAPI_KEY and that you are subscribed to this API).", 502);
  }
  if (httpStatus === 429) throw new PnrApiError("PNR service rate limit reached. Please try again later.", 429);

  const d = body && (body.data || body.Data);
  if (!d || body.status === false) {
    throw new PnrApiError((body && (body.message || body.Message)) || "PNR not found.", 404);
  }

  const list = d.PassengerStatus || d.passengerStatus || d.Passengers || d.passengers || [];
  return {
    source: "live",
    pnr: pick(d, "Pnr", "pnr", "PnrNumber") || pnr,
    train_number: pick(d, "TrainNo", "train_number", "TrainNumber"),
    train_name: pick(d, "TrainName", "train_name"),
    journey_class: pick(d, "Class", "class", "JourneyClass"),
    chart_prepared: pick(d, "ChartPrepared", "chart_prepared") === true || String(pick(d, "ChartPrepared") || "").toUpperCase() === "YES",
    source_name: pick(d, "BoardingStationName", "From", "from", "SourceName") ,
    destination_name: pick(d, "ReservationUptoName", "To", "to", "DestinationName"),
    journey_date: pick(d, "Doj", "DestinationDoj", "JourneyDate", "date"),
    passengers: list.map((p, i) => ({
      id: i,
      name: `Passenger ${pick(p, "Number", "number") || i + 1}`,
      booking_status: pick(p, "BookingStatusNew", "BookingStatus", "booking_status") || "-",
      current_status: pick(p, "CurrentStatusNew", "CurrentStatus", "current_status") || "-",
    })),
  };
}

// ---------------- IndianRailAPI ----------------
async function viaIndianRailApi(pnr) {
  const url = `http://indianrailapi.com/api/v2/PNRCheck/apikey/${encodeURIComponent(process.env.INDIAN_RAIL_API_KEY)}/PNRNumber/${encodeURIComponent(pnr)}/`;
  const { body: data } = await getJson(url);

  if (!data || String(data.ResponseCode) !== "200" || String(data.Status).toUpperCase() !== "SUCCESS") {
    throw new PnrApiError(String((data && (data.Message || data.Status)) || "PNR not found."), 404);
  }
  const list = data.Passangers || data.Passengers || []; // API spells it "Passangers"
  return {
    source: "live",
    pnr: data.PnrNumber || pnr,
    train_number: data.TrainNumber,
    train_name: data.TrainName,
    journey_class: data.JourneyClass,
    chart_prepared: String(data.ChartPrepared || "").toUpperCase() === "YES",
    source_name: data.From,
    destination_name: data.To,
    journey_date: data.JourneyDate,
    passengers: list.map((p, i) => ({
      id: i,
      name: p.Passenger || `Passenger ${i + 1}`,
      booking_status: p.BookingStatus,
      current_status: p.CurrentStatus,
    })),
  };
}

async function fetchLivePnr(pnr) {
  if (process.env.RAPIDAPI_KEY) return viaRapidApi(pnr);
  if (process.env.INDIAN_RAIL_API_KEY) return viaIndianRailApi(pnr);
  throw new PnrApiError("Live PNR lookup is not configured (set RAPIDAPI_KEY in backend/.env).", 503);
}

module.exports = { fetchLivePnr, PnrApiError };
