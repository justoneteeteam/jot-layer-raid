import { extractText } from "unpdf";

export interface CarrierRule {
  name: string;
  key: string;
  pattern: RegExp;
  cleaner: (raw: string) => string;
  formatter: (clean: string) => string;
}

export const CARRIER_REGISTRY: CarrierRule[] = [
  // 1. YunExpress (e.g. YT2608123456789012)
  {
    name: "YunExpress",
    key: "yunexpress",
    pattern: /\b(YT\d{16,18})\b/i,
    cleaner: (raw) => raw.toUpperCase().replace(/\s+/g, ""),
    formatter: (clean) =>
      clean.length >= 16
        ? `${clean.slice(0, 2)} ${clean.slice(2, 6)} ${clean.slice(6, 10)} ${clean.slice(10, 14)} ${clean.slice(14)}`
        : clean,
  },
  // 2. Yanwen International (e.g. UL419194573YP)
  {
    name: "Yanwen Express",
    key: "yanwen",
    pattern: /\b([A-Za-z]{2}\d{9}[A-Za-z]{2})\b/,
    cleaner: (raw) => raw.toUpperCase().replace(/\s+/g, ""),
    formatter: (clean) => clean,
  },
  // 3. UPS (e.g. 1Z9999999999999999)
  {
    name: "UPS",
    key: "ups",
    pattern: /\b(1Z[0-9A-Za-z]{16})\b/i,
    cleaner: (raw) => raw.toUpperCase().replace(/\s+/g, ""),
    formatter: (clean) =>
      `${clean.slice(0, 2)} ${clean.slice(2, 5)} ${clean.slice(5, 8)} ${clean.slice(8, 10)} ${clean.slice(10, 14)} ${clean.slice(14)}`,
  },
  // 4. 4PX Express (e.g. 4PX300123456789 or LP...4PX)
  {
    name: "4PX Express",
    key: "4px",
    pattern: /\b(4PX\d{12,16}|[A-Za-z]{2}\d{9}4PX)\b/i,
    cleaner: (raw) => raw.toUpperCase().replace(/\s+/g, ""),
    formatter: (clean) => clean,
  },
  // 5. USPS (22-digit or 20-digit standard barcode)
  {
    name: "USPS",
    key: "usps",
    pattern: /\b(9\d[\s\d]{20,26}\d|\d{22}|\d{20})\b/,
    cleaner: (raw) => raw.replace(/\D/g, ""),
    formatter: (clean) => {
      if (clean.length === 22) {
        return `${clean.slice(0, 4)} ${clean.slice(4, 8)} ${clean.slice(8, 12)} ${clean.slice(12, 16)} ${clean.slice(16, 20)} ${clean.slice(20)}`;
      }
      return clean.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
    },
  },
  // 6. Royal Mail (e.g. GB123456789GB)
  {
    name: "Royal Mail",
    key: "royal_mail",
    pattern: /\b([A-Za-z]{2}\d{9}GB)\b/i,
    cleaner: (raw) => raw.toUpperCase().replace(/\s+/g, ""),
    formatter: (clean) => clean,
  },
  // 7. Australia Post (e.g. AU123456789AU or 23-digit AP barcode)
  {
    name: "Australia Post",
    key: "auspost",
    pattern: /\b([A-Za-z]{2}\d{9}AU|\d{23}|\d{14})\b/i,
    cleaner: (raw) => raw.toUpperCase().replace(/\s+/g, ""),
    formatter: (clean) => clean,
  },
  // 8. DHL Express / eCommerce (e.g. GM1234567890123456 or 10-digit)
  {
    name: "DHL",
    key: "dhl",
    pattern: /\b(GM\d{16}|JJD\d{16,18})\b/i,
    cleaner: (raw) => raw.toUpperCase().replace(/\s+/g, ""),
    formatter: (clean) => clean,
  },
  // 9. Sunyou / CNE / SF Express
  {
    name: "CNE / Sunyou",
    key: "cne",
    pattern: /\b(3A\d{10}|SY\d{11,12}|WNB\d{12}|SF\d{13})\b/i,
    cleaner: (raw) => raw.toUpperCase().replace(/\s+/g, ""),
    formatter: (clean) => clean,
  },
  // 10. FedEx (12 or 15 digit or 96-ground)
  {
    name: "FedEx",
    key: "fedex",
    pattern: /\b(96\d{20}|\d{15}|\d{12})\b/,
    cleaner: (raw) => raw.replace(/\D/g, ""),
    formatter: (clean) => clean.replace(/(\d{4})(?=\d)/g, "$1 ").trim(),
  },
];

export interface ExtractedLabel {
  filename: string;
  extracted_tracking: string;
  formatted_tracking: string;
  carrier_key: string;
  carrier_name: string;
  extracted_customer: string;
  extracted_order_id?: string;
  raw_text: string;
}

export interface CandidateOrderOption {
  id: number;
  order_id: string;
  product_name: string;
  quantity: number;
  created_at: string;
  score: number;
  reason?: string;
}

export interface MatchResult {
  filename: string;
  filepath: string;
  extracted_tracking: string;
  formatted_tracking: string;
  carrier_key: string;
  carrier_name: string;
  extracted_customer: string;
  matched_order_id: number | null;
  matched_order_number: string | null;
  confidence: "high" | "duplicate" | "unmatched" | "none";
  existing_tracking?: string | null;
  candidate_orders?: CandidateOrderOption[];
}

export interface DbOrderCandidate {
  id: number;
  orderId: string | null;
  orderName: string | null;
  customerName: string;
  customerEmail: string | null;
  customerAddress: string;
  productName?: string | null;
  quantity?: number | null;
  variant?: string | null;
  trackingNumber: string | null;
  shippingStatus: string | null;
  createdAt?: string | null;
}

/**
 * Universal Tracking Extraction via Carrier Registry Matrix
 */
export function extractTrackingAndCarrier(text: string): {
  tracking: string;
  formatted: string;
  carrierKey: string;
  carrierName: string;
} {
  for (const rule of CARRIER_REGISTRY) {
    const match = text.match(rule.pattern);
    if (match && match[1]) {
      const clean = rule.cleaner(match[1]);
      if (clean.length > 6) {
        return {
          tracking: clean,
          formatted: rule.formatter(clean),
          carrierKey: rule.key,
          carrierName: rule.name,
        };
      }
    }
  }

  // Fallback for spaced 22-digit USPS sequences
  const spacedUspsMatch = text.match(/\b(?:\d\s*){22}\b/);
  if (spacedUspsMatch) {
    const cleanDigits = spacedUspsMatch[0].replace(/\D/g, "");
    if (cleanDigits.length === 22) {
      return {
        tracking: cleanDigits,
        formatted: `${cleanDigits.slice(0, 4)} ${cleanDigits.slice(4, 8)} ${cleanDigits.slice(8, 12)} ${cleanDigits.slice(12, 16)} ${cleanDigits.slice(16, 20)} ${cleanDigits.slice(20)}`,
        carrierKey: "usps",
        carrierName: "USPS",
      };
    }
  }

  return {
    tracking: "",
    formatted: "",
    carrierKey: "unknown",
    carrierName: "Carrier Tracking",
  };
}

/**
 * Extract recipient name candidate supporting bilingual and multi-line anchors
 */
export function extractRecipientName(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const ANCHOR_REGEX = /^(?:to|ship\s*to|deliver\s*to|recipient|receiver|consignee|destinataire|收件人|收货人)\s*[:：]?\s*(.*)$/i;

  // Strategy A: Check for header anchors (inline or next line)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const match = line.match(ANCHOR_REGEX);
    if (match) {
      const inlineCandidate = (match[1] || "").trim();
      // If name is on the same line (e.g. "To: Andy Johnson")
      if (inlineCandidate.length >= 3 && !/\d/.test(inlineCandidate)) {
        const words = inlineCandidate.split(/\s+/);
        if (words.length >= 2 && words.length <= 4) {
          return inlineCandidate;
        }
      }
      // If header was on its own line, inspect subsequent line
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1]!.trim();
        const words = nextLine.split(/\s+/);
        if (words.length >= 2 && words.length <= 4 && !/\d/.test(nextLine)) {
          return nextLine;
        }
      }
    }
  }

  // Strategy B: Scan for 2-4 word uppercase recipient lines avoiding postal keywords
  const skipKeywords = [
    "DEPT", "USPS", "GROUND", "TO:", "PRIORITY", "PARCEL", "SELECT", "COMMERCIAL",
    "POSTAGE", "PAID", "CARRIER", "TRACKING", "WEIGHT", "ZONE", "SHIP", "FROM", "RETURN",
    "PRODUCT", "ORDERNO", "QUANTITY", "VERIFIED", "YANWEN", "YUNEXPRESS", "FEDEX", "UPS",
    "DHL", "PACKAGE", "CUSTOMS", "DECLARATION", "DESCRIPTION"
  ];

  for (const line of lines) {
    const words = line.split(/\s+/);
    const isUpper = line === line.toUpperCase();
    const hasDigits = /\d/.test(line);
    const containsSkip = skipKeywords.some((k) => line.toUpperCase().includes(k));

    if (isUpper && words.length >= 2 && words.length <= 4 && !hasDigits && !containsSkip) {
      return line
        .toLowerCase()
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    }
  }

  return "";
}

/**
 * Case 6: Splits a multi-label page (2-up, 4-up grid) into distinct label text blocks
 */
export function splitPageIntoLabelBlocks(pageText: string): string[] {
  // Check if multiple recipient headers or multiple tracking codes exist in this single page
  const recipientAnchorMatches = pageText.match(/(?:^|\n)\s*(?:To|Ship\s*To|收件人|Consignee)\s*[:：]/gi) || [];
  const trackingMatches = pageText.match(/\b([A-Za-z]{2}\d{9}[A-Za-z]{2}|YT\d{16}|1Z[0-9A-Za-z]{16}|9\d{21})\b/gi) || [];

  if (recipientAnchorMatches.length > 1 || trackingMatches.length > 1) {
    // Split on label boundary markers (e.g. repeated "P-1", "To:", "Ship To:", "OrderNo:")
    const SPLIT_PATTERN = /(?=(?:(?:^|\n)(?:P-\d+|To\s*[:：]|Ship\s*To\s*[:：]|收件人\s*[:：]|USPS\s*TRACKING\s*#)))/i;
    const rawBlocks = pageText.split(SPLIT_PATTERN).map((b) => b.trim()).filter((b) => b.length > 30);

    if (rawBlocks.length > 1) {
      return rawBlocks;
    }
  }

  return [pageText];
}

/**
 * Extract single label metadata from raw text block
 */
export function extractFromTextBlock(
  textBlock: string,
  displayFilename: string
): ExtractedLabel {
  const { tracking, formatted, carrierKey, carrierName } = extractTrackingAndCarrier(textBlock);
  const customerName = extractRecipientName(textBlock);

  // Check if an explicit store order ID or reference is present (e.g. "OrderNo: VUL-225246" or "XM62R118087")
  let extractedOrderId = "";
  const orderNoMatch = textBlock.match(/(?:OrderNo|Order\s*#|Order\s*ID|Ref)\s*[:：]?\s*([A-Za-z0-9\-_#]+)/i);
  if (orderNoMatch && orderNoMatch[1]) {
    extractedOrderId = orderNoMatch[1].trim();
  }

  return {
    filename: displayFilename,
    extracted_tracking: tracking,
    formatted_tracking: formatted,
    carrier_key: carrierKey,
    carrier_name: carrierName,
    extracted_customer: customerName,
    extracted_order_id: extractedOrderId,
    raw_text: textBlock,
  };
}

/**
 * Extract tracking numbers, formatted tracking, and customer name candidates from a PDF ArrayBuffer.
 * Handles single-page, multi-page, and multi-label grid PDF batches!
 */
export async function extractFromPdfBuffer(
  buffer: ArrayBuffer,
  filename: string = "label.pdf"
): Promise<ExtractedLabel[]> {
  try {
    const uint8 = new Uint8Array(buffer);
    const { text } = await extractText(uint8);
    const pages = Array.isArray(text) ? text : [text || ""];

    const labels: ExtractedLabel[] = [];

    for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
      const pageText = pages[pageIdx] || "";
      const blocks = splitPageIntoLabelBlocks(pageText);

      for (let blockIdx = 0; blockIdx < blocks.length; blockIdx++) {
        const blockText = blocks[blockIdx]!;
        let displayFilename = filename;
        if (pages.length > 1 && blocks.length > 1) {
          displayFilename = `${filename} (Page ${pageIdx + 1} - Slip ${blockIdx + 1})`;
        } else if (pages.length > 1) {
          displayFilename = `${filename} (Page ${pageIdx + 1})`;
        } else if (blocks.length > 1) {
          displayFilename = `${filename} (Slip ${blockIdx + 1})`;
        }

        const label = extractFromTextBlock(blockText, displayFilename);
        if (label.extracted_tracking || label.extracted_customer) {
          labels.push(label);
        }
      }
    }

    return labels.length > 0
      ? labels
      : [
          {
            filename,
            extracted_tracking: "",
            formatted_tracking: "",
            carrier_key: "unknown",
            carrier_name: "Carrier Tracking",
            extracted_customer: "",
            raw_text: "",
          },
        ];
  } catch (err) {
    console.error(`Error parsing PDF ${filename}:`, err);
    return [
      {
        filename,
        extracted_tracking: "",
        formatted_tracking: "",
        carrier_key: "unknown",
        carrier_name: "Carrier Tracking",
        extracted_customer: "",
        raw_text: "",
      },
    ];
  }
}

/**
 * Normalizes a name for comparison
 */
function normalizeName(name: string): string {
  return (name || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Checks if two customer names match with tolerance
 */
function isNameMatch(pdfName: string, orderName: string): boolean {
  const normPdf = normalizeName(pdfName);
  const normOrder = normalizeName(orderName);

  if (!normPdf || !normOrder) return false;
  if (normPdf === normOrder) return true;

  const pdfParts = normPdf.split(" ").filter(Boolean);
  const orderParts = normOrder.split(" ").filter(Boolean);

  if (pdfParts.length >= 2 && orderParts.length >= 2) {
    const pdfFirst = pdfParts[0];
    const pdfLast = pdfParts[pdfParts.length - 1];
    const orderFirst = orderParts[0];
    const orderLast = orderParts[orderParts.length - 1];

    if (pdfFirst === orderFirst && pdfLast === orderLast) {
      return true;
    }
  }

  if (normOrder.includes(normPdf) || normPdf.includes(normOrder)) {
    return true;
  }

  return false;
}

/**
 * Case 4: Multi-Factor Scoring & Ranking for Disambiguating Multiple Orders for the Same Customer
 */
function rankCandidateOrders(
  label: ExtractedLabel,
  candidateOrders: DbOrderCandidate[]
): CandidateOrderOption[] {
  const labelLower = label.raw_text.toLowerCase();

  return candidateOrders
    .map((order) => {
      let score = 50; // Base match score for customer name match
      let matchReasons: string[] = ["Customer name matched"];

      // 1. Product Title & Keyword Match
      if (order.productName) {
        const productWords = order.productName
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, " ")
          .split(/\s+/)
          .filter((w) => w.length > 3);

        const matchedWords = productWords.filter((w) => labelLower.includes(w));
        if (matchedWords.length > 0) {
          const productPoints = Math.min(matchedWords.length * 15, 35);
          score += productPoints;
          matchReasons.push(`Product keyword match (${matchedWords.slice(0, 3).join(", ")})`);
        }
      }

      // 2. Exact Order ID reference match (if label has order reference)
      if (label.extracted_order_id && order.orderId) {
        if (labelLower.includes(order.orderId.toLowerCase())) {
          score += 50;
          matchReasons.push(`Order ID ${order.orderId} exact match`);
        }
      }

      // 3. Zip code / Postal Address Match
      if (order.customerAddress) {
        const zipMatch = order.customerAddress.match(/\b\d{5}(?:-\d{4})?\b/);
        if (zipMatch && labelLower.includes(zipMatch[0])) {
          score += 20;
          matchReasons.push(`Zip code ${zipMatch[0]} verified`);
        }
      }

      // 4. FIFO Order Age Priority (Older pending orders prioritized)
      if (order.createdAt) {
        const orderAgeHours = (Date.now() - new Date(order.createdAt).getTime()) / (1000 * 3600);
        const ageBonus = Math.min(Math.floor(orderAgeHours / 24) * 2, 10);
        if (ageBonus > 0) {
          score += ageBonus;
          matchReasons.push(`FIFO order age bonus (+${ageBonus} pts)`);
        }
      }

      // Deduct points if order is already fulfilled/delivered
      if (order.trackingNumber && order.trackingNumber.trim() !== "") {
        score -= 15;
        matchReasons.push("Already has tracking number");
      }

      return {
        id: order.id,
        order_id: order.orderId || String(order.id),
        product_name: order.productName || "Standard Order Item",
        quantity: order.quantity || 1,
        created_at: order.createdAt || "",
        score: Math.min(Math.max(score, 0), 100),
        reason: matchReasons.join(" • "),
      };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Matches extracted PDF label against D1 database orders with multi-criteria disambiguation
 */
export function matchLabelWithOrders(
  label: ExtractedLabel,
  orders: DbOrderCandidate[]
): MatchResult {
  const extractedName = label.extracted_customer;
  const carrierName = label.carrier_name || "Carrier Tracking";
  const carrierKey = label.carrier_key || "unknown";

  if (!extractedName && !label.extracted_tracking) {
    return {
      filename: label.filename,
      filepath: label.filename,
      extracted_tracking: label.extracted_tracking,
      formatted_tracking: label.formatted_tracking,
      carrier_key: carrierKey,
      carrier_name: carrierName,
      extracted_customer: label.extracted_customer || "—",
      matched_order_id: null,
      matched_order_number: null,
      confidence: "none",
    };
  }

  // 1. Check for Exact Order ID Match (Pass 0)
  if (label.extracted_order_id) {
    const exactOrder = orders.find(
      (o) =>
        o.orderId &&
        (o.orderId.toLowerCase() === label.extracted_order_id!.toLowerCase() ||
          label.raw_text.toLowerCase().includes(o.orderId.toLowerCase()))
    );
    if (exactOrder) {
      const isDup = Boolean(exactOrder.trackingNumber && exactOrder.trackingNumber.trim() !== "");
      return {
        filename: label.filename,
        filepath: label.filename,
        extracted_tracking: label.extracted_tracking,
        formatted_tracking: label.formatted_tracking || label.extracted_tracking,
        carrier_key: carrierKey,
        carrier_name: carrierName,
        extracted_customer: label.extracted_customer || exactOrder.customerName,
        matched_order_id: exactOrder.id,
        matched_order_number: exactOrder.orderId || String(exactOrder.id),
        confidence: isDup ? "duplicate" : "high",
        existing_tracking: exactOrder.trackingNumber || null,
      };
    }
  }

  // 2. Find all matching orders by customer name
  const matchingOrders = orders.filter((o) => isNameMatch(extractedName, o.customerName));

  if (matchingOrders.length > 0) {
    // Rank all candidate orders using multi-factor scoring (Case 4)
    const rankedCandidates = rankCandidateOrders(label, matchingOrders);
    const topMatchCandidate = rankedCandidates[0]!;
    const topDbOrder = matchingOrders.find((o) => o.id === topMatchCandidate.id)!;

    const isDuplicate = Boolean(topDbOrder.trackingNumber && topDbOrder.trackingNumber.trim() !== "");

    return {
      filename: label.filename,
      filepath: label.filename,
      extracted_tracking: label.extracted_tracking,
      formatted_tracking: label.formatted_tracking || label.extracted_tracking,
      carrier_key: carrierKey,
      carrier_name: carrierName,
      extracted_customer: extractedName || topDbOrder.customerName,
      matched_order_id: topDbOrder.id,
      matched_order_number: topDbOrder.orderId || String(topDbOrder.id),
      confidence: isDuplicate ? "duplicate" : "high",
      existing_tracking: topDbOrder.trackingNumber || null,
      candidate_orders: rankedCandidates.length > 1 ? rankedCandidates : undefined,
    };
  }

  return {
    filename: label.filename,
    filepath: label.filename,
    extracted_tracking: label.extracted_tracking,
    formatted_tracking: label.formatted_tracking || "Not Found",
    carrier_key: carrierKey,
    carrier_name: carrierName,
    extracted_customer: extractedName || "—",
    matched_order_id: null,
    matched_order_number: null,
    confidence: "unmatched",
  };
}
