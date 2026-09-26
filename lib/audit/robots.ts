export interface RobotsGroup {
  agents: string[];
  rules: { type: "allow" | "disallow"; path: string }[];
}

export interface ParsedRobots {
  groups: RobotsGroup[];
  sitemaps: string[];
}

export function parseRobots(text: string): ParsedRobots {
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];
  let current: RobotsGroup | null = null;
  let lastWasAgent = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if (key === "allow" || key === "disallow") {
      lastWasAgent = false;
      if (current) current.rules.push({ type: key, path: value });
    } else if (key === "sitemap") {
      sitemaps.push(value);
    } else {
      lastWasAgent = false;
    }
  }
  return { groups, sitemaps };
}

function patternToRegex(path: string): RegExp {
  const anchored = path.endsWith("$");
  const body = (anchored ? path.slice(0, -1) : path)
    .split("*")
    .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
}

/** Finds the group that applies to a bot: the most specific UA token match, else "*". */
export function groupFor(robots: ParsedRobots, bot: string): RobotsGroup | null {
  const name = bot.toLowerCase();
  let best: RobotsGroup | null = null;
  let bestLen = 0;
  for (const g of robots.groups) {
    for (const agent of g.agents) {
      if (agent !== "*" && name.includes(agent) && agent.length > bestLen) {
        best = g;
        bestLen = agent.length;
      }
    }
  }
  return best ?? robots.groups.find((g) => g.agents.includes("*")) ?? null;
}

/** RFC 9309: longest matching rule wins, allow wins ties, empty disallow allows everything. */
export function isAllowed(robots: ParsedRobots, bot: string, path = "/"): { allowed: boolean; rule?: string } {
  const group = groupFor(robots, bot);
  if (!group) return { allowed: true };
  let match: { type: "allow" | "disallow"; path: string } | null = null;
  for (const rule of group.rules) {
    if (!rule.path) continue;
    if (!patternToRegex(rule.path).test(path)) continue;
    if (
      !match ||
      rule.path.length > match.path.length ||
      (rule.path.length === match.path.length && rule.type === "allow")
    ) {
      match = rule;
    }
  }
  if (!match) return { allowed: true };
  const agentLabel = group.agents.join(", ");
  return {
    allowed: match.type === "allow",
    rule: `User-agent: ${agentLabel} → ${match.type === "allow" ? "Allow" : "Disallow"}: ${match.path}`,
  };
}
