const esbuild = require('esbuild-wasm');

const watch = process.argv.includes('--watch');

const config = {
  entryPoints: ['src/main.tsx'],
  bundle: true,
  outdir: 'dist',
  sourcemap: true,
  minify: process.env.NODE_ENV === 'production',
  plugins: [],
  loader: {
    '.tsx': 'tsx',
    '.ts': 'ts',
    '.js': 'jsx',
  },
  define: {
    'process.env.NODE_ENV': `"${process.env.NODE_ENV || 'development'}"`,
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
