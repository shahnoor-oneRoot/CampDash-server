import * as dotenv from "dotenv";
import fetch from "node-fetch";
import https from "https";
import Bottleneck from "bottleneck";

dotenv.config();

const agent = new https.Agent({
  keepAlive: true,
  maxSockets: 100,
});

const limiter = new Bottleneck({
  maxConcurrent: 100,
  minTime: 10,
});

const API_URL = process.env.CHATRACE_SEND_API_URL;
const API_KEY = process.env.CHATRACE_API_KEY;

export async function createUserWithFieldsAndFlow({ phone, name, crop, NHD }) {
  // sanitize phone exactly as before
  let sanitized = phone.replace(/"/g, "").trim();
  if (sanitized.startsWith("0")) sanitized = sanitized.slice(1);

  console.log("Sanitized Phone:", sanitized);

  // single POST upsert + actions
  const res = await limiter.schedule(() =>
    fetch(API_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
        "X-ACCESS-TOKEN": API_KEY,
      },
      body: JSON.stringify({
        phone: sanitized,
        first_name: name,
        last_name: "farmer",
        gender: "male",
        actions: [
          {
            action: "set_field_value",
            field_name: "farmer_name",
            value: name,
          },
          {
            action: "set_field_value",
            field_name: "farmer_crop",
            value: crop,
          },
          {
            action: "set_field_value",
            field_name: "farmer_NHD",
            value: NHD,
          },
          {
            action: "send_flow",
            flow_id: 1746687279543,
          },
        ],
      }),
      agent,
    })
  );

  const data = await res.json();
  if (!res.ok) {
    console.error("Error in create+fields+flow:", data);
    throw new Error(`API error ${res.status}`);
  }

  console.log("Success:", data);
  return data;
}
