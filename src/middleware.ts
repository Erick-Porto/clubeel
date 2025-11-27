export { default } from "next-auth/middleware"

export const config = { 
  matcher: [
    "/",
    "/profile",
    "/checkout",
    "/cart",
    "/places/:path*",
    "/place/:path*",
  ] 
}