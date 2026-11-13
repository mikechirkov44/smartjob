import { test } from "node:test";
import assert from "node:assert/strict";
import { preserveNewerEdits, forgetAttempt } from "./editor-state.ts";
test("pending save never overwrites newer typing", () =>
  assert.deepEqual(
    preserveNewerEdits({ title: "new" }, { title: "old" }, { title: "old" }),
    { title: "new" },
  ));
test("canonical response applies if the editor stayed unchanged", () =>
  assert.deepEqual(
    preserveNewerEdits(
      { title: "old" },
      { title: "old" },
      { title: "trimmed" },
    ),
    { title: "trimmed" },
  ));
test("transient resume failures retain bearer token", () => {
  assert.equal(forgetAttempt({ status: 500 }), false);
  assert.equal(forgetAttempt(new Error("offline")), false);
  assert.equal(forgetAttempt({ status: 404 }), true);
});
