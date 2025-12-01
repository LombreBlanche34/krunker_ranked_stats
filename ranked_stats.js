// ============================================
// 1. INTERCEPT API AND RETRIEVE DATA
// ============================================

let matchData = null;

const originalFetch = window.fetch;
window.fetch = function (...args) {
    let url = args[0];

    if (typeof url === 'string' && url.includes('api.krunker.io/match-history')) {
        console.log('Krunker API request detected!');

        // Modify limit=5 to limit=500
        if (url.includes('limit=5')) {
            args[0] = url.replace('limit=5', 'limit=500');
            console.log('Limit modified from 5 to 500');
        }

        // Intercept response
        return originalFetch.apply(this, args).then(response => {
            const clonedResponse = response.clone();

            clonedResponse.json().then(data => {
                console.log('Data received:', data);
                matchData = data;

                // Create charts once data is retrieved
                createCharts(data);
            });

            return response;
        });
    }

    return originalFetch.apply(this, args);
};

// ============================================
// 2. LOAD CHART.JS IF NECESSARY
// ============================================

function loadChartJS(callback) {
    if (typeof Chart !== 'undefined') {
        callback();
        return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
    script.onload = callback;
    document.head.appendChild(script);
    console.log('Loading Chart.js');
}

// ============================================
// 2.5. ADD GLOBAL CSS STYLES
// ============================================

function addGlobalStyles() {
    // Check if style already exists
    if (document.getElementById('krunker-stats-global-styles')) {
        return;
    }

    const styleElement = document.createElement('style');
    styleElement.id = 'krunker-stats-global-styles';
    styleElement.textContent = `
        .content.svelte-mqcul7 {
            overflow-y: initial !important;
            min-height: auto !important;
        }
    `;
    document.head.appendChild(styleElement);
    console.log('Global CSS styles added');
}

// ============================================
// 3. CREATE CONTAINER FOR CHARTS
// ============================================

function createChartContainer() {
    // Add global styles
    addGlobalStyles();

    // Remove old container if it exists
    const oldContainer = document.getElementById('krunker-stats-container');
    if (oldContainer) {
        oldContainer.remove();
    }

    const targetElement = document.querySelector("#genericPop > div > div.container.svelte-mqcul7 > div.content.svelte-mqcul7");

    if (!targetElement) {
        console.log('Target element not found');
        return null;
    }

    // Make parent scrollable if not already
    const parentContainer = targetElement.parentNode;
    if (parentContainer) {
        parentContainer.style.overflowY = 'auto';
        parentContainer.style.maxHeight = '100%';
    }

    const container = document.createElement('div');
    container.id = 'krunker-stats-container';
    container.className = 'content svelte-mqcul7';

    container.innerHTML = `
        <h2 style="color: #fff; text-align: center; margin-bottom: 20px;">📊 Match Statistics</h2>
        <div style="text-align: center; padding: 10px;">
            <button id="toggleChartsBtn" style="
                background: rgba(76, 175, 80, 0.8);
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 5px;
                cursor: pointer;
                font-size: 14px;
                font-weight: bold;
            ">
                ▼ Hide statistics
            </button>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px; margin-bottom: 20px;">
            <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px;">
                <canvas id="killsDeathsChart"></canvas>
            </div>
            <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px;">
                <canvas id="accuracyChart"></canvas>
            </div>
            <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px;">
                <canvas id="scoreChart"></canvas>
            </div>
            <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px;">
                <canvas id="mmrChart"></canvas>
            </div>
            <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px;">
                <canvas id="kdRatioChart"></canvas>
            </div>
            <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px;">
                <canvas id="headshotChart"></canvas>
            </div>
        </div>
    `;

    targetElement.parentNode.insertBefore(container, targetElement);

    // Add button to hide/show
    const toggleBtn = container.querySelector('#toggleChartsBtn');
    const chartsContainer = document.querySelector("#krunker-stats-container > div:nth-child(3)")

    toggleBtn.addEventListener('click', () => {
        if (chartsContainer.style.display === 'none') {
            chartsContainer.style.display = 'grid';
            toggleBtn.textContent = '▼ Hide statistics';
            toggleBtn.style.background = 'rgba(76, 175, 80, 0.8)';
        } else {
            chartsContainer.style.display = 'none';
            toggleBtn.textContent = '▶ Show statistics';
            toggleBtn.style.background = 'rgba(33, 150, 243, 0.8)';
        }
    });

    console.log('Container created');

    return container;
}

// ============================================
// 4. EXTRACT PLAYER DATA
// ============================================

function extractPlayerData(data) {
    const matches = data.data.matchHistory.matches;
    const playerName = localStorage.getItem("krunker_username"); // Your player name

    const playerStats = matches.map(match => {
        const playerEntry = match.historyEntries.find(
            entry => entry.player_name === playerName
        );

        if (!playerEntry) return null;

        return {
            date: new Date(match.date),
            kills: playerEntry.kills,
            deaths: playerEntry.deaths,
            kdRatio: (playerEntry.kills / Math.max(playerEntry.deaths, 1)).toFixed(2),
            accuracy: playerEntry.accuracy,
            headshots: playerEntry.headshots,
            score: playerEntry.score,
            mmrChange: playerEntry.mmr_change,
            damage: playerEntry.damage_done,
            assists: playerEntry.assists,
            map: match.map,
            won: (playerEntry.team === 1 && match.score_alpha > match.score_bravo) ||
                (playerEntry.team === 2 && match.score_bravo > match.score_alpha)
        };
    }).filter(stat => stat !== null);

    // Reverse to get chronological order
    return playerStats.reverse();
}

// ============================================
// 5. CREATE CHARTS
// ============================================

function createCharts(data) {
    loadChartJS(() => {
        const container = createChartContainer();
        if (!container) return;

        const stats = extractPlayerData(data);
        console.log('Statistics extracted:', stats);

        const labels = stats.map((s, i) => `Match ${i + 1}`);

        // Common configuration
        const commonOptions = {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    labels: {
                        color: '#fff'
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: '#fff'
                    },
                    grid: {
                        color: 'rgba(255,255,255,0.1)'
                    }
                },
                y: {
                    ticks: {
                        color: '#fff'
                    },
                    grid: {
                        color: 'rgba(255,255,255,0.1)'
                    }
                }
            }
        };

        // 1. Kills vs Deaths Chart
        new Chart(document.getElementById('killsDeathsChart'), {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                        label: 'Kills',
                        data: stats.map(s => s.kills),
                        borderColor: '#4CAF50',
                        backgroundColor: 'rgba(76, 175, 80, 0.2)',
                        tension: 0.4
                    },
                    {
                        label: 'Deaths',
                        data: stats.map(s => s.deaths),
                        borderColor: '#f44336',
                        backgroundColor: 'rgba(244, 67, 54, 0.2)',
                        tension: 0.4
                    }
                ]
            },
            options: {
                ...commonOptions,
                plugins: {
                    ...commonOptions.plugins,
                    title: {
                        display: true,
                        text: 'Kills vs Deaths',
                        color: '#fff'
                    }
                }
            }
        });

        // 2. Accuracy Chart
        new Chart(document.getElementById('accuracyChart'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Accuracy (%)',
                    data: stats.map(s => s.accuracy),
                    backgroundColor: stats.map(s =>
                        s.accuracy > 30 ? 'rgba(76, 175, 80, 0.7)' : 'rgba(255, 152, 0, 0.7)'
                    ),
                    borderColor: '#2196F3',
                    borderWidth: 2
                }]
            },
            options: {
                ...commonOptions,
                plugins: {
                    ...commonOptions.plugins,
                    title: {
                        display: true,
                        text: 'Accuracy per Match',
                        color: '#fff'
                    }
                }
            }
        });

        // 3. Score Chart
        new Chart(document.getElementById('scoreChart'), {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Score',
                    data: stats.map(s => s.score),
                    borderColor: '#FF9800',
                    backgroundColor: 'rgba(255, 152, 0, 0.2)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                ...commonOptions,
                plugins: {
                    ...commonOptions.plugins,
                    title: {
                        display: true,
                        text: 'Score per Match',
                        color: '#fff'
                    }
                }
            }
        });

        // 4. MMR Chart
        new Chart(document.getElementById('mmrChart'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'MMR Change',
                    data: stats.map(s => s.mmrChange),
                    backgroundColor: stats.map(s =>
                        s.mmrChange > 0 ? 'rgba(76, 175, 80, 0.7)' : 'rgba(244, 67, 54, 0.7)'
                    ),
                    borderColor: '#fff',
                    borderWidth: 1
                }]
            },
            options: {
                ...commonOptions,
                plugins: {
                    ...commonOptions.plugins,
                    title: {
                        display: true,
                        text: 'MMR Change',
                        color: '#fff'
                    }
                }
            }
        });

        // 5. K/D Ratio Chart
        new Chart(document.getElementById('kdRatioChart'), {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'K/D Ratio',
                    data: stats.map(s => s.kdRatio),
                    borderColor: '#9C27B0',
                    backgroundColor: 'rgba(156, 39, 176, 0.2)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                ...commonOptions,
                plugins: {
                    ...commonOptions.plugins,
                    title: {
                        display: true,
                        text: 'K/D Ratio',
                        color: '#fff'
                    }
                }
            }
        });

        // 6. Headshots Chart
        new Chart(document.getElementById('headshotChart'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Headshots',
                    data: stats.map(s => s.headshots),
                    backgroundColor: 'rgba(233, 30, 99, 0.7)',
                    borderColor: '#E91E63',
                    borderWidth: 2
                }]
            },
            options: {
                ...commonOptions,
                plugins: {
                    ...commonOptions.plugins,
                    title: {
                        display: true,
                        text: 'Headshots per Match',
                        color: '#fff'
                    }
                }
            }
        });

        console.log('All charts have been created!');
    });
}

console.log(`[LombreScripts] [ranked_stats.js] Configuration loaded`);