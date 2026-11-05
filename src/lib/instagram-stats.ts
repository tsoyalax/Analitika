import { fmtInt, fmtPct } from "./funnel";

export interface IgMedia {
  media_id: string;
  caption: string;
  media_type: string;
  product_type: string;
  permalink: string;
  thumbnail_url: string;
  posted_at: string | null;
  views: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  saved: number | null;
  shares: number | null;
}

export interface IgConnection {
  username: string;
  keyword: string;
  synced_at: string | null;
  token_expires_at: string;
}

function quantile(values: number[], q: number): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

export interface MetricStats {
  total: number;
  median: number | null;
  /** Порог лучших 25% публикаций. */
  top: number | null;
}

function stats(values: (number | null)[]): MetricStats {
  const v = values.filter((x): x is number => x !== null);
  return { total: v.reduce((a, b) => a + b, 0), median: quantile(v, 0.5), top: quantile(v, 0.75) };
}

export interface IgSummary {
  count: number;
  views: MetricStats;
  reach: MetricStats;
  /** Комментарии ÷ охват — вход в директ-автоматизацию по кодовому слову. */
  commentRate: MetricStats;
  best: IgMedia | null;
}

export function summarize(media: IgMedia[]): IgSummary {
  const rates = media.map((m) => (m.reach && m.comments !== null ? m.comments / m.reach : null));
  const best = media.reduce<IgMedia | null>((b, m) => ((m.views ?? -1) > (b?.views ?? -1) ? m : b), null);
  return {
    count: media.length,
    views: stats(media.map((m) => m.views)),
    reach: stats(media.map((m) => m.reach)),
    commentRate: stats(rates),
    best,
  };
}

/** Срез по Instagram для AI-ассистента. */
export function instagramContext(conn: IgConnection, media: IgMedia[]): string {
  const s = summarize(media);
  if (!s.count) return `Instagram @${conn.username}: публикаций со словом «${conn.keyword}» не найдено.`;
  const n = (x: number | null) => (x === null ? "—" : fmtInt(x));
  const p = (x: number | null) => (x === null ? "—" : fmtPct(x, 2));
  const top = [...media]
    .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
    .slice(0, 10)
    .map(
      (m) =>
        `- ${m.posted_at?.slice(0, 10) ?? "?"}: просмотры ${n(m.views)}, охват ${n(m.reach)}, комментарии ${n(m.comments)}, сохранения ${n(m.saved)}, репосты ${n(m.shares)} — «${m.caption.replace(/\s+/g, " ").slice(0, 80)}»`,
    );
  return [
    `Instagram @${conn.username}, публикации со словом «${conn.keyword}» за всё время: ${s.count}.`,
    `Просмотры: всего ${n(s.views.total)}, медиана ${n(s.views.median)}, лучшие 25% — от ${n(s.views.top)}.`,
    `Охват: всего ${n(s.reach.total)}, медиана ${n(s.reach.median)}.`,
    `Комментарии к охвату (вход в директ по кодовому слову): медиана ${p(s.commentRate.median)}, лучшие 25% — от ${p(s.commentRate.top)}.`,
    "Топ-10 по просмотрам:",
    ...top,
  ].join("\n");
}
