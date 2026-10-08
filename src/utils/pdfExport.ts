import { jsPDF } from "jspdf";

export interface ExportPdfOptions {
  title?: string;
  action?: string;
  tone?: string;
  format?: string;
  mode?: string;
  text: string;
  sources?: Array<{ title?: string; uri: string }>;
  notes?: string;
  wordCount?: number;
  charCount?: number;
}

interface InlineToken {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
}

/**
 * Tokenize a single line of markdown text into inline tokens (bold, italic, code, plain)
 */
function tokenizeInlineMarkdown(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  // Regex pattern matching:
  // `code`
  // **bold** or __bold__
  // *italic* or _italic_
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|(?<!\*)\*[^*]+(?!\*)|(?<!_)_[^_]+(?!_))/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ text: text.slice(lastIndex, match.index) });
    }

    const matchedStr = match[0];
    if (matchedStr.startsWith("`") && matchedStr.endsWith("`")) {
      tokens.push({ text: matchedStr.slice(1, -1), code: true });
    } else if (
      (matchedStr.startsWith("**") && matchedStr.endsWith("**")) ||
      (matchedStr.startsWith("__") && matchedStr.endsWith("__"))
    ) {
      tokens.push({ text: matchedStr.slice(2, -2), bold: true });
    } else if (
      (matchedStr.startsWith("*") && matchedStr.endsWith("*")) ||
      (matchedStr.startsWith("_") && matchedStr.endsWith("_"))
    ) {
      tokens.push({ text: matchedStr.slice(1, -1), italic: true });
    } else {
      tokens.push({ text: matchedStr });
    }

    lastIndex = match.index + matchedStr.length;
  }

  if (lastIndex < text.length) {
    tokens.push({ text: text.slice(lastIndex) });
  }

  return tokens.length > 0 ? tokens : [{ text }];
}

/**
 * Export generated AI result as a beautifully formatted PDF file
 */
export async function exportResultAsPdf(options: ExportPdfOptions): Promise<void> {
  const {
    title = "Generated Result",
    action,
    tone,
    format,
    mode,
    text,
    sources = [],
    notes,
    wordCount,
    charCount,
  } = options;

  if (!text || !text.trim()) {
    throw new Error("Cannot export empty result");
  }

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginLeft = 18;
  const marginRight = 18;
  const marginTop = 20;
  const marginBottom = 20;
  const contentWidth = pageWidth - marginLeft - marginRight;

  let cursorY = marginTop;

  // Helper to check if we need a new page
  const checkPageBreak = (neededHeight: number) => {
    if (cursorY + neededHeight > pageHeight - marginBottom) {
      doc.addPage();
      cursorY = marginTop;
      return true;
    }
    return false;
  };

  // ----------------------------------------------------
  // 1. BRAND & DOCUMENT HEADER
  // ----------------------------------------------------
  // Header bar background tint
  doc.setFillColor(248, 250, 252); // slate-50
  doc.rect(marginLeft - 2, cursorY - 2, contentWidth + 4, 32, "F");

  // Border outline for header
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.4);
  doc.rect(marginLeft - 2, cursorY - 2, contentWidth + 4, 32, "S");

  // Accent blue top bar
  doc.setFillColor(37, 99, 235); // blue-600
  doc.rect(marginLeft - 2, cursorY - 2, contentWidth + 4, 2.5, "F");

  // Logo / Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text("LEXISAI", marginLeft + 3, cursorY + 7);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text("INTELLIGENCE PLATFORM • EXPORT", marginLeft + 30, cursorY + 6.8);

  // Badge for Action/Tone
  const actionLabel = action
    ? action === "improve"
      ? "Grammar & Polish"
      : action.charAt(0).toUpperCase() + action.slice(1)
    : "AI Generation";

  doc.setFillColor(239, 246, 255); // blue-50
  doc.setDrawColor(191, 219, 254); // blue-200
  doc.roundedRect(pageWidth - marginRight - 48, cursorY + 4, 46, 6, 1.5, 1.5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(29, 78, 216); // blue-700
  doc.text(actionLabel.toUpperCase(), pageWidth - marginRight - 25, cursorY + 8.2, {
    align: "center",
  });

  // Metadata row (Date, Words, Tone, Mode)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105); // slate-600

  const now = new Date();
  const dateStr = now.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const metadataPieces: string[] = [`Date: ${dateStr}`];
  if (wordCount !== undefined && wordCount > 0) {
    metadataPieces.push(`${wordCount} words`);
  }
  if (charCount !== undefined && charCount > 0) {
    metadataPieces.push(`${charCount} chars`);
  }
  if (tone) {
    metadataPieces.push(`Tone: ${tone}`);
  }
  if (format && format !== "paragraph") {
    metadataPieces.push(`Format: ${format}`);
  }
  if (mode && mode !== "general") {
    metadataPieces.push(`Mode: ${mode}`);
  }

  doc.text(metadataPieces.join("  •  "), marginLeft + 3, cursorY + 16);

  // Document Heading Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text(title, marginLeft + 3, cursorY + 24);

  cursorY += 37;

  // ----------------------------------------------------
  // 2. PARSE BODY TEXT & MAINTAIN FORMATTING
  // ----------------------------------------------------
  const lines = text.split(/\r?\n/);
  let inCodeBlock = false;
  let codeBlockLines: string[] = [];

  const renderCodeBlock = (codeLines: string[]) => {
    if (codeLines.length === 0) return;
    const codeFontSize = 8.5;
    const lineHeight = 4.2;
    const blockPadding = 3.5;
    const blockHeight = codeLines.length * lineHeight + blockPadding * 2;

    checkPageBreak(Math.min(blockHeight, 40));

    // Code container background
    doc.setFillColor(241, 245, 249); // slate-100
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.setLineWidth(0.3);

    const actualHeight = Math.min(
      blockHeight,
      pageHeight - marginBottom - cursorY
    );
    doc.roundedRect(
      marginLeft,
      cursorY,
      contentWidth,
      actualHeight,
      1.5,
      1.5,
      "FD"
    );

    doc.setFont("courier", "normal");
    doc.setFontSize(codeFontSize);
    doc.setTextColor(15, 23, 42);

    let innerY = cursorY + blockPadding + 3;
    for (const cl of codeLines) {
      if (innerY > pageHeight - marginBottom - 2) {
        doc.addPage();
        cursorY = marginTop;
        innerY = cursorY + 4;
        doc.setFont("courier", "normal");
        doc.setFontSize(codeFontSize);
        doc.setTextColor(15, 23, 42);
      }
      doc.text(cl.slice(0, 95), marginLeft + blockPadding, innerY);
      innerY += lineHeight;
    }

    cursorY = innerY + blockPadding;
  };

  const renderFormattedLine = (
    rawLine: string,
    indentLeft: number = 0,
    fontSize: number = 10,
    baseColor: [number, number, number] = [15, 23, 42]
  ) => {
    const tokens = tokenizeInlineMarkdown(rawLine);
    const availableWidth = contentWidth - indentLeft;
    const lineHeight = fontSize * 0.45;

    // Helper to measure token width
    const measure = (t: InlineToken) => {
      if (t.code) doc.setFont("courier", "normal");
      else if (t.bold && t.italic) doc.setFont("helvetica", "bolditalic");
      else if (t.bold) doc.setFont("helvetica", "bold");
      else if (t.italic) doc.setFont("helvetica", "italic");
      else doc.setFont("helvetica", "normal");
      doc.setFontSize(fontSize);
      return doc.getTextWidth(t.text);
    };

    // Break tokens into words for fluid wrap
    interface RenderWord {
      text: string;
      bold?: boolean;
      italic?: boolean;
      code?: boolean;
      width: number;
    }

    const words: RenderWord[] = [];
    for (const tok of tokens) {
      // Split preserving spaces
      const parts = tok.text.split(/( +)/);
      for (const p of parts) {
        if (!p) continue;
        const width = measure({ ...tok, text: p });
        words.push({
          text: p,
          bold: tok.bold,
          italic: tok.italic,
          code: tok.code,
          width,
        });
      }
    }

    // Now layout words onto lines
    let currentLineWords: RenderWord[] = [];
    let currentLineWidth = 0;

    const flushLine = (lineWords: RenderWord[]) => {
      if (lineWords.length === 0) return;
      checkPageBreak(lineHeight + 1);

      let currentX = marginLeft + indentLeft;
      for (const w of lineWords) {
        if (w.code) {
          doc.setFont("courier", "normal");
          doc.setTextColor(219, 39, 119); // pink-600
        } else if (w.bold && w.italic) {
          doc.setFont("helvetica", "bolditalic");
          doc.setTextColor(...baseColor);
        } else if (w.bold) {
          doc.setFont("helvetica", "bold");
          doc.setTextColor(...baseColor);
        } else if (w.italic) {
          doc.setFont("helvetica", "italic");
          doc.setTextColor(...baseColor);
        } else {
          doc.setFont("helvetica", "normal");
          doc.setTextColor(...baseColor);
        }

        doc.setFontSize(fontSize);
        doc.text(w.text, currentX, cursorY);
        currentX += w.width;
      }
      cursorY += lineHeight;
    };

    for (const w of words) {
      if (currentLineWidth + w.width > availableWidth && currentLineWords.length > 0) {
        flushLine(currentLineWords);
        currentLineWords = [];
        currentLineWidth = 0;
      }
      currentLineWords.push(w);
      currentLineWidth += w.width;
    }

    flushLine(currentLineWords);
  };

  let i = 0;
  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Check code blocks
    if (trimmed.startsWith("```")) {
      if (inCodeBlock) {
        // End of code block
        inCodeBlock = false;
        renderCodeBlock(codeBlockLines);
        codeBlockLines = [];
        cursorY += 2;
      } else {
        inCodeBlock = true;
        codeBlockLines = [];
      }
      i++;
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(rawLine);
      i++;
      continue;
    }

    // Empty blank lines
    if (!trimmed) {
      cursorY += 3.5;
      i++;
      continue;
    }

    // Horizontal Rule (---, ***, ___)
    if (/^([-*_]){3,}$/.test(trimmed)) {
      checkPageBreak(5);
      cursorY += 2;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.4);
      doc.line(marginLeft, cursorY, marginLeft + contentWidth, cursorY);
      cursorY += 4;
      i++;
      continue;
    }

    // Headings
    if (trimmed.startsWith("#")) {
      const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const headingText = headingMatch[2];

        if (level === 1) {
          checkPageBreak(12);
          cursorY += 4;
          doc.setFont("helvetica", "bold");
          doc.setFontSize(15);
          doc.setTextColor(15, 23, 42); // slate-900
          const split = doc.splitTextToSize(headingText, contentWidth);
          doc.text(split, marginLeft, cursorY);
          cursorY += split.length * 6 + 2;
        } else if (level === 2) {
          checkPageBreak(10);
          cursorY += 3.5;
          doc.setFont("helvetica", "bold");
          doc.setFontSize(13);
          doc.setTextColor(30, 41, 59); // slate-800
          const split = doc.splitTextToSize(headingText, contentWidth);
          doc.text(split, marginLeft, cursorY);
          cursorY += split.length * 5.2 + 1.5;
        } else if (level === 3) {
          checkPageBreak(8);
          cursorY += 2.5;
          doc.setFont("helvetica", "bold");
          doc.setFontSize(11);
          doc.setTextColor(51, 65, 85); // slate-700
          const split = doc.splitTextToSize(headingText, contentWidth);
          doc.text(split, marginLeft, cursorY);
          cursorY += split.length * 4.6 + 1.5;
        } else {
          checkPageBreak(7);
          cursorY += 2;
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.setTextColor(71, 85, 105);
          const split = doc.splitTextToSize(headingText, contentWidth);
          doc.text(split, marginLeft, cursorY);
          cursorY += split.length * 4.2 + 1;
        }

        i++;
        continue;
      }
    }

    // Blockquotes
    if (trimmed.startsWith(">")) {
      const quoteText = trimmed.replace(/^>\s*/, "");
      checkPageBreak(6);
      const startQuoteY = cursorY - 1;

      // Render blockquote text indented
      renderFormattedLine(quoteText, 6, 9.5, [71, 85, 105]);

      // Draw left accent border
      doc.setDrawColor(37, 99, 235); // blue-600
      doc.setLineWidth(1.2);
      doc.line(marginLeft + 1, startQuoteY, marginLeft + 1, cursorY);

      cursorY += 1.5;
      i++;
      continue;
    }

    // Bullet List Items (-, *, +, •)
    const bulletMatch = rawLine.match(/^(\s*)([-*+•])\s+(.+)$/);
    if (bulletMatch) {
      const leadingSpaces = bulletMatch[1].length;
      const isNested = leadingSpaces >= 2;
      const itemText = bulletMatch[3];
      const indent = isNested ? 10 : 5;

      checkPageBreak(5);

      // Draw bullet dot
      doc.setFillColor(37, 99, 235);
      doc.circle(marginLeft + indent - 2.5, cursorY - 1.2, 0.65, "F");

      renderFormattedLine(itemText, indent, 9.5, [30, 41, 59]);
      cursorY += 1;
      i++;
      continue;
    }

    // Numbered List Items (1., 2., etc.)
    const numberedMatch = rawLine.match(/^(\s*)(\d+)\.\s+(.+)$/);
    if (numberedMatch) {
      const numStr = numberedMatch[2] + ".";
      const itemText = numberedMatch[3];
      const indent = 6.5;

      checkPageBreak(5);

      // Draw number prefix in bold
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(37, 99, 235);
      doc.text(numStr, marginLeft, cursorY);

      renderFormattedLine(itemText, indent, 9.5, [30, 41, 59]);
      cursorY += 1;
      i++;
      continue;
    }

    // Markdown Table Row (| col1 | col2 |)
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      // Collect all table lines
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i].trim());
        i++;
      }

      if (tableLines.length > 0) {
        checkPageBreak(12);
        cursorY += 2;

        // Parse cells
        const parsedRows = tableLines
          .filter((row) => !/^\|[\s\-:|]+\|$/.test(row)) // Skip separator lines like |---|---|
          .map((row) =>
            row
              .slice(1, -1)
              .split("|")
              .map((cell) => cell.trim())
          );

        if (parsedRows.length > 0) {
          const colCount = Math.max(...parsedRows.map((r) => r.length));
          const colWidth = contentWidth / colCount;
          const rowHeight = 6.5;

          parsedRows.forEach((row, rowIndex) => {
            checkPageBreak(rowHeight + 1);

            if (rowIndex === 0) {
              // Table Header
              doc.setFillColor(241, 245, 249);
              doc.rect(marginLeft, cursorY - 3.5, contentWidth, rowHeight, "F");
              doc.setFont("helvetica", "bold");
              doc.setFontSize(8.5);
              doc.setTextColor(15, 23, 42);
            } else {
              // Alternating row background
              if (rowIndex % 2 === 1) {
                doc.setFillColor(248, 250, 252);
                doc.rect(marginLeft, cursorY - 3.5, contentWidth, rowHeight, "F");
              }
              doc.setFont("helvetica", "normal");
              doc.setFontSize(8.5);
              doc.setTextColor(51, 65, 85);
            }

            // Cell borders and text
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.2);
            doc.rect(marginLeft, cursorY - 3.5, contentWidth, rowHeight, "S");

            row.forEach((cell, cellIdx) => {
              const cellX = marginLeft + cellIdx * colWidth + 2;
              const cellText = doc.splitTextToSize(cell, colWidth - 4)[0] || "";
              doc.text(cellText, cellX, cursorY);
            });

            cursorY += rowHeight;
          });

          cursorY += 3;
        }
        continue;
      }
    }

    // Standard Paragraph text line
    renderFormattedLine(rawLine, 0, 9.8, [30, 41, 59]);
    cursorY += 1.2;
    i++;
  }

  // If code block was still open at end
  if (inCodeBlock && codeBlockLines.length > 0) {
    renderCodeBlock(codeBlockLines);
  }

  // ----------------------------------------------------
  // 3. RESEARCH SOURCES & CITATIONS (IF PRESENT)
  // ----------------------------------------------------
  if (sources && sources.length > 0) {
    checkPageBreak(25);
    cursorY += 5;

    // Sources Header Box
    doc.setFillColor(240, 249, 255); // sky-50
    doc.setDrawColor(186, 230, 253); // sky-200
    doc.setLineWidth(0.4);
    doc.roundedRect(marginLeft, cursorY, contentWidth, 8, 1.5, 1.5, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(3, 105, 161); // sky-700
    doc.text(`VERIFIED CITATIONS & SOURCES (${sources.length})`, marginLeft + 3, cursorY + 5.5);

    cursorY += 12;

    sources.forEach((src, idx) => {
      checkPageBreak(9);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      const titleText = `${idx + 1}. ${src.title || "Research Reference"}`;
      doc.text(titleText, marginLeft + 2, cursorY);

      cursorY += 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(37, 99, 235); // blue-600

      const maxUriWidth = contentWidth - 4;
      const truncatedUri =
        src.uri.length > 85 ? src.uri.slice(0, 82) + "..." : src.uri;

      // Add clickable link
      if (typeof doc.textWithLink === "function") {
        doc.textWithLink(truncatedUri, marginLeft + 2, cursorY, { url: src.uri });
      } else {
        doc.text(truncatedUri, marginLeft + 2, cursorY);
      }

      cursorY += 5;
    });
  }

  // ----------------------------------------------------
  // 4. NOTES / CAVEATS (IF PRESENT)
  // ----------------------------------------------------
  if (notes) {
    checkPageBreak(16);
    cursorY += 4;

    doc.setFillColor(254, 252, 232); // yellow-50
    doc.setDrawColor(254, 240, 138); // yellow-200
    doc.setLineWidth(0.4);

    const noteSplit = doc.splitTextToSize(notes, contentWidth - 8);
    const boxHeight = noteSplit.length * 4.2 + 8;

    doc.roundedRect(marginLeft, cursorY, contentWidth, boxHeight, 1.5, 1.5, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(161, 98, 7); // yellow-700
    doc.text("NOTE / HIGHLIGHT:", marginLeft + 3, cursorY + 4.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(113, 63, 18);
    doc.text(noteSplit, marginLeft + 3, cursorY + 9);

    cursorY += boxHeight + 3;
  }

  // ----------------------------------------------------
  // 5. RUNNING FOOTER ON EVERY PAGE
  // ----------------------------------------------------
  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page);

    // Subtle footer separator
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(marginLeft, pageHeight - 12, marginLeft + contentWidth, pageHeight - 12);

    // Left: Brand
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text("LexisAi • Professional AI Productivity Suite", marginLeft, pageHeight - 7.5);

    // Right: Page count
    const pageStr = `Page ${page} of ${totalPages}`;
    doc.text(pageStr, pageWidth - marginRight, pageHeight - 7.5, { align: "right" });
  }

  // ----------------------------------------------------
  // 6. TRIGGER DOWNLOAD
  // ----------------------------------------------------
  const sanitizedAction = (action || "result").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const fileName = `lexisai-${sanitizedAction}-${Date.now()}.pdf`;

  doc.save(fileName);
}
