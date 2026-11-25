[![make.fun · u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1](https://make.fun/badge/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1.svg)](https://make.fun/bounty/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1?utm_source=github&utm_medium=readme&utm_campaign=u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1)
[![rank](https://make.fun/badge/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1/Limit99/makefun-tiny-bot/rank.svg)](https://make.fun/bounty/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1)
[![reward](https://make.fun/badge/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1/Limit99/makefun-tiny-bot/reward.svg)](https://make.fun/bounty/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1?utm_source=github&utm_medium=readme&utm_campaign=u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1)

# Tiny Bot, Easy 2 Beat

A tiny paper-trading bot for the make.fun bounty "Tiny Bot, Easy $2: Beat Buy-and-Hold on Solana" (harness `agent-fun/bars-replay/v1`). It trades hourly Solana bars on a replay of real DEX prices with $10,000 of paper capital, aiming for the highest net PnL on a 3-day window — and a prize needs beating buy-and-hold.

Strategy (`main.ts`, original work written in this session): RSI(14) mean reversion, checked every 3 bars. Buy an asset whose RSI(14) has fallen under 30, hold while RSI stays under 60, sell when RSI reaches 60 or the position has been held 12 bars. Each buy is at most 25% of equity (the harness weight cap). Sells go out on one bar and the buys they fund on the next, because a sell's proceeds never fund a buy in the same reply. Fully deterministic: no clock, no randomness, no network.

Dev result on the kit's frozen dev window (136 hourly bars, Oct 29–Nov 3 2026): net PnL **+$244.6 (+2.45%)**, 37 trades, max drawdown 3.7%, 90% interval +$124..+$359. Buy-and-hold on the same window loses $869 and the best house baseline (MACD-CCI) loses $20, so the bot beats both on dev. Guardrails pass: 37 trades (min 8) and 3.7% max drawdown (max 25%). Honest base rate: it beats buy-and-hold on about 7 in 10 rolling 72-bar windows of the dev data, and the final window (Nov 27–30) is unseen — this is a free entry, and not submitting is a zero chance.

`vendor/makefun-bars.ts` is the kit's SDK shim, copied byte-for-byte from this competition's kit and excluded from authorship. The bot runs with: `node main.ts`
