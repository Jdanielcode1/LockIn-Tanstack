import { defineApp } from "convex/server";
import r2 from "@convex-dev/r2/convex.config";
import betterAuth from "@convex-dev/better-auth/convex.config";
import autumn from "@useautumn/convex/convex.config";

const app = defineApp();
app.use(r2);
app.use(betterAuth);
app.use(autumn);

export default app;

