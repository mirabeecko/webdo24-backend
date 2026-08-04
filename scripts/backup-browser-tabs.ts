#!/usr/bin/env tsx
/**
 * Zálohuje všechny otevřené taby z prohlížečů do Google Sheets.
 * Při každém spuštění vytvoří nový list pojmenovaný aktuálním datem a časem.
 *
 * Nastavení:
 * 1. Vytvoř service account v Google Cloud Console
 * 2. Stáhni JSON klíč a ulož ho jako: credentials/google-service-account.json
 * 3. Sdílej Google Sheet se service account emailem (editace)
 * 4. Do .env.local přidej: BACKUP_SPREADSHEET_ID=<id_tvoji_tabulky>
 *
 * Spuštění:
 *   npm run backup:tabs
 */

import { exec } from "child_process";
import { promisify } from "util";
import { google } from "googleapis";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as dotenv from "dotenv";

const execAsync = promisify(exec);

dotenv.config({ path: ".env.local" });

const SPREADSHEET_ID = process.env.BACKUP_SPREADSHEET_ID;
const CREDS_PATH = path.resolve("credentials/google-service-account.json");

interface BrowserConfig {
  app: string;
  engine: "safari" | "chrome";
}

const BROWSERS: BrowserConfig[] = [
  { app: "Safari", engine: "safari" },
  { app: "Google Chrome", engine: "chrome" },
  { app: "Microsoft Edge", engine: "chrome" },
  { app: "Brave Browser", engine: "chrome" },
  { app: "Vivaldi", engine: "chrome" },
  { app: "Opera", engine: "chrome" },
];

interface TabRow {
  browser: string;
  window: number;
  tab: number;
  title: string;
  url: string;
  active: string;
  tabsInWindow: number;
  timestamp: string;
}

function buildAppleScript(cfg: BrowserConfig): string {
  if (cfg.engine === "safari") {
    return `
tell application "${cfg.app}"
  set _result to ""
  set _winIndex to 1
  repeat with _w in windows
    try
      set _tabCount to (count tabs of _w)
      set _activeUrl to URL of current tab of _w
      set _tabIndex to 1
      repeat with _t in tabs of _w
        try
          set _title to name of _t
          set _url to URL of _t
          if _url is _activeUrl then
            set _active to "Ano"
          else
            set _active to "Ne"
          end if
          set _line to "${cfg.app}" & "\t" & _winIndex & "\t" & _tabIndex & "\t" & _title & "\t" & _url & "\t" & _active & "\t" & _tabCount & "\n"
          set _result to _result & _line
        end try
        set _tabIndex to _tabIndex + 1
      end repeat
    end try
    set _winIndex to _winIndex + 1
  end repeat
  return _result
end tell
`;
  }

  // Chrome-like
  return `
tell application "${cfg.app}"
  set _result to ""
  set _winIndex to 1
  repeat with _w in windows
    try
      set _tabCount to (count tabs of _w)
      set _activeTabIndex to active tab index of _w
      set _tabIndex to 1
      repeat with _t in tabs of _w
        try
          set _title to title of _t
          set _url to URL of _t
          if _tabIndex is _activeTabIndex then
            set _active to "Ano"
          else
            set _active to "Ne"
          end if
          set _line to "${cfg.app}" & "\t" & _winIndex & "\t" & _tabIndex & "\t" & _title & "\t" & _url & "\t" & _active & "\t" & _tabCount & "\n"
          set _result to _result & _line
        end try
        set _tabIndex to _tabIndex + 1
      end repeat
    end try
    set _winIndex to _winIndex + 1
  end repeat
  return _result
end tell
`;
}

async function getTabsFromBrowser(cfg: BrowserConfig): Promise<TabRow[]> {
  const script = buildAppleScript(cfg);
  const tmpFile = path.join(os.tmpdir(), `backup-tabs-${cfg.app.replace(/\s+/g, "-")}-${Date.now()}.scpt`);
  fs.writeFileSync(tmpFile, script, "utf8");

  try {
    const { stdout } = await execAsync(`osascript "${tmpFile}"`, { timeout: 30000 });
    const lines = stdout.trim().split("\n").filter(Boolean);
    const now = new Date().toLocaleString("cs-CZ");
    return lines.map((line) => {
      const parts = line.split("\t");
      return {
        browser: parts[0] || cfg.app,
        window: parseInt(parts[1] || "0", 10),
        tab: parseInt(parts[2] || "0", 10),
        title: parts[3] || "",
        url: parts[4] || "",
        active: parts[5] || "Ne",
        tabsInWindow: parseInt(parts[6] || "0", 10),
        timestamp: now,
      };
    });
  } catch (err: any) {
    if (err?.stderr?.includes("-1743") || err?.message?.includes("-1743")) {
      console.log(`⚠️  ${cfg.app}: zamítnuto oprávnění (povol v System Settings → Privacy → Automation)`);
    } else {
      console.log(`⏭️  ${cfg.app}: nenalezeno / nespuštěno`);
    }
    return [];
  } finally {
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}

async function getAllTabs(): Promise<TabRow[]> {
  const results: TabRow[] = [];
  for (const b of BROWSERS) {
    const tabs = await getTabsFromBrowser(b);
    if (tabs.length > 0) {
      results.push(...tabs);
      const wins = new Set(tabs.map((t) => t.window)).size;
      console.log(`✅ ${b.app}: ${tabs.length} tabů v ${wins} oknech`);
    }
  }
  return results;
}

function getSheetName(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${d}_${h}-${min}-${s}`;
}

async function uploadToGoogleSheets(rows: TabRow[]) {
  if (!fs.existsSync(CREDS_PATH)) {
    console.error(`❌ Credentials neexistují: ${CREDS_PATH}`);
    process.exit(1);
  }
  if (!SPREADSHEET_ID) {
    console.error("❌ Chybí BACKUP_SPREADSHEET_ID v .env.local");
    process.exit(1);
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: CREDS_PATH,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  const sheetName = getSheetName();

  // Vytvoř nový list
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: {
              title: sheetName,
              gridProperties: { rowCount: Math.max(rows.length + 20, 100), columnCount: 10 },
            },
          },
        },
      ],
    },
  });

  console.log(`📄 Vytvořen nový list: ${sheetName}`);

  // Data
  const values: (string | number)[][] = [
    ["Prohlížeč", "Okno #", "Tab #", "Název stránky", "URL", "Aktivní", "Tabů v okně", "Zálohováno"],
  ];
  for (const r of rows) {
    values.push([r.browser, r.window, r.tab, r.title, r.url, r.active, r.tabsInWindow, r.timestamp]);
  }

  // Statistiky
  const totalTabs = rows.length;
  const totalWindows = new Set(rows.map((r) => `${r.browser}-${r.window}`)).size;
  const activeBrowsers = new Set(rows.map((r) => r.browser)).size;
  const browsersList = [...new Set(rows.map((r) => r.browser))].join(", ");

  values.push([]);
  values.push(["─── STATISTIKY ───", "", "", "", "", "", "", ""]);
  values.push(["Celkem tabů:", totalTabs, "", "", "", "", "", ""]);
  values.push(["Celkem oken:", totalWindows, "", "", "", "", "", ""]);
  values.push(["Aktivních prohlížečů:", activeBrowsers, "", "", "", "", "", ""]);
  values.push(["Seznam prohlížečů:", browsersList, "", "", "", "", "", ""]);

  // Zapiš data
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1`,
    valueInputOption: "RAW",
    requestBody: { values },
  });

  // Formátování
  const sheetId = await getSheetId(sheets, SPREADSHEET_ID, sheetName);

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        // Hlavička tučně + šedá
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 8 },
            cell: {
              userEnteredFormat: {
                textFormat: { bold: true },
                backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 },
              },
            },
            fields: "userEnteredFormat(textFormat,backgroundColor)",
          },
        },
        // Aktivní taby zeleně
        {
          addConditionalFormatRule: {
            rule: {
              ranges: [{ sheetId, startColumnIndex: 5, endColumnIndex: 6, startRowIndex: 1 }],
              booleanRule: {
                condition: { type: "TEXT_EQ", values: [{ userEnteredValue: "Ano" }] },
                format: {
                  backgroundColor: { red: 0.85, green: 0.95, blue: 0.85 },
                  textFormat: { bold: true },
                },
              },
            },
            index: 0,
          },
        },
        // URL modře
        {
          repeatCell: {
            range: { sheetId, startColumnIndex: 4, endColumnIndex: 5, startRowIndex: 1 },
            cell: {
              userEnteredFormat: {
                textFormat: { foregroundColor: { red: 0.07, green: 0.33, blue: 0.8 } },
              },
            },
            fields: "userEnteredFormat(textFormat.foregroundColor)",
          },
        },
        // Statistiky tučně
        {
          repeatCell: {
            range: { sheetId, startRowIndex: values.length - 5, endRowIndex: values.length, startColumnIndex: 0, endColumnIndex: 2 },
            cell: { userEnteredFormat: { textFormat: { bold: true } } },
            fields: "userEnteredFormat.textFormat.bold",
          },
        },
        // Auto-resize sloupců
        {
          autoResizeDimensions: {
            dimensions: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 8 },
          },
        },
        // Zamrzlý řádek
        {
          updateSheetProperties: {
            properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
            fields: "gridProperties.frozenRowCount",
          },
        },
      ],
    },
  });

  console.log(`✅ Zálohováno ${rows.length} tabů do listu "${sheetName}"`);
  console.log(`🔗 https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit#gid=${sheetId}`);
}

async function getSheetId(sheets: any, spreadsheetId: string, sheetName: string): Promise<number> {
  const res = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = res.data.sheets.find((s: any) => s.properties.title === sheetName);
  return sheet?.properties?.sheetId ?? 0;
}

async function main() {
  console.log("🔍 Skenuji otevřené prohlížeče...\n");
  const tabs = await getAllTabs();

  if (tabs.length === 0) {
    console.log("\n❌ Nebyly nalezeny žádné taby.");
    console.log("   Zkontroluj, že máš spuštěné prohlížeče a povolil jim Automation oprávnění.");
    process.exit(0);
  }

  console.log(`\n📊 Celkem nalezeno: ${tabs.length} tabů\n`);
  await uploadToGoogleSheets(tabs);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
