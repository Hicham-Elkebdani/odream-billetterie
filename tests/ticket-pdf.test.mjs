import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { PDFDocument } from "pdf-lib";
import ts from "typescript";

test("le billet O’Dream Beach produit un PDF avec QR et logo AEI", async () => {
  const output = resolve("tmp/pdfs/ticket-pdf.mjs");
  mkdirSync(resolve("tmp/pdfs"), { recursive: true });
  const options = { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } };
  const font = ts.transpileModule(readFileSync(resolve("lib/font-data.ts"), "utf8"), options).outputText;
  const types = ts.transpileModule(readFileSync(resolve("lib/types.ts"), "utf8"), options).outputText;
  const ticketSource = readFileSync(resolve("lib/ticket-pdf.ts"), "utf8");
  const ticketCode = ts.transpileModule(ticketSource, options).outputText.replace('from "./font-data"', 'from "./font-data.mjs"').replace('from "./types"', 'from "./types.mjs"');
  writeFileSync(resolve("tmp/pdfs/font-data.mjs"), font);
  writeFileSync(resolve("tmp/pdfs/types.mjs"), types);
  writeFileSync(output, ticketCode);
  const { makeTicketPDF } = await import(pathToFileURL(output).href);
  const ticket = { id: crypto.randomUUID(), reference: "OD-TEST-0001", token: "ODR-" + "a".repeat(48), name: "Amine El Mansouri", email: "amine@example.com", phone: "", status: "paid", amountCents: 15000, createdAt: "2026-10-07T10:00:00.000Z", paidAt: "2026-10-07T10:01:00.000Z", cancelledAt: null, refundedAt: null, sentAt: null, emailError: null };
  const event = { name: "Journée d’intégration", date: "2026-12-12", time: "08:30", departure: "ENIAD BERKANE", destination: "Saïdia", priceCents: 15000, capacity: 100, program: "Football, volley-ball et jeux de plage.", checkpoints: [{ id: "entry", label: "Entrée" }, { id: "football", label: "Football" }, { id: "volleyball", label: "Volley-ball" }] };
  const bytes = await makeTicketPDF(ticket, event);
  assert.equal(Buffer.from(bytes.subarray(0, 5)).toString(), "%PDF-");
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), 1);
  assert.equal(pdf.getTitle(), "Journée d’intégration — OD-TEST-0001");
  writeFileSync(resolve("tmp/pdfs/billet-exemple.pdf"), bytes);
});
