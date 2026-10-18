import { expect, it } from "vitest";
import { feedReturnState, readFeedReturn } from "./feedReturn";

it.each([
  "/?q=office&sort=newest&type=question&answer_status=unanswered",
  "/t/education?sort=latest&type=discussion",
  "/",
  "/saved?q=office",
  "/saved",
  "/u/dana?view=replies",
  "/u/demo_avery",
])("preserves local feed navigation: %s", (path) => {
  expect(readFeedReturn(feedReturnState(path))).toBe(path);
});

it.each([
  undefined,
  null,
  "https://example.test",
  {},
  { feedReturn: 42 },
  { feedReturn: "//example.test" },
  { feedReturn: "https://example.test/" },
  { feedReturn: "/\\example.test" },
  { feedReturn: "/\n/elsewhere" },
  { feedReturn: "/settings" },
  { feedReturn: "/u/dana/extra" },
  { feedReturn: "/u/dana%2Fother" },
  { feedReturn: "/u/a" },
  { feedReturn: "/u/name%3Ftoken" },
  { feedReturn: "/u/dana#reply-x" },
  { feedReturn: "/u/name-with-dash" },
  { feedReturn: "/saved/elsewhere" },
  { feedReturn: "/saved#reply-other" },
  { feedReturn: "/threads/id" },
  { feedReturn: "/sign-in" },
  { feedReturn: "/t/education/elsewhere" },
  { feedReturn: "/t/education%2Fother" },
  { feedReturn: "/#reply-other" },
])("discards non-feed or malformed navigation state: %j", (state) => {
  expect(readFeedReturn(state)).toBeNull();
});
