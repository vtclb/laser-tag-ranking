function exportResults() {
  const winner = document.getElementById("winner").value || "Нічия";
  const mvp = document.getElementById("mvp").value;
  const penaltyRaw = document.getElementById("penalty").value;
  const league = document.getElementById("league").value;

  const team1 = window.lastTeam1 || [];
  const team2 = window.lastTeam2 || [];

  const penalties = penaltyRaw
    .split(",")
    .map(p => p.trim().split(":")[0])
    .filter(p => p);

  const data = {
    league,
    team1: team1.map(p => p.nickname).join(", "),
    team2: team2.map(p => p.nickname).join(", "),
    winner,
    mvp,
    penalties: penalties.join(", ")
  };

  const formBody = Object.entries(data)
    .map(([key, val]) => `${encodeURIComponent(key)}=${encodeURIComponent(val)}`)
    .join("&");

  console.log("⏱ Відправляємо:", formBody);

  fetch("https://laser-proxy.vartaclub.workers.dev", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: formBody
  })
    .then(res => res.text())
    .then(txt => {
      alert("Результат збережено: " + txt);
    })
    .catch(err => {
      alert("❌ Помилка при збереженні: " + err);
    });
}
