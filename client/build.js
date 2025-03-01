import * as esbuild from "esbuild";
import manifestPlugin from "esbuild-plugin-manifest";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import crypto from "crypto";
import chokidar from "chokidar";

const isProd = process.env.NODE_ENV === "production";

async function buildCss() {
  try {
    // Ensure dist directory exists
    if (!fs.existsSync("dist")) {
      fs.mkdirSync("dist", { recursive: true });
    }

    // Run tailwindcss CLI command
    const tailwindBin = path.resolve("./node_modules/.bin/tailwindcss");
    execSync(
      `NODE_ENV=${process.env.NODE_ENV} ${tailwindBin} ${
        isProd ? "--minify" : ""
      } -i src/main.css -o dist/main.css`,
      {
        stdio: "inherit",
        env: {
          ...process.env,
          NODE_ENV: process.env.NODE_ENV || "development",
        },
      }
    );
    const cssContent = fs.readFileSync(`dist/main.css`, "utf8");
    const hash = crypto.createHash("md5").update(cssContent).digest("hex");

    // Rename CSS file with hash
    const hashedOutputName = `main-${hash}.css`;
    fs.renameSync(`dist/main.css`, `dist/${hashedOutputName}`);

    // Update manifest with CSS entry
    const manifestPath = path.join("dist", "manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    manifest["main.css"] = hashedOutputName;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

function typeCheck() {
  const tscBin = path.resolve("./node_modules/.bin/tsc");
  console.log("Type checking...", tscBin);
  execSync(`${tscBin} --noEmit`, {
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV || "development",
    },
  });
  console.log("done.");
}

async function writeHtml() {
  console.log("Building HTML.");
  try {
    const manifestPath = path.join("dist", "manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

    const htmlContent = fs.readFileSync(path.join("src", "index.html"), "utf8");
    const updatedHtml = htmlContent
      .replace('href="/main.css"', `href="/${manifest["main.css"]}"`)
      .replace('src="/main.js"', `src="/${manifest["main.js"]}"`);
    fs.writeFileSync(path.join("dist", "index.html"), updatedHtml);
  } catch (e) {
    console.error("Error processing HTML:", e);
  }
}

const config = {
  entryPoints: ["src/main.tsx"],
  bundle: true,
  outdir: "dist",
  sourcemap: true,
  minify: isProd,
  entryNames: "[dir]/[name]-[hash]",
  assetNames: "assets/[name]-[hash]",
  plugins: [
    manifestPlugin({
      filename: "manifest.json",
      shortNames: true,
    }),
    {
      name: "type-check",
      setup(build) {
        build.onStart(typeCheck);
      },
    },
    {
      name: "css-hash",
      setup(build) {
        build.onEnd(buildCss);
      },
    },
    {
      name: "html-copy",
      setup(build) {
        build.onEnd(writeHtml);
      },
    },
    {
      name: "static-copy",
      setup(build) {
        build.onEnd(() => {
          console.log("Copying static files...");
          try {
            // Create dist directory if it doesn't exist
            if (!fs.existsSync("dist")) {
              fs.mkdirSync("dist", { recursive: true });
            }
            
            // Create static directory if it doesn't exist
            if (!fs.existsSync("static")) {
              fs.mkdirSync("static", { recursive: true });
            }
            
            // Copy all files from static to dist
            const staticFiles = fs.readdirSync("static");
            for (const file of staticFiles) {
              fs.copyFileSync(
                path.join("static", file),
                path.join("dist", file)
              );
            }
            console.log(`Copied ${staticFiles.length} static files to dist`);
          } catch (e) {
            console.error("Error copying static files:", e);
          }
        });
      },
    },
  ],
  loader: {
    ".tsx": "tsx",
    ".ts": "ts",
    ".js": "jsx",
  },
  define: {
    "process.env.NODE_ENV": `"${process.env.NODE_ENV || "development"}"`,
  },
};

const watch = process.argv.includes("--watch");

if (watch) {
  console.log("Initial build.");
  esbuild.build(config).catch(() => console.error("Build error"));
  console.log("Starting watch.");
  chokidar.watch(["./main.css", "src"]).on("change", (event, path) => {
    console.log("Change detected.", event, path);
    esbuild.build(config).catch(() => console.error("Build error"));
  });
} else {
  esbuild.build(config).catch(() => process.exit(1));
}
