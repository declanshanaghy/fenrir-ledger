"use client";

/**
 * ConsoleSignature — easter egg #4.
 *
 * Prints the Fenrir ASCII art to the browser console once per session.
 * Runs only in the browser; sessionStorage prevents duplicate prints
 * across hot-reloads in development.
 *
 * Gleipnir was made of six impossible things. Can you find them all?
 */

import { useEffect } from "react";

export function ConsoleSignature() {
  useEffect(() => {
    if (sessionStorage.getItem("fenrir:console-signed")) return;
    sessionStorage.setItem("fenrir:console-signed", "1");

    const art = `
   |      | |    |   |   |--       |      |--
   |\\     |/|    |\\  |   |  \\      |      |  \\
   | \\    | |    | \\ |   |--       |      |--
   |\\     |\\|    |  \\|   |  \\      |      |  \\
   | \\    | |    |   |   |   \\     |      |   \\
   |      | |    |   |   |         |      |
   |      | |    |   |   |         |      |
`;
    const runeLabel = `  ᚠ FEHU    ᛖ EHWAZ   ᚾ NAUDIZ   ᚱ RAIDHO    ᛁ ISA    ᚱ RAIDHO`;

    console.log("%c" + art, "color:#c9920a;font-family:monospace;font-size:11px;line-height:1.3");
    console.log("%c" + runeLabel, "color:#c9920a;font-family:monospace;font-size:10px;letter-spacing:1px");
    console.log("%cYou opened the forge, mortal. 🐺", "color:#f0b429;font-size:14px;font-family:monospace;font-weight:bold");
    console.log("%cFenrir sees all chains. Including yours.", "color:#8a8578;font-size:12px;font-family:monospace");
    console.log("%c ", "font-size:4px");
    console.log("%cBuilt by FiremanDecko  ·  Guarded by Freya  ·  Tested by Loki", "color:#3d3d52;font-size:11px;font-family:monospace");
    console.log("%cOdin bound Fenrir. Fenrir built Ledger.", "color:#2a2d45;font-size:10px;font-family:monospace;font-style:italic");
  }, []);

  return null;
}
