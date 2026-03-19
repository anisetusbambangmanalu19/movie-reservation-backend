declare namespace Express {
  interface Request {
    user?: {
      id: string;
      role: "ADMIN" | "USER";
      email: string;
    };
  }
}
