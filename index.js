#!/usr/bin/env node
import fetch from "node-fetch";
import * as fs from "fs";
import path from "path";
globalThis.fetch = fetch;

let totalSCan = 0;
let completedScan = 0;

const flagIndex = process.argv.indexOf("-a");
const displayDetails = flagIndex !== -1;
let dependencies;

// Read the package.json file specified in the command line argument
const packageJsonPath = process.argv.find((arg) =>
  arg.endsWith("package.json")
);

// Request function to OSV API
const scan = async ({ name, version }) => {
  try {
    const payload = {
      package: {
        name,
        version,
        ecosystem: "npm",
      },
    };
    const res = await fetch("https://api.osv.dev/v1/query", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    const isSafe = json.vulns?.length ? false : true;

    if (isSafe) {
      console.log(`[✅] ${name} version ${version} is safe`);
      return isSafe;
    }

    console.log(
      `[X] Found ${json.vulns.length} in ${name} version ${version}!`
    );

    for (let i = 0; i < json.vulns.length; i++) {
      console.log(`-------> ${json.vulns[i].id}: ${json.vulns[i].summary}`);
      if (displayDetails) {
        console.log(`Details: ${json.vulns[i].details}\n`);
        console.log(
          "=================================================================="
        );
      }
    }
    return isSafe;
  } catch (error) {
    console.log(`[FAILED] Scanning ${name} failed: `, error.message);
  } finally {
    completedScan++;

    if (completedScan == totalSCan) {
      console.log("[INFO] Packages summary");
      console.table(dependencies);
    }
  }
};

const start = async () => {
  try {
    const packageJson = JSON.parse(
      fs.readFileSync(path.resolve(packageJsonPath), "utf-8")
    );

    if (!packageJsonPath) {
      return console.log(`[FAILED] Package.json file was not found`);
    }

    // Get the dependencies from the package.json file
    dependencies = Object.entries(packageJson.dependencies).map(
      ([name, version]) => ({ name, version })
    );

    // Save the total packages
    totalSCan = dependencies.length;
    console.log(`[INFO] Scanning package with OSV (osv.dev) Databases`);

    // Scan all the dependencies with OSV API
    for (let i = 0; i < dependencies.length; i++) {
      scan(dependencies[i]).then((isSafe) => {
        dependencies[i].secure = isSafe ? "✅" : "X";
      });
    }
  } catch (error) {
    console.log(`[FAILED] Scanning failed: `, error.message);
  }
};

start();
