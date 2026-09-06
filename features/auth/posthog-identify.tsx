"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import posthog from "posthog-js";
import { useEffect } from "react";

/**
 * Ties browser events to the same person the server attributes its events to.
 *
 * Both sides key on Clerk's user id, so a session's client and server events
 * land on one profile instead of two halves that never join up. On sign-out the
 * queue is reset, otherwise the next visitor on a shared machine inherits the
 * previous person's identity.
 *
 * `isLoaded` matters: Clerk reports `userId` as null while it is still
 * resolving, and identifying on that would label a signed-in session anonymous
 * for its first moments.
 */
export const PostHogIdentify = () => {
  const { isLoaded, userId } = useAuth();
  const { user } = useUser();

  useEffect(() => {
    if (!isLoaded) return;

    if (userId === null) {
      posthog.reset();
      return;
    }

    posthog.identify(userId, {
      email: user?.primaryEmailAddress?.emailAddress,
    });
  }, [isLoaded, userId, user]);

  return null;
};
