import { clerkMiddleware } from "@clerk/nextjs/server";

/**
 * Next 16 renamed `middleware.ts` to `proxy.ts`, and Clerk's own guidance is to
 * name this file by the `next` version in package.json: `proxy.ts` on 16 and
 * above, `middleware.ts` on 15 and below. This project is on 16.3.3.
 *
 * `clerkMiddleware()` runs with no route matcher on purpose. It makes `auth()`
 * available everywhere without forcing a session anywhere. Feature 8 requires
 * that anyone can open a thread's link and read it without an account, and that
 * only sending a prompt and voting need signing in, so protection belongs on
 * those two actions rather than at the edge. A `createRouteMatcher` guard here
 * would quietly break the shareable links that make the product shareable.
 */
export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest))(?:.*)|api|trpc)(.*)",
  ],
};
