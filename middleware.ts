import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized: ({ token }) => {
      // Ensure the user has a valid token with a familyId
      // This forces old sessions to be logged out and redirects to /login
      return !!token && !!token.familyId;
    },
  },
});

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes - handled separately)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (metadata files)
     * - login (auth pages)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|login).*)",
  ],
};
