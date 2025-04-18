import { create } from "xmlbuilder2";
import fs from "fs";
import PlivoReport from "../model/plivo-job-report.model.js";
import { getISTDateRange } from "../utils/plivo/index.js";
// Returns XML to play custom audio and capture DTMF input
export const plivoAnswer = async (req, res) => {
  try {
    console.log("Plivo answer");
    const responseXml = create({ version: "1.0" })
      .ele("Response")
      .ele("GetDigits", {
        action: "https://campdash.onrender.com/plivo/answer-handle",
        method: "POST",
        timeout: "10",
        numDigits: "1",
      })
      .ele("Play")
      .txt(
        "https://codeskulptor-demos.commondatastorage.googleapis.com/pang/paza-moduless.mp3"
      )
      .up()
      .up()
      .ele("Speak")
      .txt("We did not receive any input. Goodbye!")
      .end({ prettyPrint: true });

    res.set("Content-Type", "text/xml");
    res.send(responseXml);
  } catch (error) {
    console.error("Plivo XML generation failed:", error);
    res.status(500).send("Internal server error");
  }
};

// Handles DTMF input from the user and logs the result
export const plivoAnswerHandle = async (req, res) => {
  try {
    // 1) Log incoming request body for debugging
    console.log("📥 plivoAnswerHandle raw body:", req.body);
    console.log("📥 plivoAnswerHandle keys:", Object.keys(req.body));

    const { From, Digits } = req.body;

    if (!From || !Digits) {
      console.warn("❌ Missing 'From' or 'Digits' in Plivo response");
      return res.status(400).send("Missing required input");
    }

    const ready = Digits === "1";

    // 2) Get IST time range
    const { istToday, istTomorrow } = getISTDateRange();

    console.log(
      "📆 Looking for campaign between:",
      istToday.toISOString(),
      "and",
      istTomorrow.toISOString()
    );

    // 3) Find today’s campaign
    const campaign = await PlivoReport.findOne({
      campaign_date: istToday,
    });

    console.log(campaign, "campaig");

    if (campaign) {
      campaign.campaign_report.push({
        cropname: "", // Optional: add logic to fetch correct cropname
        number: From,
        given_on: new Date(),
        ready,
      });

      await campaign.save();
      console.log(`✅ Recorded response for ${From}, ready: ${ready}`);
    } else {
      console.warn("⚠️ No campaign found for today to record DTMF");
    }

    // 4) Respond to caller with XML
    const responseXml = create({ version: "1.0" })
      .ele("Response")
      .ele("Speak")
      .txt("Thank you for your response. Goodbye!")
      .end({ prettyPrint: true });

    res.type("text/xml").send(responseXml);
  } catch (error) {
    console.error("💥 Error in plivoAnswerHandle:", error);
    res.status(500).send("Internal Server Error");
  }
};

// Handles hangup events and logs them
export const plivoHangup = async (req, res) => {
  console.log("Plivo hang");
  const { CallUUID, From, To, EndTime, HangupCause } = req.body;

  const hangupData = {
    call_uuid: CallUUID,
    from_number: From,
    to_number: To,
    end_time: EndTime || new Date().toISOString(),
    hangup_cause: HangupCause || "Unknown",
    event: "hangup",
  };

  fs.appendFile(
    "campaign_results.json",
    JSON.stringify(hangupData) + ",\n",
    (err) => {
      if (err) console.error("Error logging hangup data:", err);
    }
  );

  res.status(200).send("Hangup event received");
};
