import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      familyId: string;
      familyName: string;
      appName: string;
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    familyId: string;
    familyName: string;
    appName: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    name: string;
    familyId: string;
    familyName: string;
    appName: string;
  }
}
