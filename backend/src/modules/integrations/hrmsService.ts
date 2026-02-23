import https from "https";

type Employee = {
  id: string | number;
  name: string;
  email?: string;
  [key: string]: unknown;
};

type EmployeesResponse = {
  employees?: Employee[];
} | Employee[];

const HRMS_EMPLOYEES_URL =
  "https://naturalistically-hyperopic-juelz.ngrok-free.dev/api/v1/integration/employees";

export const hrmsService = {
  async fetchEmployees(): Promise<Employee[]> {
    const apiKey = process.env.HRMS_API_KEY;

    if (!apiKey) {
      throw new Error("HRMS_API_KEY is not configured");
    }

    const payload = JSON.stringify({});

    const employees = await new Promise<Employee[]>((resolve, reject) => {
      const request = https.request(
        HRMS_EMPLOYEES_URL,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload),
            "x-api-key": apiKey,
          },
        },
        response => {
          const chunks: Buffer[] = [];

          response.on("data", chunk => {
            chunks.push(chunk as Buffer);
          });

          response.on("end", () => {
            try {
              const body = Buffer.concat(chunks).toString("utf8");
              const parsed = JSON.parse(body) as EmployeesResponse;
              if (Array.isArray(parsed)) {
                resolve(parsed);
              } else if (parsed && Array.isArray(parsed.employees)) {
                resolve(parsed.employees);
              } else {
                resolve([]);
              }
            } catch (error) {
              reject(error);
            }
          });
        },
      );

      request.on("error", error => {
        reject(error);
      });

      request.write(payload);
      request.end();
    });

    return employees;
  },
};

