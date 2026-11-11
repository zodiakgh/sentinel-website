import test from "node:test";
import assert from "node:assert/strict";
import { validateMonitorUrl } from "./index.js";

const rejects = (value) => assert.throws(() => validateMonitorUrl(value), { status: 400 });

test("accepts public HTTP and HTTPS hostnames and removes fragments", () => {
  assert.equal(validateMonitorUrl("https://example.com/health#fragment"), "https://example.com/health");
  assert.equal(validateMonitorUrl("http://status.example.org:80/ping"), "http://status.example.org/ping");
});

test("rejects non-string, oversized and malformed URLs", () => {
  rejects(null);
  rejects("x".repeat(2049));
  rejects("not a url");
});

test("rejects unsupported schemes, credentials and non-standard ports", () => {
  rejects("ftp://example.com");
  rejects("https://user:pass@example.com");
  rejects("https://example.com:8443");
});

test("rejects local, single-label and internal hostnames including trailing-dot variants", () => {
  for (const host of [
    "localhost", "localhost.", "api.localhost", "printer.local",
    "metadata.internal", "service.test", "router.lan", "nas.home.arpa",
    "intranet", "example.com."
  ]) rejects("https://" + host + "/");
});

test("rejects private, reserved and all literal IP address targets", () => {
  for (const host of [
    "127.0.0.1", "10.0.0.1", "172.16.0.1", "192.168.1.1",
    "169.254.169.254", "100.64.0.1", "224.0.0.1", "8.8.8.8",
    "2130706433", "0x7f000001", "0177.0.0.1", "[::1]", "[2606:4700:4700::1111]"
  ]) rejects("http://" + host + "/");
});
