import type { Database } from "./supabase/database.types";

type PublicTradeRow = Database["public"]["Functions"]["get_public_trades"]["Returns"][number];

export interface TradeRow {
  id: string;
  createdAt: string;
  marketId: string;
  marketTitle: string;
  outcomeId: string;
  outcomeLabel: string;
  outcomeSort: number;
  side: "buy" | "sell";
  shares: number;
  points: number;
  avgPrice: number;
  probBefore: number;
  probAfter: number;
  traderName: string;
  isMe: boolean;
}

export function mapTradeRow(row: PublicTradeRow): TradeRow {
  return {
    id: row.id,
    createdAt: row.created_at,
    marketId: row.market_id,
    marketTitle: row.market_title,
    outcomeId: row.outcome_id,
    outcomeLabel: row.outcome_label,
    outcomeSort: row.outcome_sort,
    side: row.side === "sell" ? "sell" : "buy",
    shares: Number(row.shares),
    points: Number(row.points),
    avgPrice: Number(row.avg_price),
    probBefore: Number(row.prob_before),
    probAfter: Number(row.prob_after),
    traderName: row.trader_name,
    isMe: row.is_me,
  };
}

export interface ActivityFilterState {
  marketId: string | null;
  outcomeId: string | null;
  side: "buy" | "sell" | null;
  onlyMine: boolean;
}
