import { SignIn } from "@clerk/nextjs";

/**
 * A catch-all route, which is what Clerk's own flows need: it appends steps
 * like verification and factor-two onto this path rather than navigating away.
 */
export default function SignInPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <SignIn />
    </main>
  );
}
