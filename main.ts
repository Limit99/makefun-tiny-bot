// Tiny Bot, Easy 2 Beat — a mean-reversion paper bot for hourly Solana bars.
// Strategy: RSI(14) mean reversion, checked every 3 bars. Buy an asset whose
// RSI(14) has fallen under 30 (oversold on the hour), hold it while RSI stays
// under 60, and sell when RSI reaches 60 or the position has been held 12 bars.
// Each buy is 25% of equity at most (the harness weight cap), so at most four
// positions are open at once and the rest stays in USDC. Sells are sent on one
// bar and the buys they fund on the next, because a sell's proceeds never fund
// a buy in the same reply. The bot is fully deterministic: no clock, no
// randomness, no network, no outside data — two runs give byte-identical logs.
//
// Why this shape: on the kit's dev window (136 hourly bars, Oct 29–Nov 3 2026)
// buy-and-hold loses $869 on $10,000 while every trend-following house baseline
// also loses; hourly memecoin prices mean-revert instead. RSI mean reversion
// with a short maximum hold was the best of the rules tried in a local
// backtest: it also keeps trading often enough (37 trades on dev, about 19
// expected on a 72-bar final window) to clear the 8-trade guardrail, which the
// slower RSI variant (buy <25, sell >75) fails — it only makes 10 trades on
// the whole dev window. A dip-entry variant (buy a 6-hour drop of 4%+) was
// tried and rejected: it lost money on dev, so it is not in this bot.
//
// Dev result (kit grade-local, process driver): net PnL +$244.6 (+2.45%),
// 37 trades, max drawdown 3.7%, 90% interval +$124..+$359 — above
// buy-and-hold (-$869) and above the best house baseline, MACD-CCI (-$20).
// The final window is unseen 72 hourly bars, so this is a base rate, not a
// promise: the bot beats buy-and-hold on about 7 in 10 rolling 72-bar windows
// of the dev data, and loses less than buy-and-hold on most of the rest.

import { BPS, runBars, type BarsState, type BuyInput, type OrderInput } from './vendor/makefun-bars.ts';

// RSI period in bars (hours), and the oversold / exit thresholds.
const PERIOD = 14;
const BUY_RSI = 30;
const SELL_RSI = 60;
// Rebalance every 3 bars; never hold one position longer than 12 bars.
const EVERY = 3;
const MAX_HOLD_BARS = 12;
// Slippage bound left wide open, as the house baselines do: the fill is
// priced at the next bar's open, moved by the modelled slippage and impact.
const MAX_SLIPPAGE_BPS = 10_000;

/** Each symbol's latest closes, oldest first, one entry per batch seen. */
const history = new Map<string, (bigint | null)[]>();
/** The bar (seq minus warm-up) each open position was bought on. */
const entryBar = new Map<string, number>();
/** Symbols to buy on the next batch, chosen on the bar their sells went out. */
let pendingBuys: string[] | null = null;

/** RSI(14) of a symbol from its closes so far, or null before it has history. */
function rsi(symbol: string): number | null {
  const closes = history.get(symbol)!;
  const k = closes.length - 1;
  if (k < PERIOD) return null;
  let gains = 0;
  let losses = 0;
  for (let i = k - PERIOD + 1; i <= k; i++) {
    const now = closes[i]!;
    const prev = closes[i - 1]!;
    if (now > prev) gains += Number(now - prev);
    else losses += Number(prev - now);
  }
  if (losses === 0) return 100;
  return 100 - 100 / (1 + gains / losses);
}

/** Equal-weight buys of the symbols given, each capped at 25% of equity. */
function buys(state: BarsState, symbols: string[]): BuyInput[] {
  const coming = symbols.filter((s) => !state.positions.has(s) && state.close(s) !== null);
  if (coming.length === 0) return [];
  const even = state.cash / BigInt(coming.length);
  const byWeight = (BigInt(state.hello.caps.max_weight_bps) * state.equity) / BPS;
  const slice = even < byWeight ? even : byWeight;
  if (slice < BigInt(state.hello.fees.min_notional_quote_units)) return [];
  return coming.map((symbol): BuyInput => ({ side: 'buy', symbol, notional_quote_units: slice, max_slippage_bps: MAX_SLIPPAGE_BPS }));
}

await runBars({
  onBatch(state, batch) {
    for (const { symbol } of state.hello.symbols) {
      const closes = history.get(symbol) ?? [];
      closes.push(state.close(symbol));
      history.set(symbol, closes);
    }
    // Warm-up bars build history only; every order on one is rejected.
    if (state.warmingUp) return [];
    const k = batch.seq - state.warmupBars;

    // The buys funded by the previous bar's sells go out now.
    if (pendingBuys !== null) {
      const symbols = pendingBuys;
      pendingBuys = null;
      return buys(state, symbols);
    }
    if (k < PERIOD || k % EVERY !== 0) return [];

    const want: string[] = [];
    for (const { symbol } of state.hello.symbols) {
      const value = rsi(symbol);
      if (value === null) continue;
      if (state.positions.has(symbol)) {
        const bought = entryBar.get(symbol) ?? k;
        if (value < SELL_RSI && k - bought < MAX_HOLD_BARS) want.push(symbol);
        else entryBar.delete(symbol);
      } else if (value < BUY_RSI) {
        want.push(symbol);
        entryBar.set(symbol, k);
      }
    }

    const sells: OrderInput[] = [...state.positions]
      .filter(([symbol]) => !want.includes(symbol))
      .map(([symbol, p]) => {
        entryBar.delete(symbol);
        return { side: 'sell', symbol, qty: p.qty, max_slippage_bps: MAX_SLIPPAGE_BPS };
      });
    if (sells.length > 0) {
      pendingBuys = want;
      return sells;
    }
    return buys(state, want);
  },
});
