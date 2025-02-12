const esbuild = require('esbuild-wasm');
const manifestPlugin = require('esbuild-plugin-manifest');
const fs = require('fs');
const path = require('path');

const watch = process.argv.includes('--watch');
const isProd = process.env.NODE_ENV === 'production';

async function buildCss() {
  try {
    // Ensure dist directory exists
    if (!fs.existsSync("dist")) {
      fs.mkdirSync("dist", { recursive: true });
    }

    // Run tailwindcss CLI command
    const tailwindBin = path.resolve("./node_modules/.bin/tailwindcss");
    require("child_process").execSync(
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
    const hash = require("crypto")
      .createHash("md5")
      .update(cssContent)
      .digest("hex");

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
      name: "css-hash",
      setup(build) {
        build.onEnd(buildCss);
      },
    },
    {
      name: "html-copy",
      setup(build) {
        build.onEnd(async () => {
          try {
            const manifestPath = path.join("dist", "manifest.json");
            const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
            
            const htmlContent = fs.readFileSync(path.join("src", "index.html"), "utf8");
            const updatedHtml = htmlContent
              .replace('href="/main.css"', `href="/${manifest['main.css']}"`)
              .replace('src="/main.js"', `src="/${manifest['main.js']}"`)
            fs.writeFileSync(path.join("dist", "index.html"), updatedHtml);
          } catch (e) {
            console.error("Error processing HTML:", e);
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

if (watch) {
  esbuild
    .context(config)
    .then(ctx => ctx.watch())
    .catch(() => process.exit(1));
} else {
  esbuild.build(config).catch(() => process.exit(1));
}
