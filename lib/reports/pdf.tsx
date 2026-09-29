import path from "node:path";
import { Circle, Document, Image, Page, Path, Rect, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import type { MonthlyReportData } from "./data";

const C = {
  ink: "#0A1020",
  ink2: "#4A5568",
  ink3: "#7C8798",
  paper: "#FCF8F3",
  paper2: "#F5EEE6",
  line: "#E7E1D9",
  flame: "#FF5A1F",
  flameSoft: "#FFEDE4",
  aqua: "#0FB5A8",
  aquaSoft: "#E2F7F5",
  ember: "#FFB020",
  good: "#0ca30c",
  warn: "#C98A06",
  bad: "#d03b3b",
  track: "#EFE7DE",
};

const s = StyleSheet.create({
  page: { backgroundColor: "#FFFFFF", paddingTop: 40, paddingBottom: 56, paddingHorizontal: 40, fontFamily: "Helvetica", fontSize: 10, color: C.ink },
  cover: { backgroundColor: C.paper, padding: 0 },
  h1: { fontSize: 26, fontFamily: "Helvetica-Bold", letterSpacing: -0.5 },
  h2: { fontSize: 15, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  h3: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  muted: { color: C.ink3 },
  body: { color: C.ink2 },
  eyebrow: { fontSize: 8, letterSpacing: 1.5, color: C.flame, fontFamily: "Helvetica-Bold", textTransform: "uppercase", marginBottom: 6 },
  row: { flexDirection: "row" },
  card: { borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 12, backgroundColor: "#FFFFFF" },
  section: { marginBottom: 18 },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: C.ink3 },
  th: { fontSize: 8, color: C.ink3, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.6 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 6, alignItems: "center" },
  pill: { fontSize: 8, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 8 },
});

const pct = (n: number | null | undefined) => (n == null ? "—" : `${Math.round(n * 100)}%`);
const tone = (n: number | null) => (n == null ? C.track : n <= 40 ? C.bad : n <= 70 ? C.ember : C.aqua);
const ENGINE_PNG: Record<string, string> = {
  chatgpt: "chatgpt.png",
  gemini: "gemini.png",
  perplexity: "perplexity.png",
  claude: "claude.png",
};
const enginePath = (e: string) => (ENGINE_PNG[e] ? path.join(process.cwd(), "public", "engines", ENGINE_PNG[e]) : null);

function Logo({ size = 26 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Rect width={40} height={40} rx={9} fill={C.ink} />
      <Path d="M11 27.5 20 11l9 16.5" stroke={C.flame} strokeWidth={3.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M15.6 24.5h8.8" stroke={C.aqua} strokeWidth={3.4} strokeLinecap="round" />
      <Circle cx={29} cy={11.5} r={2.8} fill={C.ember} />
    </Svg>
  );
}

function EngineMark({ engine, size = 14 }: { engine: string; size?: number }) {
  const p = enginePath(engine);
  if (p) return <Image src={p} style={{ width: size, height: size, borderRadius: 3 }} />;
  // Google AI Mode: a simple "G" disc (react-pdf can't draw the SVG logo file).
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: "#4285F4", alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: "#fff", fontSize: size * 0.6, fontFamily: "Helvetica-Bold" }}>G</Text>
    </View>
  );
}

function Ring({ value, size = 120 }: { value: number | null; size?: number }) {
  const stroke = size * 0.09;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value ?? 0));
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={C.track} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={tone(value)}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${(v / 100) * c} ${c}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={{ position: "absolute", top: 0, left: 0, width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: size * 0.3, fontFamily: "Helvetica-Bold" }}>{value ?? "—"}</Text>
        <Text style={{ fontSize: 8, color: C.ink3 }}>/ 100</Text>
      </View>
    </View>
  );
}

function Bar({ value, color = C.aqua, width = 120 }: { value: number; color?: string; width?: number }) {
  return (
    <View style={{ width, height: 6, backgroundColor: C.track, borderRadius: 3 }}>
      <View style={{ width: Math.max(0, Math.min(1, value)) * width, height: 6, backgroundColor: color, borderRadius: 3 }} />
    </View>
  );
}

function Delta({ now, prev }: { now: number | null | undefined; prev: number | null | undefined }) {
  if (now == null || prev == null) return <Text style={{ fontSize: 8, color: C.ink3 }}>first month</Text>;
  const d = Math.round((now - prev) * 100);
  if (d === 0) return <Text style={{ fontSize: 8, color: C.ink3 }}>no change</Text>;
  return <Text style={{ fontSize: 8, color: d > 0 ? C.good : C.bad }}>{`${d > 0 ? "+" : "-"}${Math.abs(d)} pts vs last month`}</Text>;
}

function Footer({ data }: { data: MonthlyReportData }) {
  return (
    <View style={s.footer} fixed>
      <Text>
        {data.brand.name} · AI Visibility Report · {data.periodLabel}
      </Text>
      <Text render={({ pageNumber, totalPages }) => `Prepared by AEO GrowthLead · ${pageNumber}/${totalPages}`} />
    </View>
  );
}

export function MonthlyReportPdf({ data }: { data: MonthlyReportData }) {
  const { report, previous } = data;
  const latest = report.vis.latest;
  const prev = previous?.latest ?? null;
  const kpis = [
    { label: "Mention rate", v: latest?.mentionRate, p: prev?.mentionRate, hint: "Answers that name you" },
    { label: "Citation rate", v: latest?.citationRate, p: prev?.citationRate, hint: "Answers that cite your site" },
    { label: "Share of voice", v: latest?.shareOfVoice, p: prev?.shareOfVoice, hint: "Your share of brands named" },
  ];
  const rivals = report.vis.competitors.slice(0, 8);
  const maxShare = Math.max(...rivals.map((r) => r.share), 0.01);
  const openRecs = report.recommendations.filter((r) => !r.state).slice(0, 5);

  return (
    <Document title={`${data.brand.name} AI Visibility Report ${data.periodLabel}`} author="AEO GrowthLead">
      {/* Cover + executive summary */}
      <Page size="A4" style={[s.page, s.cover]}>
        <View style={{ paddingHorizontal: 40, paddingTop: 40 }}>
          <View style={[s.row, { alignItems: "center", gap: 8 }]}>
            <Logo />
            <View>
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 12 }}>AEO GrowthLead</Text>
              <Text style={{ fontSize: 7, color: C.ink3, letterSpacing: 1.2 }}>AI VISIBILITY PLATFORM</Text>
            </View>
          </View>
          <View style={{ marginTop: 70 }}>
            <Text style={s.eyebrow}>Monthly AI visibility report · {data.periodLabel}</Text>
            <Text style={[s.h1, { fontSize: 34 }]}>{data.brand.name}</Text>
            <Text style={[s.body, { fontSize: 12, marginTop: 4 }]}>{data.brand.domain}</Text>
          </View>
          <View style={[s.row, { marginTop: 36, gap: 24, alignItems: "center" }]}>
            <Ring value={report.score} size={150} />
            <View style={{ flex: 1 }}>
              <Text style={s.h3}>AEO score</Text>
              <Text style={s.body}>
                Combines how often AI engines name and cite {data.brand.name} with how ready the website is to be read, trusted and
                quoted by those engines.
              </Text>
              {data.previousScore != null && report.score != null && (
                <Text style={{ marginTop: 6, color: report.score >= data.previousScore ? C.good : C.bad }}>
                  {report.score >= data.previousScore ? "+" : "-"}
                  {Math.abs(report.score - data.previousScore)} points since last month
                </Text>
              )}
            </View>
          </View>
          <View style={[s.row, { marginTop: 28, gap: 10 }]}>
            {kpis.map((k) => (
              <View key={k.label} style={[s.card, { flex: 1 }]}>
                <Text style={{ fontSize: 8, color: C.ink3 }}>{k.label}</Text>
                <Text style={{ fontSize: 22, fontFamily: "Helvetica-Bold", marginVertical: 2 }}>{pct(k.v)}</Text>
                <Delta now={k.v} prev={k.p} />
                <Text style={{ fontSize: 7, color: C.ink3, marginTop: 2 }}>{k.hint}</Text>
              </View>
            ))}
            <View style={[s.card, { flex: 1 }]}>
              <Text style={{ fontSize: 8, color: C.ink3 }}>Average rank</Text>
              <Text style={{ fontSize: 22, fontFamily: "Helvetica-Bold", marginVertical: 2 }}>
                {latest?.avgPosition ? `#${latest.avgPosition.toFixed(1)}` : "—"}
              </Text>
              <Text style={{ fontSize: 7, color: C.ink3 }}>Position when named</Text>
            </View>
          </View>
          <View style={[s.card, { marginTop: 16, backgroundColor: C.flameSoft, borderColor: "#FFD5C2" }]}>
            <Text style={s.h3}>Summary</Text>
            {data.summary.map((line) => (
              <Text key={line} style={[s.body, { marginBottom: 4 }]}>
                • {line}
              </Text>
            ))}
          </View>
        </View>
        <Footer data={data} />
      </Page>

      {/* Engines + competitors */}
      <Page size="A4" style={s.page}>
        <View style={s.section}>
          <Text style={s.eyebrow}>AI presence</Text>
          <Text style={s.h2}>How each AI engine answered</Text>
          <View style={[s.tr, { borderBottomColor: C.ink3 }]}>
            <Text style={[s.th, { flex: 3 }]}>Engine</Text>
            <Text style={[s.th, { flex: 2 }]}>Named you</Text>
            <Text style={[s.th, { flex: 2 }]}>Cited your site</Text>
            <Text style={[s.th, { flex: 3 }]}>Mention rate</Text>
          </View>
          {report.presence.map((e) => (
            <View key={e.engine} style={s.tr}>
              <View style={[s.row, { flex: 3, gap: 6, alignItems: "center" }]}>
                <EngineMark engine={e.engine} />
                <Text>{e.label}</Text>
              </View>
              <Text style={{ flex: 2 }}>
                {e.mentioned} of {e.prompts}
              </Text>
              <Text style={{ flex: 2 }}>
                {e.cited} of {e.prompts}
              </Text>
              <View style={[s.row, { flex: 3, gap: 6, alignItems: "center" }]}>
                <Bar value={e.prompts ? e.mentioned / e.prompts : 0} width={90} color={C.flame} />
                <Text>{pct(e.prompts ? e.mentioned / e.prompts : 0)}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={s.section}>
          <Text style={s.eyebrow}>Competitor landscape</Text>
          <Text style={s.h2}>Share of voice</Text>
          <Text style={[s.body, { marginBottom: 8 }]}>Each brand&apos;s share of all brand mentions across AI answers this month.</Text>
          {rivals.map((r) => (
            <View key={r.name} style={[s.row, { alignItems: "center", marginBottom: 6, gap: 8 }]}>
              <Text style={{ width: 150, fontFamily: r.isOwn ? "Helvetica-Bold" : "Helvetica" }}>
                {r.name}
                {r.isOwn ? " (you)" : ""}
              </Text>
              <Bar value={r.share / maxShare} width={250} color={r.isOwn ? C.flame : C.ink3} />
              <Text style={{ width: 40, textAlign: "right" }}>{pct(r.share)}</Text>
            </View>
          ))}
          {!rivals.length && <Text style={s.muted}>No brands were named this month.</Text>}
        </View>

        <View style={s.section}>
          <Text style={s.eyebrow}>Where answers come from</Text>
          <Text style={s.h2}>Most-cited sources</Text>
          <View style={[s.tr, { borderBottomColor: C.ink3 }]}>
            <Text style={[s.th, { flex: 4 }]}>Domain</Text>
            <Text style={[s.th, { flex: 1, textAlign: "right" }]}>Answers citing it</Text>
          </View>
          {report.vis.sources.slice(0, 10).map((src) => (
            <View key={src.domain} style={s.tr}>
              <Text style={{ flex: 4, fontFamily: src.domain.endsWith(data.brand.domain) ? "Helvetica-Bold" : "Helvetica" }}>
                {src.domain}
                {src.domain.endsWith(data.brand.domain) ? " (your site)" : ""}
              </Text>
              <Text style={{ flex: 1, textAlign: "right" }}>{src.citations}</Text>
            </View>
          ))}
        </View>
        <Footer data={data} />
      </Page>

      {/* Prompt results */}
      <Page size="A4" style={s.page}>
        <Text style={s.eyebrow}>Prompt by prompt</Text>
        <Text style={s.h2}>Buyer questions we tracked</Text>
        <View style={[s.tr, { borderBottomColor: C.ink3 }]} fixed>
          <Text style={[s.th, { flex: 5 }]}>Prompt</Text>
          {report.presence.map((e) => (
            <View key={e.engine} style={{ flex: 1, alignItems: "center" }}>
              <EngineMark engine={e.engine} size={12} />
            </View>
          ))}
        </View>
        {report.vis.prompts.map((p) => (
          <View key={p.id} style={s.tr} wrap={false}>
            <Text style={{ flex: 5, paddingRight: 8 }}>{p.text}</Text>
            {report.presence.map((e) => {
              const c = p.checks.find((x) => x.engine === e.engine);
              const label = !c || c.status !== "done" ? "-" : c.mentioned ? `#${c.position}` : "x";
              const color = !c || c.status !== "done" ? C.ink3 : c.mentioned ? C.good : C.bad;
              return (
                <Text key={e.engine} style={{ flex: 1, textAlign: "center", color, fontFamily: "Helvetica-Bold" }}>
                  {label}
                  {c?.cited ? " *" : ""}
                </Text>
              );
            })}
          </View>
        ))}
        <Text style={[s.muted, { marginTop: 8, fontSize: 8 }]}>#n = your position among brands named · x = not named · * = your site was cited as a source</Text>
        <Footer data={data} />
      </Page>

      {/* Site readiness, work delivered, next steps */}
      <Page size="A4" style={s.page}>
        <View style={s.section}>
          <Text style={s.eyebrow}>Site readiness</Text>
          <Text style={s.h2}>Can AI engines read and trust the website?</Text>
          {report.strategy.map((st) => (
            <View key={st.label} style={[s.row, { alignItems: "center", marginBottom: 7, gap: 8 }]}>
              <Text style={{ width: 130 }}>{st.label}</Text>
              <Bar value={(st.score ?? 0) / 100} width={260} color={tone(st.score)} />
              <Text style={{ width: 30, textAlign: "right", fontFamily: "Helvetica-Bold" }}>{st.score ?? "—"}</Text>
            </View>
          ))}
          {!report.audit && <Text style={s.muted}>No site audit has been run yet.</Text>}
        </View>

        <View style={s.section}>
          <Text style={s.eyebrow}>Work delivered in {data.periodLabel}</Text>
          <Text style={s.h2}>What we shipped</Text>
          {data.delivered.length === 0 && data.completedTasks.length === 0 && <Text style={s.muted}>No deliverables were logged this month.</Text>}
          {data.delivered.map((d) => (
            <View key={d.id} style={s.tr} wrap={false}>
              <Text style={{ width: 70, color: C.ink3 }}>{d.deliveredAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</Text>
              <Text style={{ width: 90, color: C.ink2 }}>{d.typeLabel}</Text>
              <Text style={{ flex: 1 }}>{d.title}</Text>
            </View>
          ))}
          {data.completedTasks.map((t) => (
            <View key={t.id} style={s.tr} wrap={false}>
              <Text style={{ width: 70, color: C.ink3 }}>{t.updatedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</Text>
              <Text style={{ width: 90, color: C.ink2 }}>Completed task</Text>
              <Text style={{ flex: 1 }}>{t.title}</Text>
            </View>
          ))}
        </View>

        <View style={s.section}>
          <Text style={s.eyebrow}>Next month</Text>
          <Text style={s.h2}>Priorities</Text>
          {openRecs.map((r, i) => (
            <View key={r.id} wrap={false} style={[s.card, { marginBottom: 6, flexDirection: "row", gap: 8 }]}>
              <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: "#fff", fontSize: 9, fontFamily: "Helvetica-Bold" }}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 2 }}>{r.title}</Text>
                <Text style={s.body}>{r.detail}</Text>
                <Text style={{ fontSize: 8, color: C.ink3, marginTop: 2 }}>
                  {r.impact} impact · {r.effort} effort · {r.tag}
                </Text>
              </View>
            </View>
          ))}
          {!openRecs.length && <Text style={s.muted}>No open recommendations. Nice work.</Text>}
        </View>
        <Footer data={data} />
      </Page>
    </Document>
  );
}
