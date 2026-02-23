import http from "http";
import https from "https";
import { prisma } from "../../prisma";

type HttpMethod = "GET" | "POST";

type ExecuteParams = {
  userId: number;
  name: string;
  url: string;
  method: HttpMethod;
  headers: Record<string, string>;
  body?: Record<string, unknown>;
};

export const apiFetcherService = {
  async executeFetch(params: ExecuteParams) {
    const urlObject = new URL(params.url);

    if (urlObject.protocol !== "https:" && urlObject.protocol !== "http:") {
      throw new Error("Only http and https URLs are supported");
    }

    const payload = params.method === "POST" && params.body ? JSON.stringify(params.body) : undefined;

    const headers: Record<string, string> = {
      ...params.headers,
    };

    if (payload && !headers["Content-Type"] && !headers["content-type"]) {
      headers["Content-Type"] = "application/json";
    }

    if (payload && !headers["Content-Length"] && !headers["content-length"]) {
      headers["Content-Length"] = Buffer.byteLength(payload).toString();
    }

    const responsePayload = await new Promise<{
      statusCode?: number;
      headers: http.IncomingHttpHeaders;
      body: any;
    }>((resolve, reject) => {
      const transport = urlObject.protocol === "https:" ? https : http;

      const request = transport.request(
        {
          method: params.method,
          hostname: urlObject.hostname,
          port: urlObject.port || (urlObject.protocol === "https:" ? 443 : 80),
          path: urlObject.pathname + urlObject.search,
          headers,
        },
        response => {
          const chunks: Buffer[] = [];

          response.on("data", chunk => {
            chunks.push(chunk as Buffer);
          });

          response.on("end", () => {
            try {
              const raw = Buffer.concat(chunks).toString("utf8");
              let parsed: unknown;
              try {
                parsed = JSON.parse(raw);
              } catch {
                parsed = { raw };
              }

              resolve({
                statusCode: response.statusCode,
                headers: response.headers,
                body: parsed,
              });
            } catch (error) {
              reject(error);
            }
          });
        },
      );

      request.on("error", error => {
        reject(error);
      });

      if (payload) {
        request.write(payload);
      }

      request.end();
    });

    const session = await prisma.apiFetchSession.create({
      data: {
        userId: params.userId,
        name: params.name,
        url: params.url,
        method: params.method,
        headers,
        response: responsePayload as any,
      },
    });

    return session;
  },

  async listSessions(userId: number) {
    const sessions = await prisma.apiFetchSession.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return sessions;
  },
};
