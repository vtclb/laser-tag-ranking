from __future__ import annotations

import csv
import datetime as dt
import math
import os
import statistics
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable


BASE_DOWNLOADS = Path(r"C:\Users\Admin\Downloads")
OUTPUT_DIR = Path(r"C:\Users\Admin\Documents\New project\laser-tag-ranking-main")

SEASON_NAME = "Осінь 2025"
SEASON_ID = "autumn_2025"
LEAGUES = ("kids", "sundaygames")
TS_FMT = "%d.%m.%Y %H:%M:%S"


def find_download_file(needle: str, suffix: str | None = None) -> Path:
    for name in os.listdir(BASE_DOWNLOADS):
        if needle in name and (suffix is None or name.lower().endswith(suffix.lower())):
            return BASE_DOWNLOADS / name
    raise FileNotFoundError(f"Could not find file containing {needle!r} with suffix {suffix!r} in Downloads")


def normalize_name(value: str) -> str:
    return " ".join(str(value or "").replace("\xa0", " ").strip().split())


def parse_players(raw: str) -> list[str]:
    text = str(raw or "")
    for sep in ("\r\n", "\n", ";"):
        text = text.replace(sep, ",")
    players = [normalize_name(part) for part in text.split(",")]
    return [p for p in players if p]


def parse_int(value: str) -> int:
    text = str(value or "").strip().replace(",", ".")
    if not text:
        return 0
    return int(round(float(text)))


def parse_float(value: str) -> float:
    text = str(value or "").strip().replace(",", ".")
    if not text:
        return 0.0
    return float(text)


def parse_timestamp(value: str) -> dt.datetime | None:
    text = normalize_name(value)
    if not text:
        return None
    try:
        return dt.datetime.strptime(text, TS_FMT)
    except ValueError:
        return None


def rank_letter(points: float) -> str:
    points = float(points or 0)
    if points >= 1200:
        return "S"
    if points >= 1000:
        return "A"
    if points >= 800:
        return "B"
    if points >= 600:
        return "C"
    if points >= 400:
        return "D"
    if points >= 200:
        return "E"
    return "F"


@dataclass
class PlayerStats:
    nickname: str
    leaderboard_points: int | None = None
    matches: int = 0
    wins: int = 0
    losses: int = 0
    mvp1: int = 0
    mvp2: int = 0
    mvp3: int = 0
    penalties_total: int = 0
    rating_history: list[tuple[dt.datetime, int, int]] = field(default_factory=list)

    @property
    def mvp_total(self) -> int:
        return self.mvp1 + self.mvp2 + self.mvp3

    @property
    def winrate(self) -> float:
        return (self.wins / self.matches * 100.0) if self.matches else 0.0

    @property
    def rating_end(self) -> int:
        if self.rating_history:
            return self.rating_history[-1][2]
        return int(self.leaderboard_points or 0)

    @property
    def rating_start(self) -> int:
        if self.rating_history:
            _, first_delta, first_new = self.rating_history[0]
            return int(first_new - first_delta)
        return int(self.leaderboard_points or 0)

    @property
    def rating_delta(self) -> int:
        return int(self.rating_end - self.rating_start)

    @property
    def avg_rating(self) -> float:
        values = [new_points for _, _, new_points in self.rating_history]
        if values:
            return float(sum(values) / len(values))
        return float(self.rating_end)

    @property
    def stability_std(self) -> float:
        values = [new_points for _, _, new_points in self.rating_history]
        if len(values) >= 2:
            return float(statistics.pstdev(values))
        return 0.0


def get_player(store: dict[str, PlayerStats], nick: str) -> PlayerStats:
    nick = normalize_name(nick)
    if nick not in store:
        store[nick] = PlayerStats(nickname=nick)
    return store[nick]


def collect_leaderboard_rows(rows: list[list[str]], nick_idx: int, points_idx: int) -> list[tuple[str, int]]:
    items: list[tuple[str, int]] = []
    seen: set[str] = set()
    for row in rows[2:]:
        if len(row) <= points_idx:
            continue
        nick = normalize_name(row[nick_idx])
        if not nick:
            continue
        points_text = normalize_name(row[points_idx])
        if not points_text:
            continue
        points = parse_int(points_text)
        if nick in seen:
            continue
        seen.add(nick)
        items.append((nick, points))
    return items


def iter_games(rows: list[list[str]]) -> Iterable[dict]:
    for row in rows[2:]:
        if len(row) <= 18:
            continue
        ts = parse_timestamp(row[9])
        league = normalize_name(row[10]).lower()
        team1_raw = normalize_name(row[11])
        team2_raw = normalize_name(row[12])
        winner = normalize_name(row[13]).lower()
        if not ts or league not in LEAGUES or not team1_raw or not team2_raw or not winner:
            continue
        team1 = parse_players(team1_raw)
        team2 = parse_players(team2_raw)
        if not team1 or not team2:
            continue
        yield {
            "timestamp": ts,
            "league": league,
            "team1": team1,
            "team2": team2,
            "winner": winner,
            "mvp1": normalize_name(row[14]),
            "mvp2": normalize_name(row[15]),
            "mvp3": normalize_name(row[16]),
            "series": normalize_name(row[17]),
            "penalties": normalize_name(row[18]),
        }


def iter_rating_logs(rows: list[list[str]]) -> Iterable[dict]:
    for row in rows[2:]:
        if len(row) <= 25:
            continue
        ts = parse_timestamp(row[21])
        league = normalize_name(row[22]).lower()
        nick = normalize_name(row[23])
        if not ts or league not in LEAGUES or not nick:
            continue
        delta = parse_int(row[24])
        new_points = parse_int(row[25])
        yield {
            "timestamp": ts,
            "league": league,
            "nickname": nick,
            "delta": delta,
            "new_points": new_points,
        }


def parse_series_length(series: str) -> int | None:
    text = normalize_name(series)
    if not text or "-" not in text:
        return None
    left, right = text.split("-", 1)
    if not left.isdigit() or not right.isdigit():
        return None
    return int(left) + int(right)


def parse_penalties(raw: str) -> list[tuple[str, int]]:
    text = normalize_name(raw)
    if not text:
        return []
    results: list[tuple[str, int]] = []
    for item in text.split(","):
        if ":" not in item:
            continue
        nick, value = item.split(":", 1)
        nick = normalize_name(nick)
        if not nick:
            continue
        try:
            penalty = abs(parse_int(value))
        except ValueError:
            continue
        results.append((nick, penalty))
    return results


def main() -> None:
    csv_path = find_download_file("ocinb2025", ".csv")
    with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
        rows = list(csv.reader(f))

    players_by_league: dict[str, dict[str, PlayerStats]] = {league: {} for league in LEAGUES}
    leaderboard_columns = {
        "sundaygames": (2, 3),
        "kids": (6, 7),
    }

    for league, (nick_idx, points_idx) in leaderboard_columns.items():
        for nick, points in collect_leaderboard_rows(rows, nick_idx, points_idx):
            get_player(players_by_league[league], nick).leaderboard_points = points

    games_by_league: dict[str, list[dict]] = {league: [] for league in LEAGUES}
    series_counter: dict[str, Counter[int]] = {league: Counter() for league in LEAGUES}
    total_penalties_by_league: dict[str, int] = {league: 0 for league in LEAGUES}
    all_game_times: list[dt.datetime] = []

    for game in iter_games(rows):
        league = game["league"]
        games_by_league[league].append(game)
        all_game_times.append(game["timestamp"])
        team1 = game["team1"]
        team2 = game["team2"]
        team1_won = game["winner"] == "team1"
        team2_won = game["winner"] == "team2"

        for nick in team1 + team2:
            get_player(players_by_league[league], nick)

        for nick in team1:
            player = get_player(players_by_league[league], nick)
            player.matches += 1
            if team1_won:
                player.wins += 1
            elif team2_won:
                player.losses += 1

        for nick in team2:
            player = get_player(players_by_league[league], nick)
            player.matches += 1
            if team2_won:
                player.wins += 1
            elif team1_won:
                player.losses += 1

        if game["mvp1"]:
            get_player(players_by_league[league], game["mvp1"]).mvp1 += 1
        if game["mvp2"]:
            get_player(players_by_league[league], game["mvp2"]).mvp2 += 1
        if game["mvp3"]:
            get_player(players_by_league[league], game["mvp3"]).mvp3 += 1

        for nick, penalty in parse_penalties(game["penalties"]):
            get_player(players_by_league[league], nick).penalties_total += penalty
            total_penalties_by_league[league] += penalty

        series_length = parse_series_length(game["series"])
        if series_length is not None:
            series_counter[league][series_length] += 1

    for log in iter_rating_logs(rows):
        player = get_player(players_by_league[log["league"]], log["nickname"])
        player.rating_history.append((log["timestamp"], log["delta"], log["new_points"]))

    for league in LEAGUES:
        for player in players_by_league[league].values():
            player.rating_history.sort(key=lambda item: item[0])

    start_dt = min(all_game_times)
    end_dt = max(all_game_times)
    season_days = (end_dt.date() - start_dt.date()).days + 1
    season_weeks = season_days / 7.0 if season_days else 1.0

    rows_out: list[list[str]] = []
    rows_out.append([SEASON_NAME])
    rows_out.append([f"Сезон ID: {SEASON_ID}"])
    rows_out.append(["##SEASON_META"])
    rows_out.append(["Season", "Season_id", "Generated_at", "Start_dt", "End_dt", "Total_matches_all", "Leagues"])
    rows_out.append([
        SEASON_NAME,
        SEASON_ID,
        dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
        start_dt.isoformat(sep=" "),
        end_dt.isoformat(sep=" "),
        str(sum(len(items) for items in games_by_league.values())),
        ",".join(LEAGUES),
    ])

    rows_out.append(["##LEAGUE_SUMMARY"])
    rows_out.append(["Season", "League", "Total_matches", "Total_players", "Avg_players_per_match", "Total_penalties", "Avg_rating_end"])
    for league in LEAGUES:
        players = list(players_by_league[league].values())
        games = games_by_league[league]
        total_matches = len(games)
        total_players = len(players)
        total_participants = sum(len(game["team1"]) + len(game["team2"]) for game in games)
        avg_players = (total_participants / total_matches) if total_matches else 0.0
        avg_rating_end = (sum(p.rating_end for p in players) / total_players) if total_players else 0.0
        rows_out.append([
            SEASON_NAME,
            league,
            str(total_matches),
            str(total_players),
            f"{avg_players:.2f}",
            str(total_penalties_by_league[league]),
            f"{avg_rating_end:.2f}",
        ])

    rows_out.append(["##AWARDS"])
    rows_out.append(["Season", "League", "Award", "Nickname", "Value"])
    for league in LEAGUES:
        players = list(players_by_league[league].values())
        if not players:
            continue
        best_player = max(players, key=lambda p: (p.rating_end, p.matches))
        mvp_leader = max(players, key=lambda p: (p.mvp_total, p.mvp1, p.matches, p.rating_end))
        most_active = max(players, key=lambda p: (p.matches, p.wins, p.rating_end))
        most_penalties = max(players, key=lambda p: (p.penalties_total, p.matches, p.rating_end))
        best_progress = max(players, key=lambda p: (p.rating_delta, p.rating_end))
        awards = [
            ("Best_player", best_player.nickname, best_player.rating_end),
            ("MVP_leader", mvp_leader.nickname, mvp_leader.mvp_total),
            ("Most_active", most_active.nickname, most_active.matches),
            ("Most_penalties", most_penalties.nickname, most_penalties.penalties_total),
            ("Best_progress", best_progress.nickname, best_progress.rating_delta),
        ]
        for award, nick, value in awards:
            rows_out.append([SEASON_NAME, league, award, nick, str(value)])

    rows_out.append([])
    rows_out.append(["##SERIES_SUMMARY"])
    rows_out.append(["Season", "League", "Series_length", "Matches_count", "Percent"])
    for league in LEAGUES:
        total_series = sum(series_counter[league].values())
        for series_length in sorted(series_counter[league]):
            count = series_counter[league][series_length]
            percent = (count / total_series * 100.0) if total_series else 0.0
            rows_out.append([SEASON_NAME, league, str(series_length), str(count), f"{percent:.2f}"])

    rows_out.append(["##PLAYERS"])
    rows_out.append([
        "Season",
        "League",
        "Nickname",
        "Matches",
        "Wins",
        "Losses",
        "Winrate_%",
        "MVP1",
        "MVP2",
        "MVP3",
        "MVP_total",
        "Penalties_total",
        "Rating_start",
        "Rating_end",
        "Rating_delta",
        "Avg_rating",
        "Stability_std",
        "Matches_per_week",
        "Season_activity_%",
        "Abonement_type",
        "Abonement_usage",
        "Rank_final",
    ])

    for league in LEAGUES:
        total_matches = max(len(games_by_league[league]), 1)
        players_sorted = sorted(
            players_by_league[league].values(),
            key=lambda p: (-p.rating_end, -p.matches, p.nickname.lower()),
        )
        for player in players_sorted:
            season_activity = player.matches / total_matches * 100.0
            matches_per_week = player.matches / season_weeks if season_weeks else 0.0
            rows_out.append([
                SEASON_NAME,
                league,
                player.nickname,
                str(player.matches),
                str(player.wins),
                str(player.losses),
                f"{player.winrate:.2f}",
                str(player.mvp1),
                str(player.mvp2),
                str(player.mvp3),
                str(player.mvp_total),
                str(player.penalties_total),
                str(player.rating_start),
                str(player.rating_end),
                str(player.rating_delta),
                f"{player.avg_rating:.2f}",
                f"{player.stability_std:.2f}",
                f"{matches_per_week:.2f}",
                f"{season_activity:.2f}",
                "",
                "",
                rank_letter(player.rating_end),
            ])

    output_tsv = OUTPUT_DIR / "season_autumn_2025_master_rebuilt.tsv"
    with output_tsv.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f, delimiter="\t", lineterminator="\n")
        writer.writerows(rows_out)

    output_csv = OUTPUT_DIR / "season_autumn_2025_master_rebuilt.csv"
    with output_csv.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f, lineterminator="\n")
        writer.writerows(rows_out)

    summary_path = OUTPUT_DIR / "season_autumn_2025_master_rebuilt_summary.txt"
    with summary_path.open("w", encoding="utf-8") as f:
        f.write(f"Season: {SEASON_NAME}\n")
        f.write(f"Start: {start_dt.isoformat(sep=' ')}\n")
        f.write(f"End: {end_dt.isoformat(sep=' ')}\n")
        f.write(f"Total matches: {sum(len(items) for items in games_by_league.values())}\n\n")
        for league in LEAGUES:
            players = list(players_by_league[league].values())
            best = max(players, key=lambda p: (p.rating_end, p.matches))
            mvp = max(players, key=lambda p: (p.mvp_total, p.mvp1, p.matches))
            active = max(players, key=lambda p: (p.matches, p.wins))
            f.write(f"[{league}]\n")
            f.write(f"players={len(players)} matches={len(games_by_league[league])} penalties={total_penalties_by_league[league]}\n")
            f.write(f"best={best.nickname} ({best.rating_end})\n")
            f.write(f"mvp={mvp.nickname} ({mvp.mvp_total})\n")
            f.write(f"active={active.nickname} ({active.matches})\n\n")

    print(output_tsv)
    print(output_csv)
    print(summary_path)


if __name__ == "__main__":
    main()
