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
    "/recipes/:path*",
    "/history/:path*",
    "/grocery/:path*",
    "/api/recipes/:path*",
    "/api/history/:path*",
    "/api/grocery/:path*",
    "/api/parse/:path*",
  ],
};
