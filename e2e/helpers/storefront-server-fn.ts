import http from "node:http";
import { defaultSerovalPlugins } from "@tanstack/router-core";
import { toJSONAsync } from "seroval";

/** TanStack Start server function ids (stable for this module path). */
export const ACCOUNT_LOGIN_SERVER_FN_ID =
  "eyJmaWxlIjoiL3NyYy9saWIvYXBpL2FjY291bnQuZnVuY3Rpb25zLnRzIiwiZnVuY3Rpb25JZCI6ImFjY291bnRMb2dpbiIsImV4cG9ydCI6ImFjY291bnRMb2dpbiJ9";

export const ACCOUNT_INVITE_USER_SERVER_FN_ID =
  "eyJmaWxlIjoiL3NyYy9saWIvYXBpL2FjY291bnQuZnVuY3Rpb25zLnRzIiwiZnVuY3Rpb25JZCI6ImFjY291bnRJbnZpdGVVc2VyIiwiZXhwb3J0IjoiYWNjb3VudEludml0ZVVzZXIifQ==";

export function accountLoginServerFnUrl(storefrontOrigin: string): string {
  return `${storefrontOrigin.replace(/\/$/, "")}/_serverFn/${ACCOUNT_LOGIN_SERVER_FN_ID}`;
}

export function accountInviteUserServerFnUrl(storefrontOrigin: string): string {
  return `${storefrontOrigin.replace(/\/$/, "")}/_serverFn/${ACCOUNT_INVITE_USER_SERVER_FN_ID}`;
}

async function serializeServerFnPayload(payload: { data: unknown }): Promise<string> {
  return JSON.stringify(await toJSONAsync(payload, { plugins: defaultSerovalPlugins }));
}

function crossOriginDenied(status: number, raw: string): boolean {
  return status === 403 || /forbidden|herkomst|ongeldige/i.test(raw);
}

/** Node http client so Origin/Sec-Fetch-Site are not rewritten like Playwright APIRequest. */
function postCrossOriginViaNodeHttp(
  url: string,
  body: string,
  evilOrigin: string,
): Promise<{ status: number; raw: string }> {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const req = http.request(
      {
        hostname: target.hostname,
        port: target.port || (target.protocol === "https:" ? 443 : 80),
        path: `${target.pathname}${target.search}`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          "x-tsr-serverFn": "true",
          Accept: "application/x-tss-framed, application/x-ndjson, application/json",
          Origin: evilOrigin,
          "Sec-Fetch-Site": "cross-site",
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => {
          raw += chunk;
        });
        res.on("end", () => resolve({ status: res.statusCode ?? 0, raw }));
      },
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

export async function postAccountLoginCrossOrigin(
  storefrontOrigin: string,
  payload: { email: string; password: string; clientKey: string },
  evilOrigin = "https://evil.example",
): Promise<{ status: number; raw: string; denied: boolean }> {
  const body = await serializeServerFnPayload({ data: payload });
  const { status, raw } = await postCrossOriginViaNodeHttp(
    accountLoginServerFnUrl(storefrontOrigin),
    body,
    evilOrigin,
  );

  return { status, raw, denied: crossOriginDenied(status, raw) };
}

export async function postAccountInviteUserCrossOrigin(
  storefrontOrigin: string,
  payload: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
  },
  cookieHeader: string,
  evilOrigin = "https://evil.example",
): Promise<{ status: number; raw: string; denied: boolean }> {
  const body = await serializeServerFnPayload({ data: payload });
  const target = new URL(accountInviteUserServerFnUrl(storefrontOrigin));
  const { status, raw } = await new Promise<{ status: number; raw: string }>((resolve, reject) => {
    const req = http.request(
      {
        hostname: target.hostname,
        port: target.port || (target.protocol === "https:" ? 443 : 80),
        path: `${target.pathname}${target.search}`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          "x-tsr-serverFn": "true",
          Accept: "application/x-tss-framed, application/x-ndjson, application/json",
          Origin: evilOrigin,
          "Sec-Fetch-Site": "cross-site",
          Cookie: cookieHeader,
        },
      },
      (res) => {
        let rawBody = "";
        res.on("data", (chunk) => {
          rawBody += chunk;
        });
        res.on("end", () => resolve({ status: res.statusCode ?? 0, raw: rawBody }));
      },
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });

  return { status, raw, denied: crossOriginDenied(status, raw) };
}
