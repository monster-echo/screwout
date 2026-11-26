#!/usr/bin/env python3
"""
Economy Balance Simulator for Screw Jam (Levels 1-30).
Reads exact box counts from lv_0.json..lv_29.json and models Coins, Bolts,
Boosters, Pixel Gallery completions, First Coin Pinch, and Rewarded Ad triggers
across 3 overseas player archetypes.
"""
import json

STARTER_COINS = 220
STARTER_BOLTS = 15
STARTER_BOOSTERS = 6   # 2x slot + 2x clear + 2x melt
BOXES_PER_COIN = 4     # +1 Coin every 4 boxes
WIN_BASE_COINS = 30
WIN_BOLTS = 8
STREAK_PER_WIN = 5
STREAK_MAX = 15
COST_BOX = 80
COST_BOOSTER = 60
COST_REVIVE = 100

MILESTONES = {
    1: 40,
    2: 50,
    3: 50,
    4: 60,
}

GALLERY = [
    ("Lucky Cat", 60, 150, 1),
    ("Star Rocket", 43, 180, 1),
    ("Berry Cupcake", 38, 200, 1),
    ("Gem Crown", 43, 220, 1),
    ("Desert Bloom", 39, 240, 1),
    ("Cozy Cottage", 49, 300, 1),
]


def load_boxes(n=30):
    res = []
    for i in range(n):
        with open(f"/Users/echo/workspace/CocosGames/ScrewOut/assets/resources/levels/lv_{i}.json") as f:
            res.append(json.load(f)["totalHoles"] // 3)
    return res


def simulate(name, box_unlock_rate, booster_use_rate, revive_rate, buy_starter_at_lv=None):
    boxes_per_lv = load_boxes(30)
    coins = STARTER_COINS
    bolts = STARTER_BOLTS
    boosters = STARTER_BOOSTERS
    streak = 0
    gal_idx = 0
    gal_filled = 0

    total_in = STARTER_COINS
    total_out = 0
    rv_count = 0
    first_pinch_lv = None
    snapshots = []

    for lv in range(1, 31):
        if buy_starter_at_lv == lv:
            coins += 500
            bolts += 40
            boosters += 9
            total_in += 500

        # Streak >= 5 gives free 3rd box at start (high-value streak protection incentive!)
        effective_box_need = 0 if (lv == 1 or streak >= 5) else box_unlock_rate(lv)
        effective_boost_need = 0 if lv == 1 else booster_use_rate(lv)
        effective_revive_need = 0 if lv == 1 else revive_rate(lv)

        for _ in range(effective_box_need):
            if coins >= COST_BOX:
                coins -= COST_BOX
                total_out += COST_BOX
            else:
                rv_count += 1
                if first_pinch_lv is None:
                    first_pinch_lv = lv

        for _ in range(effective_boost_need):
            if boosters > 0:
                boosters -= 1
            elif coins >= COST_BOOSTER:
                coins -= COST_BOOSTER
                total_out += COST_BOOSTER
            else:
                rv_count += 1
                if first_pinch_lv is None:
                    first_pinch_lv = lv

        for _ in range(effective_revive_need):
            if coins >= COST_REVIVE:
                coins -= COST_REVIVE
                total_out += COST_REVIVE
            else:
                rv_count += 1
                if first_pinch_lv is None:
                    first_pinch_lv = lv

        streak += 1
        box_coins = boxes_per_lv[lv - 1] // BOXES_PER_COIN
        streak_bonus = min(STREAK_MAX, streak * STREAK_PER_WIN)
        ms_coins = MILESTONES.get(lv, 0)
        lv_in = box_coins + WIN_BASE_COINS + streak_bonus + ms_coins
        coins += lv_in
        total_in += lv_in
        bolts += WIN_BOLTS

        while gal_idx < len(GALLERY) and bolts > 0:
            _, req, rew_c, rew_b = GALLERY[gal_idx]
            need = req - gal_filled
            use = min(need, bolts)
            bolts -= use
            gal_filled += use
            if gal_filled >= req:
                coins += rew_c
                total_in += rew_c
                boosters += rew_b
                gal_idx += 1
                gal_filled = 0

        if lv in (1, 3, 5, 8, 10, 15, 20, 30):
            snapshots.append((lv, coins, boosters, rv_count, gal_idx))

    print(f"\n=== {name} ===")
    print(f"First Coin Pinch (first RV): Lv {first_pinch_lv or 'None'}")
    print(f"Lv 1-30 Inflow={total_in}C, CoinSink={total_out}C, EndCoins={coins}C, TotalRV={rv_count} ({rv_count/30:.2f}/lv), ArtDone={gal_idx}/6")
    for lv, c, b, rv, g in snapshots:
        print(f"  Lv {lv:2d} | {c:5d}C | {b:2d} boosts | {rv:2d} RV | {g}/6 art")


if __name__ == "__main__":
    simulate(
        "Casual F2P (1 box unlock pre-streak5, 1-2 boosters/lv, revive every 2 lvs)",
        box_unlock_rate=lambda lv: 1 if lv >= 2 else 0,
        booster_use_rate=lambda lv: 1 if lv <= 4 else (2 if lv % 2 == 0 else 1),
        revive_rate=lambda lv: 1 if (lv >= 3 and lv % 2 == 1) else 0,
    )
    simulate(
        "Skilled F2P (1 box on Lv2-3, 1 booster every 2 lvs, rare revive every 5 lvs)",
        box_unlock_rate=lambda lv: 1 if lv in (2, 3) else 0,
        booster_use_rate=lambda lv: 1 if lv % 2 == 0 else 0,
        revive_rate=lambda lv: 1 if (lv >= 8 and lv % 5 == 0) else 0,
    )
    simulate(
        "Light Spender (buys $1.99 Starter Pack @ Lv 10)",
        box_unlock_rate=lambda lv: 1 if lv >= 2 else 0,
        booster_use_rate=lambda lv: 1 if lv <= 4 else 2,
        revive_rate=lambda lv: 1 if (lv >= 3 and lv % 2 == 1) else 0,
        buy_starter_at_lv=10,
    )
