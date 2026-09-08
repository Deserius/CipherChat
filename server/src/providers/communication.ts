/**
 * CommunicationProvider — pluggable voice/PSTN/SMS layer.
 *
 * WebRTC voice/video is always available in the browser.
 * Twilio (or another PSTN provider) is optional and only activated when
 * server-side credentials are present. The rest of the application does not
 * depend on a provider being configured.
 */

import { config } from '../config.ts';

export interface DialRequest {
  to: string;
  from?: string;
  roomCode: string;
}

export interface SmsRequest {
  to: string;
  body: string;
}

export interface CommunicationProvider {
  readonly id: string;
  readonly available: boolean;
  dial?(req: DialRequest): Promise<{ sid: string } | { error: string }>;
  sms?(req: SmsRequest): Promise<{ sid: string } | { error: string }>;
}

export class WebRtcProvider implements CommunicationProvider {
  readonly id = 'webrtc';
  readonly available = true;
}

export class TwilioProvider implements CommunicationProvider {
  readonly id = 'twilio';
  readonly available: boolean;

  constructor() {
    this.available = Boolean(
      config.twilioAccountSid && config.twilioAuthToken && config.twilioPhoneNumber,
    );
  }

  async dial(req: DialRequest) {
    if (!this.available) return { error: 'Twilio is not configured' };
    // Integration point: call Twilio REST API / Voice with TwiML that bridges
    // the PSTN caller into the room via a SIP/WebRTC gateway.
    // Intentionally not hard-coded with credentials.
    void req;
    return { error: 'Twilio voice bridge is configured but not enabled in this build' };
  }

  async sms(req: SmsRequest) {
    if (!this.available) return { error: 'Twilio is not configured' };
    try {
      const auth = Buffer.from(`${config.twilioAccountSid}:${config.twilioAuthToken}`).toString(
        'base64',
      );
      const body = new URLSearchParams({
        To: req.to,
        From: config.twilioPhoneNumber,
        Body: req.body.slice(0, 320),
      });
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${config.twilioAccountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body,
        },
      );
      if (!res.ok) return { error: 'SMS provider rejected the request' };
      const json = (await res.json()) as { sid?: string };
      return { sid: json.sid ?? 'ok' };
    } catch {
      return { error: 'SMS provider unreachable' };
    }
  }
}

export class CommunicationHub {
  readonly webrtc = new WebRtcProvider();
  readonly twilio = new TwilioProvider();

  status() {
    return {
      webrtc: this.webrtc.available,
      twilio: this.twilio.available,
    };
  }
}

export const communicationHub = new CommunicationHub();
