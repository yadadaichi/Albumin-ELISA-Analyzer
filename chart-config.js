/**
 * Chart.js Configuration for ELISA Plate Analyzer
 * Standard Curve Visualization
 */

class ChartManager {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.chart = null;
        this.initChart();
    }

    /**
     * Initialize the chart with default configuration
     */
    initChart() {
        const ctx = this.canvas.getContext('2d');

        // Setup chart defaults for light theme
        Chart.defaults.color = '#64748b'; // slate-500
        Chart.defaults.font.family = "'Inter', sans-serif";

        this.chart = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [
                    {
                        label: 'Standards',
                        data: [],
                        backgroundColor: 'rgba(14, 165, 233, 0.8)', // Sky Blue 500
                        borderColor: 'rgba(14, 165, 233, 1)',
                        pointRadius: 6,
                        pointHoverRadius: 8,
                        order: 2
                    },
                    {
                        label: '4PL Fitted Curve',
                        data: [],
                        type: 'line',
                        borderColor: 'rgba(3, 105, 161, 0.8)', // Sky Blue 700
                        backgroundColor: 'rgba(14, 165, 233, 0.1)',
                        borderWidth: 2,
                        fill: false,
                        pointRadius: 0,
                        tension: 0.4,
                        order: 1
                    },
                    {
                        label: 'Samples',
                        data: [],
                        backgroundColor: 'rgba(16, 185, 129, 0.8)', // Emerald 500
                        borderColor: 'rgba(16, 185, 129, 1)',
                        pointRadius: 5,
                        pointHoverRadius: 7,
                        pointStyle: 'triangle',
                        order: 3
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'nearest'
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            pointStyle: 'circle',
                            padding: 20
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        titleColor: '#0f172a',
                        bodyColor: '#475569',
                        borderColor: '#e2e8f0',
                        borderWidth: 1,
                        padding: 10,
                        boxPadding: 4,
                        callbacks: {
                            label: function (context) {
                                const x = context.parsed.x;
                                const y = context.parsed.y;
                                return `Conc: ${x.toFixed(2)}, OD: ${y.toFixed(4)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'logarithmic',
                        position: 'bottom',
                        title: {
                            display: true,
                            text: 'Concentration (ng/mL)',
                            font: { weight: '600' }
                        },
                        grid: {
                            color: '#e2e8f0',
                            borderDash: [2, 2]
                        },
                        ticks: {
                            callback: function (value) {
                                if (value >= 1000) return (value / 1000) + 'k';
                                if (value >= 1) return value;
                                return value.toFixed(2);
                            }
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Absorbance (OD)',
                            font: { weight: '600' }
                        },
                        grid: {
                            color: '#e2e8f0'
                        },
                        min: 0
                    }
                },
                animation: {
                    duration: 500
                }
            }
        });
    }

    /**
     * Update standards data points
     * @param {array} standards - Array of {x: concentration, y: absorbance}
     */
    updateStandards(standards) {
        this.chart.data.datasets[0].data = standards.map(s => ({ x: s.x, y: s.y }));
        this.chart.update('none');
    }

    /**
     * Update fitted curve
     * @param {array} curvePoints - Array of {x, y} points
     */
    updateFittedCurve(curvePoints) {
        this.chart.data.datasets[1].data = curvePoints.map(p => ({ x: p.x, y: p.y }));
        this.chart.update();
    }

    /**
     * Update samples data points
     * @param {array} samples - Array of {x: concentration, y: absorbance}
     */
    updateSamples(samples) {
        this.chart.data.datasets[2].data = samples
            .filter(s => s.x !== null && s.x > 0)
            .map(s => ({ x: s.x, y: s.y }));
        this.chart.update('none');
    }

    /**
     * Clear all data from chart
     */
    clear() {
        this.chart.data.datasets.forEach(dataset => {
            dataset.data = [];
        });
        this.chart.update();
    }

    /**
     * Update chart with all data
     * @param {object} data - {standards, curvePoints, samples}
     */
    updateAll(data) {
        if (data.standards) {
            this.chart.data.datasets[0].data = data.standards.map(s => ({ x: s.x, y: s.y }));
        }
        if (data.curvePoints) {
            this.chart.data.datasets[1].data = data.curvePoints.map(p => ({ x: p.x, y: p.y }));
        }
        if (data.samples) {
            this.chart.data.datasets[2].data = data.samples
                .filter(s => s.x !== null && s.x > 0)
                .map(s => ({ x: s.x, y: s.y }));
        }
        this.chart.update();
    }
}

// Export for use in other modules
window.ChartManager = ChartManager;
