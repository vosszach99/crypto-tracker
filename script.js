let chart;
let trades = [];

const alertThresholds = {
    XRP: { soft: 3.00, target: 4.00 },
    DOGE: { soft: 0.25, target: 0.30 },
    PEPE: { soft: 0.000010, target: 0.000012 },
    BONK: { soft: 0.000017, target: 0.000022 },
    SHIB: { soft: 0.000016, target: 0.000025 },
    WIF: { soft: 0.75, target: 1.25 }
};

const currentPrices = {};

async function fetchLivePrices() {
    const ids = ['ripple', 'dogecoin', 'pepe', 'bonk', 'shiba-inu', 'dogwifhat'];
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd`);
    const data = await res.json();
    Object.assign(currentPrices, {
        XRP: data.ripple?.usd || 0,
        DOGE: data.dogecoin?.usd || 0,
        PEPE: data.pepe?.usd || 0,
        BONK: data.bonk?.usd || 0,
        SHIB: data['shiba-inu']?.usd || 0,
        WIF: data.dogwifhat?.usd || 0
    });
}

async function loadTrades() {
    const res = await fetch('trades.json');
    trades = await res.json();
}

function updateProgressBar(totalValue) {
    const goal = 500;
    const percent = Math.min((totalValue / goal) * 100, 100);
    const bar = document.getElementById("progress-bar");
    const icon = document.getElementById("dollar-icon");
    const text = document.getElementById("progress-text");

    bar.style.width = `${percent}%`;
    icon.style.left = `calc(${percent}% - 15px)`;
    text.textContent = `Goal: $${totalValue.toFixed(2)} / $${goal}`;
}

function drawHoldingsTable(map, totalValue) {
    const tbody = document.getElementById("holdingsBody");
    tbody.innerHTML = "";
    for (const coin in map) {
        const upper = coin.toUpperCase();
        const cp = currentPrices[upper] || 0;
        const totalAmount = map[coin].reduce((sum, t) => sum + t.amount, 0);
        const totalInvested = map[coin].reduce((sum, t) => sum + t.amount * t.price, 0);
        const value = totalAmount * cp;
        const profit = value - totalInvested;
        const alert = cp >= alertThresholds[upper]?.target
            ? "<span class='alert' style='color:lime'>TARGET HIT!</span>"
            : cp >= alertThresholds[upper]?.soft
                ? "<span class='alert' style='color:yellow'>Soft Sell Zone</span>"
                : "—";

        tbody.innerHTML += `
      <tr>
        <td>${coin}</td>
        <td>${totalAmount.toLocaleString()}</td>
        <td>$${totalInvested.toFixed(2)}</td>
        <td>$${cp.toFixed(6)}</td>
        <td>$${value.toFixed(2)}</td>
        <td style="color:${profit >= 0 ? 'lime' : 'red'}">$${profit.toFixed(2)}</td>
        <td>${alert}</td>
      </tr>`;
    }
}

function drawTransactionsTable(data) {
    const tbody = document.getElementById("transactionsBody");
    tbody.innerHTML = "";
    for (const { coin, amount, price, date, location } of data) {
        const invested = amount * price;
        tbody.innerHTML += `
      <tr>
        <td>${coin}</td>
        <td>${amount.toLocaleString()}</td>
        <td>$${price.toFixed(6)}</td>
        <td>$${invested.toFixed(2)}</td>
        <td>${date}</td>
        <td>${location}</td>
      </tr>`;
    }
}

function calculateHoldingsAndChartData() {
    const dailyTotals = {};
    const coinDaily = {};
    const holdingsMap = {};
    let totalValue = 0;

    for (const { coin, amount, price, date } of trades) {
        const upper = coin.toUpperCase();
        const currentPrice = currentPrices[upper] || 0;
        const value = amount * currentPrice;
        totalValue += value;

        if (!dailyTotals[date]) dailyTotals[date] = 0;
        dailyTotals[date] += value;

        if (!coinDaily[upper]) coinDaily[upper] = {};
        if (!coinDaily[upper][date]) coinDaily[upper][date] = 0;
        coinDaily[upper][date] += value;

        if (!holdingsMap[coin]) holdingsMap[coin] = [];
        holdingsMap[coin].push({ amount, price, date });
    }

    drawHoldingsTable(holdingsMap, totalValue);
    drawTransactionsTable(trades);
    drawChart("ALL", dailyTotals, coinDaily);
    updateProgressBar(totalValue);
}

function drawChart(type, totals, perCoin) {
    const ctx = document.getElementById("portfolioChart").getContext("2d");
    if (chart) chart.destroy();

    let labels, data;
    if (type === "ALL") {
        labels = Object.keys(totals).sort();
        data = labels.map(date => totals[date]);
    } else {
        const coinData = perCoin[type] || {};
        labels = Object.keys(coinData).sort();
        data = labels.map(date => coinData[date]);
    }

    chart = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [{
                label: type === "ALL" ? "Total Portfolio Value (USD)" : `${type} Value`,
                data: data,
                borderColor: "lime",
                backgroundColor: "rgba(0,255,0,0.1)",
                tension: 0.2,
                fill: true
            }]
        },
        options: {
            scales: {
                x: { ticks: { color: "#ccc" } },
                y: { beginAtZero: true, ticks: { color: "#ccc" } }
            },
            plugins: {
                legend: { labels: { color: "#ccc" } }
            }
        }
    });
}

async function init() {
    await loadTrades();
    await fetchLivePrices();
    calculateHoldingsAndChartData();
    setInterval(async () => {
        await fetchLivePrices();
        calculateHoldingsAndChartData();
    }, 10000);
}

init();
