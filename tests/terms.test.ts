import { test } from "node:test";
import assert from "node:assert/strict";
import { fromThaiInput, periodStatus, toThaiInput } from "../lib/terms";
import type { Term } from "../lib/types";
const term: Term = { term_id:"test",academic_year:2569,semester:1,opens_at:"2026-09-01T01:00:00.000Z",closes_at:"2026-10-01T17:00:00.000Z",enabled:1,is_current:1,announcement:"" };
test("opens exactly at the start and closes exactly at the deadline",()=>{
  assert.equal(periodStatus(term,Date.parse(term.opens_at!)-1),"scheduled");
  assert.equal(periodStatus(term,Date.parse(term.opens_at!)),"open");
  assert.equal(periodStatus(term,Date.parse(term.closes_at!)-1),"open");
  assert.equal(periodStatus(term,Date.parse(term.closes_at!)),"closed");
  assert.equal(periodStatus({...term,enabled:0},Date.parse(term.opens_at!)),"paused");
  assert.equal(periodStatus({...term,is_current:0},Date.parse(term.opens_at!)),"paused");
});
test("Bangkok datetime input has an explicit UTC+7 offset independent of local timezone",()=>{
  assert.equal(fromThaiInput("2026-10-02T00:00"),"2026-10-01T17:00:00.000Z");
  assert.equal(toThaiInput("2026-10-01T17:00:00.000Z"),"2026-10-02T00:00");
});
