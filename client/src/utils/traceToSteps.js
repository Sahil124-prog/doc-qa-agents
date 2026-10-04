// The server sends the agent's trace as lines like:
//   'retrieve: "how long ..." → 4 sources (best 0.80)'
//   'grade: NOT relevant (LLM said "NO")'
//   'rewrite #1: "employee notice period"'
// This turns each line into a plain-English step for the timeline.

function quoted(line) {
  const match = line.match(/"([^"]*)"/);
  return match ? match[1] : "";
}

// [{ fileName: "hr-policy.pdf", pageNumber: 2 }, ...] → "page 2 of hr-policy.pdf"
function describeCitations(citations) {
  const pagesByFile = {};
  for (const c of citations) {
    pagesByFile[c.fileName] ??= new Set();
    pagesByFile[c.fileName].add(c.pageNumber);
  }

  return Object.entries(pagesByFile)
    .map(([fileName, pageSet]) => {
      const pages = [...pageSet].sort((a, b) => a - b);
      const label =
        pages.length === 1
          ? `page ${pages[0]}`
          : `pages ${pages.slice(0, -1).join(", ")} and ${pages.at(-1)}`;
      return `${label} of ${fileName}`;
    })
    .join("; ");
}

export function traceToSteps(trace = [], citations = []) {
  let searches = 0;

  return trace.map((line) => {
    if (line.startsWith("retrieve:")) {
      searches += 1;
      const count = line.match(/→ (\d+) sources/)?.[1] ?? "the";
      return searches === 1
        ? {
            kind: "search",
            title: "Searched your documents",
            detail: `Read the ${count} closest passages`,
          }
        : {
            kind: "search",
            title: "Searched again",
            detail: "Using the new wording",
          };
    }

    if (line.startsWith("grade:")) {
      return line.includes("NOT relevant")
        ? {
            kind: "miss",
            title: "Nothing useful yet",
            detail: "Those passages didn’t answer it",
          }
        : {
            kind: "found",
            title: "Found the answer",
            detail: "These passages cover your question",
          };
    }

    if (line.startsWith("rewrite")) {
      return {
        kind: "rewrite",
        title: "Tried different wording",
        detail: `“${quoted(line)}”`,
      };
    }

    if (line.startsWith("generate: no citations")) {
      return {
        kind: "rewrite",
        title: "Double-checked the sources",
        detail: "Made sure each fact points to a page",
      };
    }

    if (line.startsWith("generate: still no citations")) {
      return {
        kind: "miss",
        title: "Held back a weak answer",
        detail: "It couldn’t be traced to a page",
      };
    }

    if (line.startsWith("generate:")) {
      return citations.length > 0
        ? {
            kind: "done",
            title: "Answered",
            detail: `Using ${describeCitations(citations)}`,
          }
        : {
            kind: "miss",
            title: "Stopped looking",
            detail: "Your documents don’t cover this",
          };
    }

    if (line.startsWith("noAnswer:")) {
      return {
        kind: "miss",
        title: "Stopped looking",
        detail: "Your documents don’t cover this",
      };
    }

    return { kind: "search", title: line, detail: "" };
  });
}
