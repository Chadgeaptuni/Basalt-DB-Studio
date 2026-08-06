import { describe, it, expect } from "vitest";
import { matchScore, filterRank } from "./filter";

describe("matchScore", () => {
  it("matches a subsequence, not just a substring", () => {
    expect(matchScore("order_items", "ordit")).not.toBeNull();
    expect(matchScore("order_items", "oi")).not.toBeNull();
  });

  it("rejects characters that are not present in order", () => {
    expect(matchScore("users", "xyz")).toBeNull();
    expect(matchScore("users", "sru")).toBeNull(); // right letters, wrong order
  });

  it("treats an empty query as a match", () => {
    expect(matchScore("anything", "")).toBe(0);
  });

  it("is case-insensitive in both directions", () => {
    expect(matchScore("UserAccounts", "usera")).not.toBeNull();
    expect(matchScore("user_accounts", "USER")).not.toBeNull();
  });

  it("ranks a consecutive run above scattered hits", () => {
    const consecutive = matchScore("users", "user")!;
    const scattered = matchScore("uxsxexr", "user")!;
    expect(consecutive).toBeGreaterThan(scattered);
  });

  it("ranks a word-boundary hit above a mid-word one", () => {
    const boundary = matchScore("order_items", "i")!;
    const midWord = matchScore("shipping", "i")!;
    expect(boundary).toBeGreaterThan(midWord);
  });

  it("breaks ties toward the shorter target", () => {
    expect(matchScore("users", "users")!).toBeGreaterThan(matchScore("users_audit_log", "users")!);
  });
});

describe("filterRank", () => {
  const tables = ["users", "user_sessions", "orders", "order_items", "audit_log"];
  const id = (s: string): string => s;

  it("preserves input order when the query is empty", () => {
    expect(filterRank(tables, "  ", id)).toEqual(tables);
  });

  it("drops non-matches and ranks the best match first", () => {
    const hits = filterRank(tables, "user", id);
    expect(hits).toEqual(["users", "user_sessions"]);
  });

  it("returns nothing when no candidate matches", () => {
    expect(filterRank(tables, "zzz", id)).toEqual([]);
  });

  it("ranks by the supplied key, not the item", () => {
    const rows = [{ name: "orders" }, { name: "users" }];
    expect(filterRank(rows, "user", (r) => r.name)).toEqual([{ name: "users" }]);
  });
});
