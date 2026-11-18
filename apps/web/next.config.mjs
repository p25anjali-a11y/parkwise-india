const security = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  // Report-only for now: enforcing a CSP needs a pass with real traffic (MapLibre workers, Razorpay checkout frames).
  {
    key: "Content-Security-Policy-Report-Only",
    value: "default-src 'self'; img-src 'self' data: blob: https://tile.openstreetmap.org; script-src 'self' 'unsafe-inline' https://checkout.razorpay.com; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://tile.openstreetmap.org https://api.razorpay.com; frame-src https://api.razorpay.com https://checkout.razorpay.com; worker-src 'self' blob:; frame-ancestors 'none'",
  },
];

/** @type {import('next').NextConfig} */
export default {
  transpilePackages: ["@parkwise/pricing", "@parkwise/forecast", "@parkwise/providers", "@parkwise/ingestion"],
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: security }];
  },
};
