import fs from "fs";
import https from "https";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "public", "models");
const BASE = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights";

const manifests = [
  "ssd_mobilenetv1_model-weights_manifest.json",
  "face_landmark_68_model-weights_manifest.json",
  "face_recognition_model-weights_manifest.json",
];

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, res => {
        if (res.statusCode === 302 || res.statusCode === 301) {
          const loc = res.headers.location;
          if (!loc) {
            reject(new Error("Redirect without location"));
            return;
          }
          get(loc).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} ${url}`));
          return;
        }
        const chunks = [];
        res.on("data", c => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      })
      .on("error", reject);
  });
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  for (const name of manifests) {
    const url = `${BASE}/${name}`;
    const buf = await get(url);
    const dest = path.join(OUT, name);
    fs.writeFileSync(dest, buf);
    const json = JSON.parse(buf.toString("utf8"));
    const paths = new Set();
    /** Manifests are an array of { paths: string[], weights: [...] } */
    const blocks = Array.isArray(json) ? json : [json];
    for (const block of blocks) {
      for (const p of block.paths || []) {
        paths.add(p);
      }
      for (const w of block.weights || []) {
        for (const p of w.paths || []) {
          paths.add(p);
        }
      }
    }
    for (const shard of paths) {
      const shardUrl = `${BASE}/${shard}`;
      const sbuf = await get(shardUrl);
      fs.writeFileSync(path.join(OUT, shard), sbuf);
      process.stdout.write(".");
    }
    console.log(` ${name}`);
  }
  console.log("Done:", OUT);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
