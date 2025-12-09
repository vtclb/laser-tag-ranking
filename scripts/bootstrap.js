import { VERSION } from "./version.js";

const scripts = [
  "config.js",
  "api.js",
  "avatars.client.js",
  "quickStats.js",
  "ranking.js"
];

for (const file of scripts) {
  import(`./${file}?v=${VERSION}`)
    .catch(err => console.error("MODULE LOAD ERROR:", file, err));
}
