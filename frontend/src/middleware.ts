export { auth as middleware } from "@/auth";

export const config = {
  matcher: [
    /*
     * Protect all routes except:
     * - /login and /api/auth/* (auth pages and handlers)
     * - /_next/* (Next.js internals)
     * - /favicon.ico, static files
     */
    "/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
