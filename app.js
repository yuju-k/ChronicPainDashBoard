// Constants
const PAIN_LABELS = {
    0: '통증없음',
    1: '허리',
    2: '등',
    3: '어깨'
};

const PAIN_SCORES = {
    0: '통증없음',
    1: '약함',
    2: '경증',
    3: '심함',
    4: '매우심함'
};

// State
let rawData = [];
let charts = {};

// DOM Elements
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const uploadSection = document.getElementById('upload-section');
const dashboardSection = document.getElementById('dashboard-section');
const fileInfo = document.getElementById('file-info');
const resetBtn = document.getElementById('reset-btn');

// Event Listeners
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
        handleFile(e.dataTransfer.files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
        handleFile(e.target.files[0]);
    }
});

resetBtn.addEventListener('click', resetApp);

// Functions
function handleFile(file) {
    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
        alert('CSV 파일만 업로드해주세요.');
        return;
    }

    fileInfo.textContent = `처리 중: ${file.name}...`;

    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        complete: function (results) {
            if (results.errors.length) {
                console.error("Errors:", results.errors);
                alert('파일 파싱 중 오류가 발생했습니다.');
                return;
            }
            rawData = results.data;
            fileInfo.textContent = '';
            showDashboard();
            processAndRenderData(rawData);
        },
        error: function (error) {
            console.error(error);
            alert('파일 읽기 실패');
        }
    });
}

function showDashboard() {
    uploadSection.classList.add('hidden');
    dashboardSection.classList.remove('hidden');
}

function resetApp() {
    rawData = [];
    // Destroy charts
    Object.values(charts).forEach(chart => chart.destroy());
    charts = {};

    fileInput.value = '';
    fileInfo.textContent = '';

    dashboardSection.classList.add('hidden');
    uploadSection.classList.remove('hidden');
}

function processAndRenderData(data) {
    if (!data || data.length === 0) return;

    // 1. Preprocess Data
    // Valid rows must have date, time, area, pain_score
    const validData = data.filter(row => row.date && row.time && row.area !== undefined && row.pain_score !== undefined);

    const processed = validData.map(row => {
        // Combine date and time
        const dateTimeStr = `${row.date} ${row.time}`;
        const dateObj = new Date(dateTimeStr);
        const hour = dateObj.getHours();

        return {
            ...row,
            dateObj: dateObj,
            hour: hour,
            day: row.date // YYYY-MM-DD
        };
    });

    processed.sort((a, b) => a.dateObj - b.dateObj);

    // 2. Aggregate Data

    // A. Daily Average Pain
    const dailyMap = {};
    processed.forEach(item => {
        if (!dailyMap[item.day]) dailyMap[item.day] = [];
        dailyMap[item.day].push(item.pain_score);
    });

    const dailyLabels = Object.keys(dailyMap).sort();
    const dailyData = dailyLabels.map(day => {
        const scores = dailyMap[day];
        const sum = scores.reduce((a, b) => a + b, 0);
        return sum / scores.length;
    });

    // B. Area Frequency
    const areaCounts = { 0: 0, 1: 0, 2: 0, 3: 0 };
    processed.forEach(item => {
        if (areaCounts[item.area] !== undefined) {
            areaCounts[item.area]++;
        }
    });
    const areaLabels = Object.values(PAIN_LABELS);
    const areaData = [areaCounts[0], areaCounts[1], areaCounts[2], areaCounts[3]];

    // C. Pain Over Time (Scatter/Line)
    // We'll use a time scale
    const timeSeriesData = processed.map(item => ({
        x: item.dateObj,
        y: item.pain_score
    }));

    // D. Hourly Average Pain
    const hourlyMap = {};
    for (let i = 0; i < 24; i++) hourlyMap[i] = [];
    processed.forEach(item => {
        hourlyMap[item.hour].push(item.pain_score);
    });
    const hourlyLabels = Array.from({ length: 24 }, (_, i) => `${i}시`);
    const hourlyData = [];
    for (let i = 0; i < 24; i++) {
        const scores = hourlyMap[i];
        if (scores.length === 0) hourlyData.push(0);
        else {
            const sum = scores.reduce((a, b) => a + b, 0);
            hourlyData.push(sum / scores.length);
        }
    }

    // 3. Render Charts
    renderDailyTrendChart(dailyLabels, dailyData);
    renderAreaFrequencyChart(areaLabels, areaData);
    renderPainOverTimeChart(timeSeriesData);
    renderHourlyPainChart(hourlyLabels, hourlyData);
}

// Chart Helpers
const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            labels: { color: '#94a3b8' }
        }
    },
    scales: {
        x: {
            grid: { color: '#334155' },
            ticks: { color: '#94a3b8' }
        },
        y: {
            grid: { color: '#334155' },
            ticks: { color: '#94a3b8' },
            beginAtZero: true
        }
    }
};

function renderDailyTrendChart(labels, data) {
    const ctx = document.getElementById('dailyTrendChart').getContext('2d');
    charts.daily = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: '평균 통증 점수',
                data: data,
                borderColor: '#60a5fa',
                backgroundColor: 'rgba(96, 165, 250, 0.2)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            ...commonOptions,
            scales: {
                ...commonOptions.scales,
                y: { ...commonOptions.scales.y, max: 4 }
            }
        }
    });
}

function renderAreaFrequencyChart(labels, data) {
    const ctx = document.getElementById('areaFrequencyChart').getContext('2d');
    charts.area = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    '#94a3b8', // 통증없음 (Grey)
                    '#f87171', // 허리 (Red)
                    '#fbbf24', // 등 (Amber)
                    '#34d399'  // 어깨 (Green)
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#94a3b8' }
                }
            }
        }
    });
}

function renderPainOverTimeChart(data) {
    const ctx = document.getElementById('painOverTimeChart').getContext('2d');
    charts.time = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: '통증 기록',
                data: data,
                borderColor: '#a78bfa',
                backgroundColor: '#a78bfa',
                pointRadius: 4,
                pointHoverRadius: 6,
                showLine: false // Scatter style points
            }]
        },
        options: {
            ...commonOptions,
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'day',
                        displayFormats: {
                            day: 'MM/dd'
                        }
                    },
                    grid: { color: '#334155' },
                    ticks: { color: '#94a3b8' }
                },
                y: {
                    ...commonOptions.scales.y,
                    max: 4,
                    ticks: {
                        color: '#94a3b8',
                        callback: function (value) {
                            return PAIN_SCORES[value] || value;
                        }
                    }
                }
            },
            plugins: {
                ...commonOptions.plugins,
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const date = context.raw.x.toLocaleString();
                            const score = context.raw.y;
                            const desc = PAIN_SCORES[score] || '';
                            return `${date}: ${score} (${desc})`;
                        }
                    }
                }
            }
        }
    });
}

function renderHourlyPainChart(labels, data) {
    const ctx = document.getElementById('hourlyPainChart').getContext('2d');
    charts.hourly = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: '시간대별 평균 통증',
                data: data,
                backgroundColor: '#818cf8',
                borderRadius: 4
            }]
        },
        options: {
            ...commonOptions,
            scales: {
                ...commonOptions.scales,
                y: { ...commonOptions.scales.y, max: 4 }
            }
        }
    });
}
