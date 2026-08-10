export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/expedientes",
    "/api/expedientes/:path*",
    "/api/liquidaciones",
    "/api/liquidaciones/:path*",
    "/api/contribuyentes",
    "/api/contribuyentes/:path*"
  ]
};
