window.__ModuleLoader__.load({
	id: "dsh-omarchy-agent",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);
var import_jsx_runtime = require("react/jsx-runtime");
var inject = ["slots"];
var TOOLS = [
  "omarchy_status",
  "omarchy_catalog",
  "omarchy_theme",
  "omarchy_hypr",
  "omarchy_diagnose",
  "omarchy_source",
  "omarchy_agent",
  "omarchy_plugin",
  "omarchy_shell",
  "omarchy_panel"
];
var LABELS = {
  omarchy_status: "Omarchy status",
  omarchy_catalog: "Omarchy commands",
  omarchy_theme: "Omarchy theme",
  omarchy_hypr: "Hyprland",
  omarchy_diagnose: "Omarchy diagnostics",
  omarchy_source: "Omarchy source",
  omarchy_agent: "Omarchy agents",
  omarchy_plugin: "Omarchy plugins",
  omarchy_shell: "Omarchy shell",
  omarchy_panel: "Harness panel"
};
function apply(ctx) {
  for (const tool of TOOLS) {
    ctx.slots.inject(
      "tool.call.toolview",
      () => ctx.slots.register({ name: "tool.call.toolview", key: tool }, OmarchyToolRow)
    );
  }
  installPromptBridge();
}
var PROMPT_ORIGIN = "http://127.0.0.1:3081";
function installPromptBridge() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  let lastId = 0;
  let polling = false;
  const poll = async () => {
    if (polling) return;
    polling = true;
    try {
      const response = await fetch(`${PROMPT_ORIGIN}/prompt?after=${lastId}`, { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      const id = typeof data.id === "number" ? data.id : 0;
      const text = typeof data.text === "string" ? data.text : null;
      if (text !== null && text.trim() !== "") {
        if (insertComposerText(text)) {
          lastId = id;
          await fetch(`${PROMPT_ORIGIN}/ack?id=${id}`, { cache: "no-store" });
        }
      } else if (id > lastId) {
        lastId = id;
      }
    } catch {
    } finally {
      polling = false;
    }
  };
  void poll();
  window.setInterval(() => void poll(), 1e3);
}
function insertComposerText(text) {
  const editors = Array.from(document.querySelectorAll('[data-lexical-editor="true"]')).filter(
    (editor2) => editor2.isContentEditable && editor2.getClientRects().length > 0
  );
  if (editors.length === 0) return false;
  const editor = editors.reduce(
    (best, candidate) => candidate.getBoundingClientRect().bottom > best.getBoundingClientRect().bottom ? candidate : best
  );
  editor.focus();
  const selection = window.getSelection();
  if (selection === null) return false;
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
  return document.execCommand("insertText", false, text);
}
function asRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
function asArray(value) {
  return Array.isArray(value) ? value : [];
}
function str(value) {
  return typeof value === "string" && value.length > 0 ? value : void 0;
}
function num(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : void 0;
}
function parseJson(text) {
  if (text.length === 0) return void 0;
  try {
    return JSON.parse(text);
  } catch {
    return void 0;
  }
}
function resultText(content) {
  const parts = [];
  for (const item of content) {
    const block = asRecord(item);
    if (block?.type === "text" && typeof block.text === "string") parts.push(block.text);
  }
  return parts.join("\n").trim();
}
function OmarchyToolRow(props) {
  const label = LABELS[props.toolName] ?? props.toolName;
  if (props.phase !== "result") {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, { label, summary: "running\u2026", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: muted, children: "Reading Omarchy state\u2026" }) });
  }
  const block = props.block;
  if (block.isError || block.error !== void 0) {
    const reason = block.error?.reason ?? block.error?.name ?? "The tool failed.";
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, { label, summary: block.error?.code ?? "failed", tone: "error", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: muted, children: reason }) });
  }
  const text = resultText(block.content);
  const value = parseJson(text);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, { label, summary: summaryOf(props.toolName, value), children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Body, { tool: props.toolName, value, text }) });
}
function summaryOf(tool, value) {
  const v = asRecord(value);
  if (v === void 0) return void 0;
  switch (tool) {
    case "omarchy_status": {
      const theme = str(v.theme);
      const monitors = asArray(v.monitors).length;
      return [theme, monitors > 0 ? `${monitors} display${monitors === 1 ? "" : "s"}` : void 0].filter((part) => part !== void 0).join(" \xB7 ") || void 0;
    }
    case "omarchy_catalog": {
      const count = num(v.count) ?? asArray(v.commands).length;
      return `${count} command${count === 1 ? "" : "s"}`;
    }
    case "omarchy_theme": {
      if (str(v.action) === "set") return str(v.theme) ?? (v.changed === true ? "changed" : "not changed");
      if (str(v.action) === "list") return `${asArray(v.themes).length} themes`;
      return str(v.theme);
    }
    case "omarchy_hypr": {
      const target = str(v.target) ?? "state";
      const data = asArray(v.data);
      return data.length > 0 ? `${target} \xB7 ${data.length}` : target;
    }
    case "omarchy_diagnose": {
      const crashes = asArray(v.crashes).length;
      const failed = asArray(v.systemUnits).length + asArray(v.userUnits).length;
      return `${crashes} crash${crashes === 1 ? "" : "es"} \xB7 ${failed} failed unit${failed === 1 ? "" : "s"}`;
    }
    case "omarchy_source": {
      const matches = asArray(v.matches).length;
      if (matches > 0) return `${matches} match${matches === 1 ? "" : "es"}`;
      const files = asArray(v.files).length;
      return `${files} file${files === 1 ? "" : "s"}`;
    }
    case "omarchy_agent": {
      if (str(v.action) === "usage") {
        const count = num(v.count) ?? asArray(v.records).length;
        return `${count} usage record${count === 1 ? "" : "s"}`;
      }
      const agent = str(v.defaultAgent) || "none";
      return `default: ${agent} \xB7 dsh ${v.supportsDsh === true ? "supported" : "not listed"}`;
    }
    case "omarchy_plugin": {
      if (str(v.action) === "validate") return v.ok === true ? "valid" : "invalid";
      const count = num(v.count) ?? asArray(v.plugins).length;
      return `${count} plugin${count === 1 ? "" : "s"}`;
    }
    case "omarchy_shell":
      return str(v.action);
    case "omarchy_panel":
      return str(v.action) === "activate" ? `activate ${str(v.id) ?? ""}` : "panel signals";
    default:
      return void 0;
  }
}
function Body({ tool, value, text }) {
  const v = asRecord(value);
  if (v === void 0) {
    return text.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", { style: pre, children: text }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: muted, children: "No result data." });
  }
  switch (tool) {
    case "omarchy_status": {
      const active = asRecord(v.activeWindow);
      const failed = asArray(v.failedUserUnits);
      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          Rows,
          {
            rows: [
              ["Theme", str(v.theme)],
              ["Hyprland", firstLine(str(v.hyprland))],
              ["Displays", asArray(v.monitors).length],
              ["Workspaces", asArray(v.workspaces).length],
              ["Active window", str(active?.title) ?? str(active?.class)],
              ["Failed user units", failed.length]
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Raw, { value: v })
      ] });
    }
    case "omarchy_theme": {
      const themes = asArray(v.themes).map((theme) => str(theme)).filter((theme) => theme !== void 0);
      if (themes.length > 0) {
        return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: chips, children: themes.map((theme) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: chip, children: theme }, theme)) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Raw, { value: v })
        ] });
      }
      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Rows, { rows: [["Action", str(v.action)], ["Theme", str(v.theme)], ["Changed", v.changed === true]] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Raw, { value: v })
      ] });
    }
    case "omarchy_catalog": {
      const commands = asArray(v.commands).map(asRecord).filter((command) => command !== void 0);
      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
        commands.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: muted, children: "No matching commands." }) : null,
        commands.slice(0, 8).map((command) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: row, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", { style: code, children: str(command.route) ?? "?" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: muted, children: str(command.summary) ?? "" })
        ] }, str(command.route) ?? JSON.stringify(command))),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Raw, { value: v })
      ] });
    }
    case "omarchy_hypr": {
      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Rows, { rows: [["Target", str(v.target)], ["Entries", asArray(v.data).length]] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Raw, { value: v })
      ] });
    }
    case "omarchy_diagnose": {
      const crashes = asArray(v.crashes).map((crash) => str(crash)).filter((crash) => crash !== void 0);
      const units = [...asArray(v.systemUnits), ...asArray(v.userUnits)].map((unit) => str(unit)).filter((unit) => unit !== void 0);
      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Rows, { rows: [["Crashes", crashes.length], ["Failed units", units.length]] }),
        crashes.slice(0, 4).map((crash) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: muted, children: crash }, crash)),
        units.slice(0, 4).map((unit) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: muted, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", { style: code, children: unit }) }, unit)),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Raw, { value: v })
      ] });
    }
    case "omarchy_source": {
      const matches = asArray(v.matches).map(asRecord).filter((match) => match !== void 0);
      const files = asArray(v.files).map(asRecord).filter((file) => file !== void 0);
      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
        matches.slice(0, 8).map((match) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: muted, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("code", { style: code, children: [
          str(match.file) ?? "?",
          ":",
          num(match.line) ?? 0
        ] }) }, `${str(match.file)}:${num(match.line)}`)),
        files.slice(0, 8).map((file) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: muted, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", { style: code, children: str(file.path) ?? "?" }) }, str(file.path) ?? "?")),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Raw, { value: v })
      ] });
    }
    case "omarchy_agent": {
      const records = asArray(v.records).map(asRecord).filter((record) => record !== void 0);
      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          Rows,
          {
            rows: [
              ["Default", str(v.defaultAgent) || "none"],
              ["dsh listed", v.supportsDsh === true],
              ["dsh installed", v.dshInstalled === true],
              ["Usage collector", v.usageCollector === true],
              ["Agents panel", v.agentsPanel === true]
            ]
          }
        ),
        records.slice(0, 8).map((record) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: row, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", { style: code, children: str(record.id) ?? "?" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: muted, children: str(record.usageStatusText) || str(record.tierLabel) || "" })
        ] }, str(record.id) ?? "?")),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Raw, { value: v })
      ] });
    }
    case "omarchy_plugin": {
      const plugins = asArray(v.plugins).map(asRecord).filter((plugin) => plugin !== void 0);
      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
        str(v.action) === "validate" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Rows, { rows: [["Valid", v.ok === true], ["Path", str(v.path)]] }) : plugins.slice(0, 8).map((plugin) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: row, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", { style: code, children: str(plugin.id) ?? "?" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: muted, children: plugin.enabled === true ? "enabled" : "disabled" })
        ] }, str(plugin.id) ?? "?")),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Raw, { value: v })
      ] });
    }
    case "omarchy_shell": {
      const data = v.data;
      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          Rows,
          {
            rows: [
              ["Action", str(v.action)],
              ["Entries", Array.isArray(data) ? data.length : void 0]
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Raw, { value: v })
      ] });
    }
    default:
      return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Raw, { value: v });
  }
}
function Rows({ rows }) {
  const visible = rows.filter(([, value]) => value !== void 0 && value !== "");
  if (visible.length === 0) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: grid, children: visible.map(([name, value]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, { name, value: String(value) }, name)) });
}
function Row({ name, value }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: row, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: muted, children: name }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { minWidth: 0, overflowWrap: "anywhere" }, children: value })
  ] });
}
function Raw({ value }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", { style: { marginTop: 6 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("summary", { style: summaryStyle, children: "Raw JSON" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", { style: pre, children: JSON.stringify(value, null, 2) })
  ] });
}
function firstLine(value) {
  return value?.split("\n")[0];
}
function Card({
  label,
  summary,
  tone,
  children
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { ...card, ...tone === "error" ? { borderColor: "rgba(255, 99, 99, 0.55)" } : {} }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: header, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "span",
        {
          style: {
            ...dot,
            background: tone === "error" ? "#ff6363" : "currentColor",
            opacity: tone === "error" ? 1 : 0.55
          }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontWeight: 600 }, children: label }),
      summary !== void 0 && summary.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: muted, children: summary }) : null
    ] }),
    children
  ] });
}
var card = {
  border: "1px solid rgba(127, 127, 127, 0.28)",
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 13,
  lineHeight: 1.45,
  overflow: "hidden"
};
var header = { display: "flex", alignItems: "center", gap: 8, marginBottom: 6 };
var dot = { width: 7, height: 7, borderRadius: 999, flex: "0 0 auto" };
var muted = { opacity: 0.7, fontSize: 12 };
var grid = { display: "grid", gap: 2 };
var row = { display: "flex", gap: 8, minWidth: 0, justifyContent: "space-between" };
var code = { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 };
var pre = {
  margin: "6px 0 0",
  padding: 8,
  borderRadius: 6,
  background: "rgba(127, 127, 127, 0.12)",
  fontSize: 11,
  lineHeight: 1.4,
  overflow: "auto",
  maxHeight: 240
};
var summaryStyle = { cursor: "pointer", fontSize: 12, opacity: 0.7 };
var chips = { display: "flex", flexWrap: "wrap", gap: 4 };
var chip = {
  border: "1px solid rgba(127, 127, 127, 0.28)",
  borderRadius: 999,
  padding: "1px 8px",
  fontSize: 12
};

		return module.exports;
	}
});
