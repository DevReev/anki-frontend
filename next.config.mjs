// AFTER
/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    resolveAlias: {
      canvas: "./empty-module.js",
    },
  },
};

export default nextConfig;
// /** @type {import('next').NextConfig} */
// const nextConfig = {
//   webpack: (config, { isServer }) => {
//     config.resolve.alias = {
//       ...config.resolve.alias,
//       canvas: false,
//     };
//     return config;
//   },
// };

// module.exports = nextConfig;
