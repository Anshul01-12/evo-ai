import { useState, useRef, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Mic, MicOff, Volume2, Terminal, ChevronDown, ChevronUp } from "lucide-react";

interface CommandLog {
  id: string;
  transcript: string;
  action: string;
  timestamp: string;
}

interface CommandResult {
  action: string;
  speak: string;
  url?: string;
  windowTarget?: string; // named window target to reuse tabs
  callback?: () => void;
}

interface Contact {
  name: string;
  phone: string; // with country code, e.g. "919876543210"
}

// ─── Contacts Manager (localStorage) ────────────────────────────

function getContacts(): Contact[] {
  try {
    return JSON.parse(localStorage.getItem("evo_contacts") || "[]");
  } catch { return []; }
}

function saveContact(name: string, phone: string): Contact {
  const contacts = getContacts();
  const cleaned = phone.replace(/[\s\-+()]/g, "");
  const existing = contacts.findIndex((c) => c.name.toLowerCase() === name.toLowerCase());
  const contact = { name: name.toLowerCase(), phone: cleaned };
  if (existing >= 0) contacts[existing] = contact;
  else contacts.push(contact);
  localStorage.setItem("evo_contacts", JSON.stringify(contacts));
  return contact;
}

function findContact(name: string): Contact | undefined {
  return getContacts().find((c) => c.name.toLowerCase() === name.toLowerCase());
}

function removeContact(name: string): boolean {
  const contacts = getContacts();
  const filtered = contacts.filter((c) => c.name.toLowerCase() !== name.toLowerCase());
  if (filtered.length === contacts.length) return false;
  localStorage.setItem("evo_contacts", JSON.stringify(filtered));
  return true;
}

// ─── Smart Window Manager ────────────────────────────────────────
// Reuses existing tabs by using named window targets

const managedWindows: Record<string, Window | null> = {};

function smartOpen(url: string, target: string = "_blank"): Window | null {
  // If we have a reference to an existing window with this name, reuse it
  const existing = managedWindows[target];
  if (existing && !existing.closed) {
    existing.focus();
    // Only navigate if it's a different URL (avoid reloading same page)
    try {
      if (existing.location.href !== url) {
        existing.location.href = url;
      }
    } catch {
      // Cross-origin — can't read href, just focus
    }
    return existing;
  }
  // Open with named target — browser reuses tab with same name
  const win = window.open(url, target);
  if (win) managedWindows[target] = win;
  return win;
}

// ─── Desktop App Launcher ────────────────────────────────────────
// Windows apps with registered URI protocol schemes

interface AppInfo {
  name: string;
  protocol: string;       // URI scheme to open desktop app
  webUrl: string;          // fallback web URL for "in browser" mode
  windowTarget: string;    // named target for tab reuse
}

const DESKTOP_APPS: Record<string, AppInfo> = {
  // ── Chat & Social ──
  whatsapp: { name: "WhatsApp", protocol: "whatsapp://", webUrl: "https://web.whatsapp.com", windowTarget: "whatsapp" },
  slack: { name: "Slack", protocol: "slack://", webUrl: "https://app.slack.com", windowTarget: "slack" },
  discord: { name: "Discord", protocol: "discord://", webUrl: "https://discord.com/app", windowTarget: "discord" },
  telegram: { name: "Telegram", protocol: "tg://", webUrl: "https://web.telegram.org", windowTarget: "telegram" },
  skype: { name: "Skype", protocol: "skype://", webUrl: "https://web.skype.com", windowTarget: "skype" },

  // ── Media ──
  spotify: { name: "Spotify", protocol: "spotify://", webUrl: "https://open.spotify.com", windowTarget: "spotify" },
  netflix: { name: "Netflix", protocol: "netflix://", webUrl: "https://netflix.com", windowTarget: "netflix" },

  // ── Meetings ──
  zoom: { name: "Zoom", protocol: "zoommtg://", webUrl: "https://zoom.us/join", windowTarget: "zoom" },
  teams: { name: "Microsoft Teams", protocol: "msteams://", webUrl: "https://teams.microsoft.com", windowTarget: "teams" },
  "microsoft teams": { name: "Microsoft Teams", protocol: "msteams://", webUrl: "https://teams.microsoft.com", windowTarget: "teams" },

  // ── Productivity ──
  notion: { name: "Notion", protocol: "notion://", webUrl: "https://notion.so", windowTarget: "notion" },
  figma: { name: "Figma", protocol: "figma://", webUrl: "https://figma.com", windowTarget: "figma" },
  outlook: { name: "Outlook", protocol: "ms-outlook://", webUrl: "https://outlook.live.com", windowTarget: "outlook" },
  onenote: { name: "OneNote", protocol: "onenote://", webUrl: "https://onenote.com", windowTarget: "onenote" },
  "one note": { name: "OneNote", protocol: "onenote://", webUrl: "https://onenote.com", windowTarget: "onenote" },
  word: { name: "Microsoft Word", protocol: "ms-word://", webUrl: "https://word.new", windowTarget: "word" },
  excel: { name: "Microsoft Excel", protocol: "ms-excel://", webUrl: "https://excel.new", windowTarget: "excel" },
  powerpoint: { name: "PowerPoint", protocol: "ms-powerpoint://", webUrl: "https://powerpoint.new", windowTarget: "powerpoint" },

  // ── Dev Tools ──
  vscode: { name: "VS Code", protocol: "vscode://", webUrl: "https://vscode.dev", windowTarget: "vscode" },
  "vs code": { name: "VS Code", protocol: "vscode://", webUrl: "https://vscode.dev", windowTarget: "vscode" },
  "visual studio code": { name: "VS Code", protocol: "vscode://", webUrl: "https://vscode.dev", windowTarget: "vscode" },
  "visual studio": { name: "Visual Studio", protocol: "visualstudio://", webUrl: "", windowTarget: "" },

  // ── Browsers ──
  edge: { name: "Microsoft Edge", protocol: "microsoft-edge:https://google.com", webUrl: "", windowTarget: "" },
  chrome: { name: "Google Chrome", protocol: "googlechrome://", webUrl: "", windowTarget: "" },
  firefox: { name: "Firefox", protocol: "firefox://", webUrl: "", windowTarget: "" },

  // ── Windows Built-in Apps ──
  settings: { name: "Settings", protocol: "ms-settings:", webUrl: "", windowTarget: "" },
  calculator: { name: "Calculator", protocol: "calculator:", webUrl: "https://www.google.com/search?q=calculator", windowTarget: "calculator" },
  camera: { name: "Camera", protocol: "microsoft.windows.camera:", webUrl: "", windowTarget: "" },
  clock: { name: "Clock", protocol: "ms-clock:", webUrl: "", windowTarget: "" },
  alarms: { name: "Alarms & Clock", protocol: "ms-clock:", webUrl: "", windowTarget: "" },
  maps: { name: "Maps", protocol: "bingmaps:", webUrl: "https://maps.google.com", windowTarget: "maps" },
  paint: { name: "Paint", protocol: "ms-paint:", webUrl: "", windowTarget: "" },
  photos: { name: "Photos", protocol: "ms-photos:", webUrl: "https://photos.google.com", windowTarget: "photos" },
  "snipping tool": { name: "Snipping Tool", protocol: "ms-screenclip:", webUrl: "", windowTarget: "" },
  snip: { name: "Snipping Tool", protocol: "ms-screenclip:", webUrl: "", windowTarget: "" },
  screenshot: { name: "Snipping Tool", protocol: "ms-screenclip:", webUrl: "", windowTarget: "" },
  store: { name: "Microsoft Store", protocol: "ms-windows-store:", webUrl: "", windowTarget: "" },
  "microsoft store": { name: "Microsoft Store", protocol: "ms-windows-store:", webUrl: "", windowTarget: "" },
  "windows store": { name: "Microsoft Store", protocol: "ms-windows-store:", webUrl: "", windowTarget: "" },
  xbox: { name: "Xbox", protocol: "xbox:", webUrl: "https://xbox.com", windowTarget: "xbox" },
  "xbox app": { name: "Xbox", protocol: "xbox:", webUrl: "https://xbox.com", windowTarget: "xbox" },
  mail: { name: "Mail", protocol: "ms-outlook:", webUrl: "https://outlook.live.com", windowTarget: "mail" },
  calendar: { name: "Calendar", protocol: "outlookcal:", webUrl: "https://calendar.google.com", windowTarget: "calendar" },
  "voice recorder": { name: "Voice Recorder", protocol: "ms-callrecording:", webUrl: "", windowTarget: "" },
  recorder: { name: "Voice Recorder", protocol: "ms-callrecording:", webUrl: "", windowTarget: "" },
  "file explorer": { name: "File Explorer", protocol: "explorer.exe:", webUrl: "", windowTarget: "" },
  explorer: { name: "File Explorer", protocol: "explorer.exe:", webUrl: "", windowTarget: "" },
  files: { name: "File Explorer", protocol: "explorer.exe:", webUrl: "", windowTarget: "" },
  notepad: { name: "Notepad", protocol: "notepad:", webUrl: "", windowTarget: "" },
  terminal: { name: "Terminal", protocol: "ms-terminal:", webUrl: "", windowTarget: "" },
  "command prompt": { name: "Terminal", protocol: "ms-terminal:", webUrl: "", windowTarget: "" },
  cmd: { name: "Terminal", protocol: "ms-terminal:", webUrl: "", windowTarget: "" },
  powershell: { name: "Terminal", protocol: "ms-terminal:", webUrl: "", windowTarget: "" },
  "task manager": { name: "Task Manager", protocol: "taskmgr:", webUrl: "", windowTarget: "" },
  weather: { name: "Weather", protocol: "bingweather:", webUrl: "https://weather.com", windowTarget: "weather" },
  "feedback hub": { name: "Feedback Hub", protocol: "feedback-hub:", webUrl: "", windowTarget: "" },
  tips: { name: "Tips", protocol: "ms-get-started:", webUrl: "", windowTarget: "" },
  "media player": { name: "Media Player", protocol: "mswindowsmusic:", webUrl: "", windowTarget: "" },
  music: { name: "Media Player", protocol: "mswindowsmusic:", webUrl: "", windowTarget: "" },
  movies: { name: "Movies & TV", protocol: "mswindowsvideo:", webUrl: "", windowTarget: "" },
  "movies and tv": { name: "Movies & TV", protocol: "mswindowsvideo:", webUrl: "", windowTarget: "" },
};

function launchDesktopApp(appName: string): CommandResult | null {
  const app = DESKTOP_APPS[appName];
  if (!app) return null;

  return {
    action: `Launch ${app.name} (desktop)`,
    speak: `Opening ${app.name}`,
    callback: () => {
      // Method 1: Create a clickable link — most reliable for protocol handlers
      const link = document.createElement("a");
      link.href = app.protocol;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      setTimeout(() => document.body.removeChild(link), 100);

      // Method 2: Fallback with window.open after a delay
      setTimeout(() => {
        try {
          window.open(app.protocol, "_self");
        } catch { /* silently fail */ }
      }, 300);
    },
  };
}


// ─── Spoken Number → Digit Converter ─────────────────────────────

const WORD_TO_DIGIT: Record<string, string> = {
  zero: "0", oh: "0", o: "0",
  one: "1", won: "1",
  two: "2", to: "2", too: "2",
  three: "3", tree: "3",
  four: "4", for: "4", fore: "4",
  five: "5",
  six: "6", sex: "6",
  seven: "7",
  eight: "8", ate: "8",
  nine: "9", niner: "9",
  double: "double", triple: "triple",
};

function spokenToDigits(input: string): string {
  // First, extract any actual digits already in the string
  const hasDigits = /\d/.test(input);
  if (hasDigits) {
    // Already has digits — just strip non-digit chars
    return input.replace(/[^\d]/g, "");
  }

  // Convert spoken words to digits
  const words = input.toLowerCase().split(/[\s,]+/);
  let result = "";
  let i = 0;

  while (i < words.length) {
    const word = words[i];

    // Handle "double [digit]" → repeat digit twice
    if ((word === "double" || word === "duble") && i + 1 < words.length) {
      const nextDigit = WORD_TO_DIGIT[words[i + 1]];
      if (nextDigit && nextDigit.length === 1) {
        result += nextDigit + nextDigit;
        i += 2;
        continue;
      }
    }

    // Handle "triple [digit]" → repeat digit three times
    if (word === "triple" && i + 1 < words.length) {
      const nextDigit = WORD_TO_DIGIT[words[i + 1]];
      if (nextDigit && nextDigit.length === 1) {
        result += nextDigit + nextDigit + nextDigit;
        i += 2;
        continue;
      }
    }

    // Handle compound words like "twenty", "thirty", etc.
    const tens: Record<string, string> = {
      ten: "10", eleven: "11", twelve: "12", thirteen: "13", fourteen: "14",
      fifteen: "15", sixteen: "16", seventeen: "17", eighteen: "18", nineteen: "19",
      twenty: "20", thirty: "30", forty: "40", fifty: "50",
      sixty: "60", seventy: "70", eighty: "80", ninety: "90",
    };
    if (tens[word]) {
      result += tens[word];
      i++;
      continue;
    }

    // Handle "hundred" / "thousand"
    if (word === "hundred" || word === "thousand" || word === "plus" || word === "and") {
      i++;
      continue;
    }

    const digit = WORD_TO_DIGIT[word];
    if (digit && digit.length === 1) {
      result += digit;
    }
    // If it's already a digit string in the word
    else if (/^\d+$/.test(word)) {
      result += word;
    }

    i++;
  }

  return result;
}

// ─── Command Parser Engine ───────────────────────────────────────

function parseCommand(text: string): CommandResult | null {
  const t = text.toLowerCase().trim();

  // ── Save / Add contact ──
  // "save contact Divyansh 9876543210"
  // "save contact Divyansh nine eight seven six five four three two one zero"
  // "add contact Rahul +91 98765 43210"
  const saveMatch = t.match(/(?:save|add|set)\s+contact\s+(\w+)\s+(.+)/);
  if (saveMatch) {
    const name = saveMatch[1];
    const rawPhone = saveMatch[2];
    const phone = spokenToDigits(rawPhone);
    if (phone.length < 5) {
      return {
        action: `Invalid number: "${rawPhone}" → "${phone}"`,
        speak: `I couldn't understand the phone number. Please say each digit clearly. For example: save contact ${name} nine one nine eight seven six five four three two one zero.`,
      };
    }
    const contact = saveContact(name, phone);
    return {
      action: `Saved contact: ${name} → ${contact.phone}`,
      speak: `Contact ${name} saved with number ${contact.phone}`,
    };
  }

  // "delete contact Divyansh" / "remove contact Divyansh"
  const deleteContactMatch = t.match(/(?:delete|remove)\s+contact\s+(\w+)/);
  if (deleteContactMatch) {
    const name = deleteContactMatch[1];
    const removed = removeContact(name);
    return removed
      ? { action: `Deleted contact: ${name}`, speak: `Contact ${name} has been deleted` }
      : { action: `Contact not found: ${name}`, speak: `I don't have a contact named ${name}` };
  }

  // "show contacts" / "list contacts" / "my contacts"
  if (t.includes("show contact") || t.includes("list contact") || t.includes("my contact")) {
    const contacts = getContacts();
    if (contacts.length === 0) {
      return { action: "No contacts saved", speak: "You don't have any saved contacts. Say 'save contact' followed by a name and phone number to add one." };
    }
    const names = contacts.map((c) => c.name).join(", ");
    return { action: `Contacts: ${names}`, speak: `You have ${contacts.length} contacts: ${names}` };
  }

  // ── WhatsApp: send message ──
  // "whatsapp Divyansh hello bro" / "send whatsapp to Divyansh hi"
  // "open whatsapp and send message to Divyansh hello"
  const waMsg = t.match(
    /(?:open\s+)?whatsapp\s+(?:and\s+)?(?:send\s+)?(?:message\s+)?(?:to\s+)?(\w+)\s+(.+)/
  );
  if (waMsg) {
    const contactName = waMsg[1];
    const msg = waMsg[2];
    const contact = findContact(contactName);

    if (contact) {
      // Saved with phone — go directly to their chat
      return {
        action: `WhatsApp → ${contactName}: "${msg}"`,
        speak: `Sending WhatsApp message to ${contactName}`,
        url: `https://web.whatsapp.com/send?phone=${contact.phone}&text=${encodeURIComponent(msg)}`,
        windowTarget: "whatsapp",
      };
    }
    // No phone saved — open WhatsApp Web, search for contact name, message is copied
    return {
      action: `WhatsApp → ${contactName}: "${msg}"`,
      speak: `Opening WhatsApp for ${contactName}. Message copied. Search ${contactName} and paste with control V.`,
      windowTarget: "whatsapp",
      callback: () => {
        // Copy message to clipboard
        navigator.clipboard.writeText(msg).catch(() => {});
        // Open WhatsApp Web (reuse tab if open)
        const win = smartOpen("https://web.whatsapp.com", "whatsapp");
        if (win) {
          // After WhatsApp loads, try to trigger search with the contact name
          setTimeout(() => {
            try {
              // Try to focus the search box and type contact name via URL hash
              // This won't work cross-origin, but the focus attempt is harmless
              win.focus();
            } catch { /* cross-origin, expected */ }
          }, 2000);
        }
      },
    };
  }

  // "message Divyansh on whatsapp hello"
  const msgWa2 = t.match(/message\s+(\w+)\s+(?:on\s+)?whatsapp\s+(.+)/);
  if (msgWa2) {
    const contactName = msgWa2[1];
    const msg = msgWa2[2];
    const contact = findContact(contactName);
    if (contact) {
      return {
        action: `WhatsApp → ${contactName}: "${msg}"`,
        speak: `Sending WhatsApp message to ${contactName}`,
        url: `https://web.whatsapp.com/send?phone=${contact.phone}&text=${encodeURIComponent(msg)}`,
        windowTarget: "whatsapp",
      };
    }
    return {
      action: `WhatsApp → ${contactName}: "${msg}"`,
      speak: `Opening WhatsApp for ${contactName}. Message copied. Search ${contactName} and paste.`,
      windowTarget: "whatsapp",
      callback: () => {
        navigator.clipboard.writeText(msg).catch(() => {});
        smartOpen("https://web.whatsapp.com", "whatsapp");
      },
    };
  }

  // "call Divyansh on whatsapp"
  const waCall = t.match(/call\s+(\w+)\s+(?:on\s+)?whatsapp/);
  if (waCall) {
    const contactName = waCall[1];
    const contact = findContact(contactName);
    if (contact) {
      return {
        action: `WhatsApp call → ${contactName}`,
        speak: `Opening WhatsApp to call ${contactName}. You'll need to start the call manually.`,
        url: `https://web.whatsapp.com/send?phone=${contact.phone}`,
        windowTarget: "whatsapp",
      };
    }
    return {
      action: `WhatsApp call → ${contactName}`,
      speak: `Opening WhatsApp. Please find ${contactName} in your contacts to start the call.`,
      url: `https://web.whatsapp.com`,
      windowTarget: "whatsapp",
    };
  }

  // "open whatsapp" → desktop app, "open whatsapp in chrome/browser" → web
  if (t.includes("whatsapp") && !waMsg && !msgWa2 && !waCall) {
    const inBrowser = t.includes("in chrome") || t.includes("in browser") || t.includes("in edge") || t.includes("in firefox") || t.includes("on browser") || t.includes("on chrome");
    if (inBrowser) {
      return {
        action: "Open WhatsApp (browser)",
        speak: "Opening WhatsApp Web in browser",
        url: "https://web.whatsapp.com",
        windowTarget: "whatsapp",
      };
    }
    return launchDesktopApp("whatsapp") || {
      action: "Open WhatsApp",
      speak: "Opening WhatsApp",
      url: "https://web.whatsapp.com",
      windowTarget: "whatsapp",
    };
  }

  // ── Generic App Messaging ──
  // "open slack and message to Mayank Gupta"
  // "open slack and send message to Mayank Gupta hello"
  // "open telegram and message Rahul hi there"
  // "open discord and message to John hello"
  // "message Mayank on slack hello"
  // "send message on slack to Mayank hi"
  const genericAppMsg = t.match(
    /(?:open\s+)?(\w+)\s+(?:and\s+)?(?:send\s+)?(?:message|msg|chat|text)\s+(?:to\s+)?(.+)/
  );
  if (genericAppMsg) {
    const appName = genericAppMsg[1].trim();
    const app = DESKTOP_APPS[appName];

    if (app) {
      // Split rest into contact name and message
      // "Mayank Gupta hello" or "Mayank Gupta" (no message)
      // Try to detect where the name ends — names are capitalized words at the start
      // We'll use original text (not lowercased) for better name detection
      const originalRest = text.replace(/.*(?:message|msg|chat|text)\s+(?:to\s+)?/i, "").trim();

      // If there's a web URL for this app, open it with the contact name copied
      const contactAndMsg = originalRest;

      return {
        action: `${app.name} → message: "${contactAndMsg}"`,
        speak: `Opening ${app.name} to message. The contact name and message have been copied to your clipboard.`,
        callback: () => {
          // Copy contact + message to clipboard
          navigator.clipboard.writeText(contactAndMsg).catch(() => {});

          // Launch desktop app
          const link = document.createElement("a");
          link.href = app.protocol;
          link.style.display = "none";
          document.body.appendChild(link);
          link.click();
          setTimeout(() => document.body.removeChild(link), 100);
        },
      };
    }
  }

  // "message Mayank on slack" / "message Rahul on telegram hello"
  const msgOnApp = t.match(/(?:send\s+)?(?:message|msg|chat|text)\s+(.+?)\s+on\s+(\w+)(?:\s+(.+))?/);
  if (msgOnApp) {
    const contactName = msgOnApp[1].trim();
    const appName = msgOnApp[2].trim();
    const msg = msgOnApp[3]?.trim() || "";
    const app = DESKTOP_APPS[appName];

    if (app) {
      const clipText = msg ? `${msg}` : contactName;
      return {
        action: `${app.name} → ${contactName}${msg ? `: "${msg}"` : ""}`,
        speak: `Opening ${app.name} to message ${contactName}.${msg ? " Message copied to clipboard." : ""}`,
        callback: () => {
          navigator.clipboard.writeText(clipText).catch(() => {});
          const link = document.createElement("a");
          link.href = app.protocol;
          link.style.display = "none";
          document.body.appendChild(link);
          link.click();
          setTimeout(() => document.body.removeChild(link), 100);
        },
      };
    }
  }

  // ── Messaging / Email ──
  const emailMatch = t.match(/(?:send\s+)?(?:an?\s+)?email\s+to\s+([\w.@]+)\s*(?:saying\s+|subject\s+|about\s+)?(.+)?/);
  if (emailMatch) {
    const to = emailMatch[1];
    const subject = emailMatch[2] || "";
    return {
      action: `Email → ${to}`,
      speak: `Opening email to ${to}`,
      url: `mailto:${to}?subject=${encodeURIComponent(subject)}`,
    };
  }
  if (t.includes("open gmail") || t.includes("open email") || t.includes("open mail")) {
    return { action: "Open Gmail", speak: "Opening Gmail", url: "https://mail.google.com" };
  }

  // ── Websites / Apps (web versions) ──
  const sites: Record<string, { name: string; url: string }> = {
    youtube: { name: "YouTube", url: "https://youtube.com" },
    google: { name: "Google", url: "https://google.com" },
    github: { name: "GitHub", url: "https://github.com" },
    chatgpt: { name: "ChatGPT", url: "https://chat.openai.com" },
    "chat gpt": { name: "ChatGPT", url: "https://chat.openai.com" },
    linkedin: { name: "LinkedIn", url: "https://linkedin.com" },
    twitter: { name: "X/Twitter", url: "https://x.com" },
    "x.com": { name: "X/Twitter", url: "https://x.com" },
    instagram: { name: "Instagram", url: "https://instagram.com" },
    facebook: { name: "Facebook", url: "https://facebook.com" },
    reddit: { name: "Reddit", url: "https://reddit.com" },
    netflix: { name: "Netflix", url: "https://netflix.com" },
    spotify: { name: "Spotify", url: "https://open.spotify.com" },
    amazon: { name: "Amazon", url: "https://amazon.com" },
    flipkart: { name: "Flipkart", url: "https://flipkart.com" },
    stackoverflow: { name: "Stack Overflow", url: "https://stackoverflow.com" },
    "stack overflow": { name: "Stack Overflow", url: "https://stackoverflow.com" },
    telegram: { name: "Telegram", url: "https://web.telegram.org" },
    discord: { name: "Discord", url: "https://discord.com/app" },
    notion: { name: "Notion", url: "https://notion.so" },
    figma: { name: "Figma", url: "https://figma.com" },
    canva: { name: "Canva", url: "https://canva.com" },
    "google maps": { name: "Google Maps", url: "https://maps.google.com" },
    maps: { name: "Google Maps", url: "https://maps.google.com" },
    "google drive": { name: "Google Drive", url: "https://drive.google.com" },
    drive: { name: "Google Drive", url: "https://drive.google.com" },
    "google docs": { name: "Google Docs", url: "https://docs.google.com" },
    "google sheets": { name: "Google Sheets", url: "https://sheets.google.com" },
    "google slides": { name: "Google Slides", url: "https://slides.google.com" },
    calendar: { name: "Google Calendar", url: "https://calendar.google.com" },
    "google calendar": { name: "Google Calendar", url: "https://calendar.google.com" },
    translate: { name: "Google Translate", url: "https://translate.google.com" },
    "google translate": { name: "Google Translate", url: "https://translate.google.com" },
    wikipedia: { name: "Wikipedia", url: "https://wikipedia.org" },
    pinterest: { name: "Pinterest", url: "https://pinterest.com" },
    twitch: { name: "Twitch", url: "https://twitch.tv" },
    "google photos": { name: "Google Photos", url: "https://photos.google.com" },
    photos: { name: "Google Photos", url: "https://photos.google.com" },
    "google meet": { name: "Google Meet", url: "https://meet.google.com" },
    zoom: { name: "Zoom", url: "https://zoom.us/join" },
    teams: { name: "Microsoft Teams", url: "https://teams.microsoft.com" },
    "microsoft teams": { name: "Microsoft Teams", url: "https://teams.microsoft.com" },
    outlook: { name: "Outlook", url: "https://outlook.live.com" },
    "chat.openai": { name: "ChatGPT", url: "https://chat.openai.com" },
    claude: { name: "Claude AI", url: "https://claude.ai" },
    gemini: { name: "Google Gemini", url: "https://gemini.google.com" },
    perplexity: { name: "Perplexity", url: "https://perplexity.ai" },
  };

  // Match "open [app/site]" with "in chrome/browser" detection
  const openMatch = t.match(/^open\s+(.+)/);
  if (openMatch) {
    let siteName = openMatch[1].trim();
    const inBrowser = siteName.includes(" in chrome") || siteName.includes(" in browser") || siteName.includes(" in edge") || siteName.includes(" in firefox") || siteName.includes(" on browser") || siteName.includes(" on chrome");
    // Strip "in chrome", "in browser", etc. from the name
    siteName = siteName.replace(/\s+(in|on)\s+(chrome|browser|edge|firefox|safari)$/i, "").trim();

    if (inBrowser) {
      // User explicitly wants browser — use web URL, reuse tab
      const app = DESKTOP_APPS[siteName];
      if (app && app.webUrl) {
        return { action: `Open ${app.name} (browser)`, speak: `Opening ${app.name} in browser`, url: app.webUrl, windowTarget: app.windowTarget };
      }
      const site = sites[siteName];
      if (site) {
        return { action: `Open ${site.name}`, speak: `Opening ${site.name} in browser`, url: site.url, windowTarget: siteName };
      }
    } else {
      // No "in browser" — try desktop app first, then web
      const desktopResult = launchDesktopApp(siteName);
      if (desktopResult) return desktopResult;

      const site = sites[siteName];
      if (site) {
        return { action: `Open ${site.name}`, speak: `Opening ${site.name}`, url: site.url, windowTarget: siteName };
      }
    }

    // Fallback: try opening as a URL
    if (siteName.includes(".")) {
      const url = siteName.startsWith("http") ? siteName : `https://${siteName}`;
      return { action: `Open ${siteName}`, speak: `Opening ${siteName}`, url };
    }
  }

  // "go to [site]"
  const goToMatch = t.match(/^go\s+to\s+(.+)/);
  if (goToMatch) {
    const siteName = goToMatch[1].trim();
    const site = sites[siteName];
    if (site) {
      return { action: `Go to ${site.name}`, speak: `Going to ${site.name}`, url: site.url, windowTarget: siteName };
    }
    if (siteName.includes(".")) {
      const url = siteName.startsWith("http") ? siteName : `https://${siteName}`;
      return { action: `Go to ${siteName}`, speak: `Going to ${siteName}`, url };
    }
  }

  // ── Search engines ──
  const searchMatch = t.match(/^(?:search|google|look up|find)\s+(?:for\s+)?(.+)/);
  if (searchMatch) {
    const query = searchMatch[1].trim();
    return {
      action: `Search: "${query}"`,
      speak: `Searching Google for ${query}`,
      url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    };
  }

  // "youtube search [query]"
  const ytSearch = t.match(/(?:youtube|yt)\s+search\s+(?:for\s+)?(.+)/);
  if (ytSearch) {
    const q = ytSearch[1].trim();
    return {
      action: `YouTube search: "${q}"`,
      speak: `Searching YouTube for ${q}`,
      url: `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
    };
  }

  // "play [song] on youtube"
  const playMatch = t.match(/play\s+(.+?)(?:\s+on\s+youtube)?$/);
  if (playMatch && (t.includes("play") && (t.includes("youtube") || t.includes("song") || t.includes("music")))) {
    const q = playMatch[1].replace(/\s+on\s+youtube$/, "").trim();
    return {
      action: `Play: "${q}"`,
      speak: `Playing ${q} on YouTube`,
      url: `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
    };
  }

  // ── Calculator / Math ──
  const calcMatch = t.match(/(?:calculate|what is|what's|how much is|solve)\s+([\d\s+\-*/().%^]+)/);
  if (calcMatch) {
    try {
      const expr = calcMatch[1].replace(/x/g, "*").replace(/\^/g, "**");
      const result = Function(`"use strict"; return (${expr})`)();
      return { action: `${calcMatch[1].trim()} = ${result}`, speak: `The answer is ${result}` };
    } catch {
      return { action: `Calc error: ${calcMatch[1]}`, speak: "Sorry, I couldn't calculate that" };
    }
  }

  // ── Date & Time ──
  if (t.includes("what time") || t.includes("current time") || t.includes("tell me the time") || t === "time") {
    const now = new Date().toLocaleTimeString();
    return { action: `Time: ${now}`, speak: `The current time is ${now}` };
  }
  if (t.includes("what date") || t.includes("today's date") || t.includes("what is the date") || t.includes("what day")) {
    const now = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    return { action: `Date: ${now}`, speak: `Today is ${now}` };
  }

  // ── Browser controls ──
  if (t.includes("scroll down")) {
    return { action: "Scroll down", speak: "Scrolling down", callback: () => window.scrollBy(0, 500) };
  }
  if (t.includes("scroll up")) {
    return { action: "Scroll up", speak: "Scrolling up", callback: () => window.scrollBy(0, -500) };
  }
  if (t.includes("scroll to top") || t.includes("go to top")) {
    return { action: "Scroll to top", speak: "Scrolling to top", callback: () => window.scrollTo(0, 0) };
  }
  if (t.includes("scroll to bottom") || t.includes("go to bottom")) {
    return { action: "Scroll to bottom", speak: "Scrolling to bottom", callback: () => window.scrollTo(0, document.body.scrollHeight) };
  }
  if (t.includes("go back") || t.includes("go backward") || t.includes("previous page")) {
    return { action: "Go back", speak: "Going back", callback: () => window.history.back() };
  }
  if (t.includes("go forward") || t.includes("next page")) {
    return { action: "Go forward", speak: "Going forward", callback: () => window.history.forward() };
  }
  if (t.includes("refresh") || t.includes("reload page") || t.includes("reload")) {
    return { action: "Refresh page", speak: "Refreshing the page", callback: () => window.location.reload() };
  }
  if (t.includes("close tab") || t.includes("close this tab")) {
    return { action: "Close tab", speak: "Closing this tab", callback: () => window.close() };
  }
  if (t.includes("full screen") || t.includes("fullscreen")) {
    return {
      action: "Toggle fullscreen",
      speak: "Toggling fullscreen",
      callback: () => {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen();
      },
    };
  }
  if (t.includes("print") || t.includes("print page") || t.includes("print this")) {
    return { action: "Print page", speak: "Opening print dialog", callback: () => window.print() };
  }
  if (t.includes("zoom in")) {
    return {
      action: "Zoom in",
      speak: "Zooming in",
      callback: () => { document.body.style.zoom = `${(parseFloat(document.body.style.zoom || "1") + 0.1)}`; },
    };
  }
  if (t.includes("zoom out")) {
    return {
      action: "Zoom out",
      speak: "Zooming out",
      callback: () => { document.body.style.zoom = `${(parseFloat(document.body.style.zoom || "1") - 0.1)}`; },
    };
  }
  if (t.includes("reset zoom") || t.includes("normal zoom")) {
    return { action: "Reset zoom", speak: "Resetting zoom", callback: () => { document.body.style.zoom = "1"; } };
  }

  // ── Clipboard ──
  const copyMatch = t.match(/copy\s+(?:text\s+)?(.+)/);
  if (copyMatch) {
    const copyText = copyMatch[1].trim();
    return {
      action: `Copied: "${copyText}"`,
      speak: `Copied to clipboard`,
      callback: () => navigator.clipboard.writeText(copyText),
    };
  }

  // ── Notifications ──
  if (t.includes("remind me") || t.includes("set reminder") || t.includes("set alarm") || t.includes("set timer")) {
    const timerMatch = t.match(/(?:in|after)\s+(\d+)\s*(second|minute|min|hour)/);
    const reminderTextMatch = t.match(/(?:to|about|that)\s+(.+?)(?:\s+in\s+\d|$)/);
    if (timerMatch) {
      const num = parseInt(timerMatch[1]);
      const unit = timerMatch[2];
      const ms = unit.startsWith("hour") ? num * 3600000 : unit.startsWith("min") ? num * 60000 : num * 1000;
      const reminderText = reminderTextMatch?.[1] || "Time's up!";
      return {
        action: `Timer: ${num} ${unit}(s) — "${reminderText}"`,
        speak: `Setting a reminder for ${num} ${unit}${num > 1 ? "s" : ""}`,
        callback: () => {
          Notification.requestPermission().then((perm) => {
            if (perm === "granted") {
              setTimeout(() => {
                new Notification("Evo Reminder", { body: reminderText, icon: "/favicon.ico" });
                window.speechSynthesis.speak(new SpeechSynthesisUtterance(reminderText));
              }, ms);
            }
          });
        },
      };
    }
  }

  // ── Translate ──
  const translateMatch = t.match(/translate\s+(.+?)\s+(?:to|in)\s+(\w+)/);
  if (translateMatch) {
    const phrase = translateMatch[1];
    const lang = translateMatch[2];
    return {
      action: `Translate: "${phrase}" → ${lang}`,
      speak: `Opening Google Translate`,
      url: `https://translate.google.com/?sl=auto&tl=${lang}&text=${encodeURIComponent(phrase)}`,
    };
  }

  // ── Weather ──
  if (t.includes("weather")) {
    const locMatch = t.match(/weather\s+(?:in|at|for)\s+(.+)/);
    const loc = locMatch ? locMatch[1] : "";
    return {
      action: `Weather${loc ? ` in ${loc}` : ""}`,
      speak: `Checking the weather${loc ? ` in ${loc}` : ""}`,
      url: `https://www.google.com/search?q=weather+${encodeURIComponent(loc || "today")}`,
    };
  }

  // ── News ──
  if (t.includes("news") || t.includes("headlines")) {
    const topicMatch = t.match(/(?:news|headlines)\s+(?:about|on)\s+(.+)/);
    const topic = topicMatch ? topicMatch[1] : "";
    return {
      action: `News${topic ? `: ${topic}` : ""}`,
      speak: `Checking the latest news${topic ? ` about ${topic}` : ""}`,
      url: `https://news.google.com/search?q=${encodeURIComponent(topic || "")}`,
    };
  }

  // ── Directions / Navigation ──
  const dirMatch = t.match(/(?:directions?|navigate|how to get)\s+(?:to|from)?\s*(.+)/);
  if (dirMatch) {
    const dest = dirMatch[1].trim();
    return {
      action: `Directions to ${dest}`,
      speak: `Getting directions to ${dest}`,
      url: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`,
    };
  }

  // ── Dark/Light mode ──
  if (t.includes("dark mode") || t.includes("dark theme")) {
    return {
      action: "Dark mode",
      speak: "Switching to dark mode",
      callback: () => document.documentElement.classList.add("dark"),
    };
  }
  if (t.includes("light mode") || t.includes("light theme")) {
    return {
      action: "Light mode",
      speak: "Switching to light mode",
      callback: () => document.documentElement.classList.remove("dark"),
    };
  }

  // ── Wikipedia lookup ──
  const wikiMatch = t.match(/(?:who is|what is|tell me about|wikipedia)\s+(.+)/);
  if (wikiMatch) {
    const q = wikiMatch[1].trim();
    return {
      action: `Wikipedia: "${q}"`,
      speak: `Looking up ${q} on Wikipedia`,
      url: `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(q)}`,
    };
  }

  // ── Jokes ──
  if (t.includes("tell me a joke") || t.includes("joke")) {
    const jokes = [
      "Why do programmers prefer dark mode? Because light attracts bugs!",
      "Why was the JavaScript developer sad? Because he didn't Node how to Express himself.",
      "There are only 10 kinds of people in the world: those who understand binary and those who don't.",
      "A SQL query walks into a bar, walks up to two tables, and asks... 'Can I join you?'",
      "Why do Java developers wear glasses? Because they can't C sharp!",
    ];
    const joke = jokes[Math.floor(Math.random() * jokes.length)];
    return { action: `Joke told`, speak: joke };
  }

  // ── Greetings ──
  if (t === "hello" || t === "hi" || t === "hey" || t.includes("hello evo") || t.includes("hey evo")) {
    return { action: "Greeting", speak: "Hello! I'm Evo voice command. How can I help you?" };
  }
  if (t.includes("thank") || t.includes("thanks")) {
    return { action: "Thanks", speak: "You're welcome! Let me know if you need anything else." };
  }
  if (t.includes("how are you")) {
    return { action: "Status", speak: "I'm doing great! Ready to help you with commands." };
  }
  if (t.includes("who are you") || t.includes("what are you") || t.includes("your name")) {
    return { action: "Identity", speak: "I'm Evo, your voice controlled AI assistant, built by Anshul." };
  }

  // ── Help ──
  if (t === "help" || t.includes("what can you do") || t.includes("list commands")) {
    return {
      action: "Help requested",
      speak: "I can open websites, search Google and YouTube, send WhatsApp messages, send emails, do calculations, set reminders, check weather, get directions, translate text, tell jokes, and much more. Just speak naturally!",
    };
  }

  // ── Stop listening ──
  if (t === "stop" || t === "stop listening" || t === "shut up" || t === "be quiet") {
    return { action: "Stop", speak: "Okay, going quiet." };
  }

  return null;
}

// ─── Component ───────────────────────────────────────────────────

type Status = "idle" | "listening" | "processing" | "speaking";

export function VoiceCommand() {
  const [status, setStatus] = useState<Status>("idle");
  const [transcript, setTranscript] = useState("");
  const [logs, setLogs] = useState<CommandLog[]>([]);
  const [continuous, setContinuous] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAllCommands, setShowAllCommands] = useState(false);
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef(window.speechSynthesis);
  const continuousRef = useRef(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const SpeechRecognition =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const supported = !!SpeechRecognition;

  // Keep ref in sync
  useEffect(() => { continuousRef.current = continuous; }, [continuous]);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Request notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const speak = useCallback((text: string, onDone?: () => void) => {
    if (!synthRef.current) { onDone?.(); return; }
    synthRef.current.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onstart = () => setStatus("speaking");
    utterance.onend = () => { setStatus("idle"); onDone?.(); };
    utterance.onerror = () => { setStatus("idle"); onDone?.(); };
    synthRef.current.speak(utterance);
  }, []);

  const startListening = useCallback(() => {
    if (!SpeechRecognition) {
      setError("Speech recognition not supported. Try Chrome or Edge.");
      return;
    }

    synthRef.current?.cancel();
    setError(null);
    setTranscript("");

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    let finalTranscript = "";

    recognition.onresult = (event: any) => {
      let interim = "";
      finalTranscript = "";
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setTranscript(finalTranscript || interim);
    };

    recognition.onend = () => {
      setStatus("idle");
      if (finalTranscript.trim()) {
        handleResultFn(finalTranscript.trim());
      } else if (continuousRef.current) {
        setTimeout(() => startListening(), 300);
      }
    };

    recognition.onerror = (event: any) => {
      setStatus("idle");
      if (event.error !== "no-speech" && event.error !== "aborted") {
        setError(`Speech error: ${event.error}`);
      }
      if (continuousRef.current && (event.error === "no-speech" || event.error === "aborted")) {
        setTimeout(() => startListening(), 500);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setStatus("listening");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [SpeechRecognition]);

  const handleResultFn = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      setStatus("processing");
      const result = parseCommand(text);

      if (result) {
        // Check for stop command
        if (result.action === "Stop") {
          setContinuous(false);
          continuousRef.current = false;
          speak(result.speak);
          setLogs((prev) => [...prev, { id: crypto.randomUUID(), transcript: text, action: result.action, timestamp: new Date().toLocaleTimeString() }]);
          return;
        }

        setLogs((prev) => [...prev, { id: crypto.randomUUID(), transcript: text, action: result.action, timestamp: new Date().toLocaleTimeString() }]);

        speak(result.speak, () => {
          if (continuousRef.current) startListening();
        });

        if (result.url) {
          setTimeout(() => smartOpen(result.url!, result.windowTarget || "_blank"), 500);
        }
        if (result.callback) {
          setTimeout(() => result.callback!(), 300);
        }
      } else {
        setLogs((prev) => [...prev, { id: crypto.randomUUID(), transcript: text, action: "Command not recognized", timestamp: new Date().toLocaleTimeString() }]);
        speak("Sorry, I didn't understand that. Say 'help' to see what I can do.", () => {
          if (continuousRef.current) startListening();
        });
      }
    },
    [speak, startListening]
  );

  const stopListening = useCallback(() => {
    recognitionRef.current?.abort();
    synthRef.current?.cancel();
    setContinuous(false);
    continuousRef.current = false;
    setStatus("idle");
  }, []);

  const toggleContinuous = useCallback(() => {
    if (continuous) {
      stopListening();
    } else {
      setContinuous(true);
      continuousRef.current = true;
      startListening();
    }
  }, [continuous, stopListening, startListening]);

  // Cleanup
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      synthRef.current?.cancel();
    };
  }, []);

  const STATUS_CONFIG: Record<Status, { label: string; color: string }> = {
    idle: { label: "Idle", color: "bg-gray-300" },
    listening: { label: "Listening...", color: "bg-emerald-500" },
    processing: { label: "Processing...", color: "bg-yellow-500" },
    speaking: { label: "Speaking...", color: "bg-blue-500" },
  };

  const cfg = STATUS_CONFIG[status];

  const COMMAND_CATEGORIES = [
    {
      title: "Desktop Apps (opens app directly)",
      commands: [
        `"Open WhatsApp"`, `"Open Slack"`, `"Open Discord"`,
        `"Open Telegram"`, `"Open Spotify"`, `"Open VS Code"`,
        `"Open Xbox"`, `"Open File Explorer"`, `"Open Calculator"`,
        `"Open Settings"`, `"Open Notepad"`, `"Open Paint"`,
        `"Open Camera"`, `"Open Snipping Tool"`, `"Open Terminal"`,
        `"Open Edge"`, `"Open Microsoft Store"`, `"Open Task Manager"`,
        `"Open Word"`, `"Open Excel"`, `"Open PowerPoint"`,
      ],
    },
    {
      title: "In Browser (opens/reuses tab)",
      commands: [
        `"Open WhatsApp in Chrome"`, `"Open Slack in browser"`,
        `"Open YouTube"`, `"Open Google"`, `"Open GitHub"`,
        `"Open ChatGPT"`, `"Open Gmail"`, `"Open Instagram"`,
        `"Open Netflix"`, `"Open Google Maps"`,
        `"Open [any website]"`, `"Go to reddit.com"`,
      ],
    },
    {
      title: "Messaging (any app)",
      commands: [
        `"Open Slack and message to Mayank Gupta"`,
        `"Open Discord and message to John hello"`,
        `"Open Telegram and message Rahul hi"`,
        `"Message Mayank on Slack hello"`,
        `"WhatsApp Divyansh hello bro"`,
        `"Call Divyansh on WhatsApp"`,
        `"Send email to john@gmail.com about meeting"`,
      ],
    },
    {
      title: "Contacts (for direct WhatsApp)",
      commands: [
        `"Save contact Divyansh nine one nine eight seven six..."`,
        `"Save contact Rahul 918765432109"`,
        `"Save contact Amit double nine eight seven six five..."`,
        `"Show contacts"`,
        `"Delete contact Divyansh"`,
      ],
    },
    {
      title: "Search & Play",
      commands: [
        `"Search for React tutorials"`, `"Google machine learning"`,
        `"YouTube search funny cats"`, `"Play Arijit Singh on YouTube"`,
        `"Look up JavaScript promises"`,
      ],
    },
    {
      title: "Tools & Utilities",
      commands: [
        `"Calculate 25 * 4 + 10"`, `"What is 100 / 7"`,
        `"What time is it?"`, `"What's the date?"`,
        `"Weather in Delhi"`, `"News about technology"`,
        `"Translate hello to Spanish"`, `"Directions to Mumbai"`,
        `"Copy this text"`, `"Set reminder in 5 minutes"`,
      ],
    },
    {
      title: "Browser Controls",
      commands: [
        `"Scroll down"`, `"Scroll up"`, `"Scroll to top"`,
        `"Go back"`, `"Go forward"`, `"Refresh"`,
        `"Fullscreen"`, `"Zoom in"`, `"Zoom out"`,
        `"Print page"`, `"Close tab"`,
      ],
    },
    {
      title: "Info & Fun",
      commands: [
        `"Who is Elon Musk"`, `"What is quantum computing"`,
        `"Tell me a joke"`, `"Hello"`, `"How are you"`,
        `"Who are you"`, `"Help"`, `"Stop listening"`,
      ],
    },
  ];

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-evo-bg">
      {/* Header */}
      <header className="h-14 flex items-center justify-between px-5 border-b border-evo-border shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center">
            <Terminal size={14} className="text-violet-600" />
          </div>
          <span className="text-sm font-semibold text-evo-text">Voice Command</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${cfg.color}`} />
          <span className="text-xs text-evo-muted">{cfg.label}</span>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center px-5 py-8 overflow-y-auto">
        {!supported ? (
          <div className="text-center mt-20">
            <p className="text-evo-text font-medium mb-2">Browser Not Supported</p>
            <p className="text-sm text-evo-muted">
              Speech recognition requires Chrome, Edge, or Safari.
            </p>
          </div>
        ) : (
          <div className="w-full max-w-lg flex flex-col items-center">
            {/* Mic Button */}
            <div className="relative inline-flex items-center justify-center mb-6">
              {status === "listening" && (
                <>
                  <motion.div
                    className="absolute w-36 h-36 rounded-full bg-emerald-200"
                    animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.2, 0.5] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                  />
                  <motion.div
                    className="absolute w-28 h-28 rounded-full bg-emerald-300"
                    animate={{ scale: [1, 1.2, 1], opacity: [0.6, 0.3, 0.6] }}
                    transition={{ repeat: Infinity, duration: 1.5, delay: 0.2 }}
                  />
                </>
              )}
              {status === "speaking" && (
                <motion.div
                  className="absolute w-36 h-36 rounded-full bg-blue-200"
                  animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.2, 0.4] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                />
              )}
              <button
                onClick={() => {
                  if (status === "listening") stopListening();
                  else if (status === "idle") startListening();
                  else if (status === "speaking") { synthRef.current?.cancel(); setStatus("idle"); }
                }}
                disabled={status === "processing"}
                className={`relative z-10 w-24 h-24 rounded-full flex items-center justify-center transition-all shadow-lg ${
                  status === "listening"
                    ? "bg-emerald-500 text-white scale-110"
                    : status === "speaking"
                      ? "bg-blue-500 text-white"
                      : "bg-white border-2 border-evo-border text-evo-muted hover:border-evo-accent hover:text-evo-accent"
                } disabled:opacity-50`}
              >
                {status === "listening" ? (
                  <MicOff size={32} />
                ) : status === "speaking" ? (
                  <Volume2 size={32} />
                ) : (
                  <Mic size={32} />
                )}
              </button>
            </div>

            {/* Status text */}
            <p className="text-sm text-evo-muted mb-1">
              {status === "idle" ? "Tap the mic or enable continuous mode" : cfg.label}
            </p>

            {/* Continuous toggle */}
            <button
              onClick={toggleContinuous}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors mb-4 ${
                continuous
                  ? "bg-emerald-50 border-emerald-300 text-emerald-600"
                  : "border-evo-border text-evo-muted hover:border-evo-accent hover:text-evo-accent"
              }`}
            >
              {continuous ? "Continuous: ON" : "Continuous: OFF"}
            </button>

            {/* Live transcript */}
            {transcript && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full bg-white rounded-xl px-4 py-3 border border-evo-border mb-4 text-sm text-evo-text text-center"
              >
                "{transcript}"
              </motion.div>
            )}

            {/* Error */}
            {error && (
              <div className="w-full rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 mb-4">
                {error}
              </div>
            )}

            {/* Available commands */}
            <div className="w-full bg-evo-card rounded-xl border border-evo-border p-4 mb-4">
              <button
                onClick={() => setShowAllCommands(!showAllCommands)}
                className="w-full flex items-center justify-between"
              >
                <p className="text-xs font-semibold text-evo-muted uppercase tracking-wider">
                  Available Commands ({COMMAND_CATEGORIES.reduce((a, c) => a + c.commands.length, 0)})
                </p>
                {showAllCommands ? <ChevronUp size={14} className="text-evo-muted" /> : <ChevronDown size={14} className="text-evo-muted" />}
              </button>

              {showAllCommands && (
                <div className="mt-3 space-y-3">
                  {COMMAND_CATEGORIES.map((cat) => (
                    <div key={cat.title}>
                      <p className="text-[11px] font-semibold text-evo-accent mb-1.5">{cat.title}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {cat.commands.map((cmd, i) => (
                          <span key={i} className="text-[11px] bg-white rounded-lg px-2 py-1 border border-evo-border text-evo-text">
                            {cmd}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!showAllCommands && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="text-[11px] bg-white rounded-lg px-2 py-1 border border-evo-border">"Open WhatsApp"</span>
                  <span className="text-[11px] bg-white rounded-lg px-2 py-1 border border-evo-border">"Search for..."</span>
                  <span className="text-[11px] bg-white rounded-lg px-2 py-1 border border-evo-border">"WhatsApp [name] [msg]"</span>
                  <span className="text-[11px] bg-white rounded-lg px-2 py-1 border border-evo-border">"Calculate..."</span>
                  <span className="text-[11px] bg-white rounded-lg px-2 py-1 border border-evo-border">"Help"</span>
                </div>
              )}
            </div>

            {/* Command Logs */}
            {logs.length > 0 && (
              <div className="w-full">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-evo-muted uppercase tracking-wider">Command Log</p>
                  <button
                    onClick={() => setLogs([])}
                    className="text-[10px] text-evo-muted hover:text-red-400 transition-colors"
                  >
                    Clear
                  </button>
                </div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {logs.map((log) => (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="bg-white rounded-xl border border-evo-border px-4 py-3"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-evo-muted">{log.timestamp}</span>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                          log.action === "Command not recognized"
                            ? "bg-red-50 text-red-500"
                            : "bg-emerald-50 text-emerald-600"
                        }`}>
                          {log.action === "Command not recognized" ? "Unknown" : "Executed"}
                        </span>
                      </div>
                      <p className="text-sm text-evo-text mb-0.5">"{log.transcript}"</p>
                      <p className="text-xs text-evo-accent">{log.action}</p>
                    </motion.div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
