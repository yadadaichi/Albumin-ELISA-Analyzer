/**
 * ELISA Plate Analyzer - Main Application
 * 96-well plate management, data entry, and concentration calculation
 */

class ELISAPlateAnalyzer {
    constructor() {
        // Plate configuration
        this.rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
        this.cols = Array.from({ length: 12 }, (_, i) => i + 1);

        // Multi-plate data storage (10 plates)
        this.plates = [];
        for (let i = 0; i < 10; i++) {
            this.plates.push(this.createEmptyPlate());
        }

        // Current plate for display (index 0-9)
        this.currentPlateIndex = 0;

        // Legacy single plate data for UI display
        this.plateData = this.plates[0];
        this.selectedWells = new Set();

        // Curve fitter and chart manager
        this.curveFitter = new CurveFitter();
        this.chartManager = null;

        // 4PL parameters for each plate
        this.plateParams = new Array(6).fill(null);
        this.fittedParams = null; // Currently displayed params

        // Drag state for well selection
        this.isDragging = false;
        this.dragMode = 'select';
        this.lastSelectedWell = null;

        // Initialize
        this.init();
    }

    /**
     * Create empty plate data structure
     */
    createEmptyPlate() {
        const plate = {};
        this.rows.forEach(row => {
            this.cols.forEach(col => {
                const wellId = `${row}${col}`;
                plate[wellId] = {
                    type: 'empty',
                    name: '',
                    concentration: null,
                    absorbance: null,
                    dilution: 1,
                    calculatedConcentration: null
                };
            });
        });
        return plate;
    }

    /**
     * Initialize the application
     */
    init() {
        this.initializePlateData();
        this.renderPlateGrid();
        this.setupEventListeners();
        this.setupDragAndDrop();
        this.chartManager = new ChartManager('standardCurveChart');
    }

    /**
     * Initialize empty plate data structure
     */
    initializePlateData() {
        this.rows.forEach(row => {
            this.cols.forEach(col => {
                const wellId = `${row}${col}`;
                this.plateData[wellId] = {
                    type: 'empty',
                    name: '',
                    concentration: null,
                    absorbance: null,
                    dilution: 1,
                    calculatedConcentration: null
                };
            });
        });
    }

    /**
     * Render the 96-well plate grid (Unified Grid Layout)
     */
    renderPlateGrid() {
        const container = document.querySelector('.plate-container');
        container.innerHTML = ''; // Clear existing content

        // Create unified grid container
        const grid = document.createElement('div');
        grid.className = 'plate-grid-unified';
        grid.id = 'plateGrid'; // Keep ID for event listeners

        // 1. Top-left empty corner
        const corner = document.createElement('div');
        grid.appendChild(corner);

        // 2. Column labels (1-12)
        this.cols.forEach(col => {
            const label = document.createElement('div');
            label.className = 'grid-label-col';
            label.textContent = col;
            grid.appendChild(label);
        });

        // 3. Rows (Label + Wells)
        this.rows.forEach(row => {
            // Row Label (A-H)
            const rowLabel = document.createElement('div');
            rowLabel.className = 'grid-label-row';
            rowLabel.textContent = row;
            grid.appendChild(rowLabel);

            // Wells (1-12)
            this.cols.forEach(col => {
                const wellId = `${row}${col}`;
                const well = document.createElement('div');
                well.className = 'well';
                well.id = `well-${wellId}`;
                well.dataset.wellId = wellId;

                // Content
                well.innerHTML = `<span class="well-label">${wellId}</span>`;

                grid.appendChild(well);
            });
        });

        container.appendChild(grid);
    }

    /**
     * Setup all event listeners
     */
    setupEventListeners() {
        // Unified Plate Grid Events
        const plateGrid = document.getElementById('plateGrid');

        // Mouse Down: Start selection or drag
        plateGrid.addEventListener('mousedown', (e) => this.handleGridMouseDown(e));

        // Mouse Over: Dragging selection
        plateGrid.addEventListener('mouseover', (e) => this.handleGridMouseOver(e));

        // Global Mouse Up: End drag
        document.addEventListener('mouseup', () => this.endDragSelect());

        // Clear all button
        document.getElementById('clearAllBtn').addEventListener('click', () => this.clearAll());

        // Plate tabs
        document.querySelectorAll('.plate-tab').forEach(tab => {
            tab.addEventListener('click', () => this.switchPlate(parseInt(tab.dataset.plate) - 1));
        });

        // Fit curve button
        document.getElementById('fitCurveBtn').addEventListener('click', () => this.fitCurve());

        // Export results
        document.getElementById('exportResultsBtn').addEventListener('click', () => this.exportResults());

        // Settings Modal
        const settingsModal = document.getElementById('settingsModal');
        const settingsBtn = document.getElementById('settingsBtn');
        const closeSettings = document.getElementById('closeSettings');
        const applySettingsBtn = document.getElementById('applySettingsBtn');

        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                settingsModal.style.display = 'block';
            });
        }

        if (closeSettings) {
            closeSettings.addEventListener('click', () => {
                settingsModal.style.display = 'none';
            });
        }

        window.addEventListener('click', (e) => {
            if (e.target === settingsModal) {
                settingsModal.style.display = 'none';
            }
        });

        if (applySettingsBtn) {
            applySettingsBtn.addEventListener('click', () => {
                settingsModal.style.display = 'none';
                this.fitCurve();
            });
        }



        // Generate sample charts
        document.getElementById('generateChartsBtn').addEventListener('click', () => this.generateSampleCharts());

        // Export charts dropdown
        const exportDropdown = document.querySelector('.export-dropdown');
        const exportChartsBtn = document.getElementById('exportChartsBtn');
        const exportPngBtn = document.getElementById('exportPngBtn');
        const exportSvgBtn = document.getElementById('exportSvgBtn');

        if (exportChartsBtn) {
            exportChartsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                exportDropdown.classList.toggle('active');
            });
        }

        if (exportPngBtn) {
            exportPngBtn.addEventListener('click', () => {
                exportDropdown.classList.remove('active');
                this.exportChartsAsPng();
            });
        }

        if (exportSvgBtn) {
            exportSvgBtn.addEventListener('click', () => {
                exportDropdown.classList.remove('active');
                this.exportChartsAsSvg();
            });
        }

        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            if (exportDropdown) exportDropdown.classList.remove('active');
        });

        // Plate size slider
        const sizeSlider = document.getElementById('plateSizeSlider');
        const plateContainer = document.querySelector('.plate-grid-unified');
        const sizeVal = document.getElementById('plateSizeVal');

        if (sizeSlider && plateContainer) {
            sizeSlider.addEventListener('input', (e) => {
                const width = e.target.value;
                plateContainer.style.minWidth = `${width}px`;
                // Calculate percentage roughly based on default 700px
                const percentage = Math.round((width / 700) * 100);
                if (sizeVal) sizeVal.textContent = `${percentage}%`;
            });
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
    }

    /**
     * Switch to a different plate for preview
     */
    switchPlate(plateIndex) {
        if (plateIndex < 0 || plateIndex >= 10) return;

        this.currentPlateIndex = plateIndex;
        this.plateData = this.plates[plateIndex];

        // Update tabs
        document.querySelectorAll('.plate-tab').forEach(tab => {
            const tabIndex = parseInt(tab.dataset.plate) - 1;
            tab.classList.toggle('active', tabIndex === plateIndex);
        });

        // Update parameters display for this plate
        this.fittedParams = this.plateParams[plateIndex];
        if (this.fittedParams) {
            this.displayParameters(this.fittedParams, this.fittedParams.rSquared);
            this.updateChartForCurrentPlate();
        } else {
            this.clearParameters();
            this.chartManager.clear();
        }

        // Refresh display
        this.refreshPlateDisplay();
        this.updateStandardsTable();
    }

    /**
     * Update chart for current plate
     */
    updateChartForCurrentPlate() {
        if (!this.fittedParams || !this.chartManager) return;

        // Get standards for this plate only
        const standardsData = Object.entries(this.plateData)
            .filter(([_, data]) =>
                data.type === 'standard' &&
                data.concentration !== null &&
                data.absorbance !== null
            )
            .map(([_, data]) => ({
                x: data.concentration,
                y: data.absorbance
            }));

        if (standardsData.length < 2) return;

        const minConc = Math.min(...standardsData.map(d => d.x)) * 0.5;
        const maxConc = Math.max(...standardsData.map(d => d.x)) * 2;
        const curvePoints = this.curveFitter.generateCurvePoints(minConc, maxConc, 100, this.fittedParams);

        this.chartManager.updateAll({
            standards: standardsData,
            curvePoints: curvePoints
        });
    }

    /**
     * Update plate tab indicators to show which plates have data
     */
    updatePlateTabIndicators() {
        document.querySelectorAll('.plate-tab').forEach(tab => {
            const plateIndex = parseInt(tab.dataset.plate) - 1;
            const plate = this.plates[plateIndex];
            const hasData = Object.values(plate).some(well => well.type !== 'empty');
            tab.classList.toggle('has-data', hasData);
        });
    }

    /**
     * Handle Mouse Down on Grid
     */
    handleGridMouseDown(e) {
        if (e.button !== 0) return; // Only left click

        const well = e.target.closest('.well');
        if (!well) return;

        // Prevent default removed to allow focus change (blur inputs)
        // CSS user-select: none handles text selection prevention works

        this.isDragging = true;
        const wellId = well.dataset.wellId;

        if (e.ctrlKey || e.metaKey) {
            // Toggle selection logic
            if (this.selectedWells.has(wellId)) {
                this.selectedWells.delete(wellId);
                well.classList.remove('selected');
                this.dragMode = 'deselect';
            } else {
                this.selectedWells.add(wellId);
                well.classList.add('selected');
                this.dragMode = 'select';
            }
        } else if (e.shiftKey && this.lastSelectedWell) {
            // Range selection (Click-Shift-Click)
            this.selectRange(this.lastSelectedWell, wellId);
            this.isDragging = false; // Don't drag after range select
        } else {
            // New single selection start (clears previous)
            this.clearSelection();
            this.selectedWells.add(wellId);
            well.classList.add('selected');
            this.dragMode = 'select';
        }

        this.lastSelectedWell = wellId;
        this.updateSelectedWellsInfo();

    }

    /**
     * Handle Mouse Over on Grid (Dragging)
     */
    handleGridMouseOver(e) {
        if (!this.isDragging) return;

        const well = e.target.closest('.well');
        if (!well) return;

        const wellId = well.dataset.wellId;

        // Optimize: Don't re-process if same well
        if (this.lastSelectedWell === wellId) return;

        if (this.dragMode === 'select') {
            if (!this.selectedWells.has(wellId)) {
                this.selectedWells.add(wellId);
                well.classList.add('selected');
            }
        } else if (this.dragMode === 'deselect') {
            if (this.selectedWells.has(wellId)) {
                this.selectedWells.delete(wellId);
                well.classList.remove('selected');
            }
        }

        this.lastSelectedWell = wellId;
        this.updateSelectedWellsInfo();
    }

    /**
     * End Drag Selection
     */
    endDragSelect() {
        if (this.isDragging) {
            this.isDragging = false;

        }
    }

    /**
     * Select range of wells
     */
    selectRange(startWellId, endWellId) {
        const startRow = this.rows.indexOf(startWellId[0]);
        const startCol = parseInt(startWellId.slice(1)) - 1;
        const endRow = this.rows.indexOf(endWellId[0]);
        const endCol = parseInt(endWellId.slice(1)) - 1;

        const minRow = Math.min(startRow, endRow);
        const maxRow = Math.max(startRow, endRow);
        const minCol = Math.min(startCol, endCol);
        const maxCol = Math.max(startCol, endCol);

        this.clearSelection();

        for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
                const wellId = `${this.rows[r]}${c + 1}`;
                this.selectedWells.add(wellId);
                document.getElementById(`well-${wellId}`).classList.add('selected');
            }
        }

        this.updateSelectedWellsInfo();
    }

    /**
     * Clear well selection
     */
    clearSelection() {
        this.selectedWells.forEach(wellId => {
            const well = document.getElementById(`well-${wellId}`);
            if (well) well.classList.remove('selected');
        });
        this.selectedWells.clear();
        this.updateSelectedWellsInfo();
    }

    /**
     * Update selected wells count display
     */
    updateSelectedWellsInfo() {
        document.getElementById('selectedWellsCount').textContent = this.selectedWells.size;
    }



    /**
     * Update well appearance based on data
     */
    updateWellAppearance(wellId) {
        const well = document.getElementById(`well-${wellId}`);
        const data = this.plateData[wellId];

        well.classList.remove('standard', 'sample', 'blank');

        if (data.type !== 'empty') {
            well.classList.add(data.type);
        }

        // Set hover tooltip
        const tooltipParts = [];
        if (data.name) tooltipParts.push(`Name: ${data.name}`);
        if (data.absorbance !== null) tooltipParts.push(`OD: ${data.absorbance.toFixed(4)}`);
        if (data.concentration !== null) tooltipParts.push(`Conc: ${data.concentration.toFixed(3)}`);
        well.title = tooltipParts.join('\n');

        well.innerHTML = '';
        if (data.name) {
            well.innerHTML += `<span class="well-label" title="${data.name}">${data.name}</span>`;
        }
        if (data.absorbance !== null) {
            well.innerHTML += `<span class="od-value">${data.absorbance.toFixed(4)}</span>`;
        }
    }

    /**
     * Update standards table
     */
    updateStandardsTable() {
        const tbody = document.getElementById('standardsTableBody');
        tbody.innerHTML = '';

        // Check if we should subtract minimum OD
        const subtractMinEl = document.getElementById('settingSubtractMin');
        const subtractMin = subtractMinEl ? subtractMinEl.checked : true;

        // Include blanks as concentration 0 standards
        const blankAsStdEl = document.getElementById('settingBlankAsStandard');
        const blankAsStandard = blankAsStdEl ? blankAsStdEl.checked : true;

        // Collect all standard points (including blanks if setting is on)
        const standardsRaw = [];
        Object.entries(this.plateData).forEach(([wellId, data]) => {
            if (data.type === 'standard' && data.concentration !== null) {
                standardsRaw.push([wellId, data, data.concentration]);
            } else if (data.type === 'blank' && blankAsStandard) {
                standardsRaw.push([wellId, data, 0]);
            }
        });

        standardsRaw.sort((a, b) => a[2] - b[2]);

        if (standardsRaw.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No standards defined</td></tr>';
            return;
        }

        // Calculate minimum OD if needed
        let minOD = 0;
        if (subtractMin) {
            let minVal = Infinity;
            standardsRaw.forEach(([_, data]) => {
                if (data.absorbance !== null && data.absorbance < minVal) {
                    minVal = data.absorbance;
                }
            });
            if (minVal !== Infinity) minOD = minVal;
        }

        // Calculate means for each concentration (with correction applied)
        const concGroups = {};
        standardsRaw.forEach(([_, data, conc]) => {
            if (data.absorbance !== null) {
                if (!concGroups[conc]) concGroups[conc] = [];
                concGroups[conc].push(data.absorbance - minOD);
            }
        });

        const means = {};
        Object.keys(concGroups).forEach(conc => {
            const values = concGroups[conc];
            means[conc] = values.reduce((a, b) => a + b, 0) / values.length;
        });

        standardsRaw.forEach(([wellId, data, conc]) => {
            const correctedAbs = data.absorbance !== null ? data.absorbance - minOD : null;
            const meanVal = means[conc];

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${wellId}</td>
                <td>${conc} ng/mL</td>
                <td>${correctedAbs !== null ? correctedAbs.toFixed(4) : '-'}</td>
                <td>${meanVal !== undefined ? meanVal.toFixed(4) : '-'}</td>
            `;
            tbody.appendChild(row);
        });
    }

    /**
     * Handle Well Names CSV import
     * CSV format: 96-well plate layout (8 rows x 12 columns)
     * First column can be row labels (A-H), first row can be column labels (1-12)
     */
    handleNamesCsvImport(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = this.parsePlateLayoutCsv(event.target.result);

                // Apply names to plate data
                this.rows.forEach((row, rowIdx) => {
                    this.cols.forEach((col, colIdx) => {
                        const wellId = `${row}${col}`;
                        const value = data[rowIdx]?.[colIdx];
                        if (value !== undefined && value !== null && value !== '') {
                            const nameStr = value.toString().trim();
                            this.plateData[wellId].name = nameStr;

                            // Auto-set type based on name pattern
                            const nameLower = nameStr.toLowerCase();

                            // Extract dilution factor from name (e.g., "10x", "20x", "100x")
                            const dilutionMatch = nameStr.match(/(\d+)x/i);
                            if (dilutionMatch) {
                                this.plateData[wellId].dilution = parseInt(dilutionMatch[1]);
                            }

                            // Check for standard pattern and extract concentration
                            if (nameLower.includes('std') || nameLower.includes('standard')) {
                                this.plateData[wellId].type = 'standard';
                                // Extract concentration from name (e.g., "standard 400", "std 200 ng/mL")
                                const concMatch = nameStr.match(/(\d+\.?\d*)\s*(ng\/ml|ng\/mL|pg\/ml|pg\/mL)?/i);
                                if (concMatch) {
                                    this.plateData[wellId].concentration = parseFloat(concMatch[1]);
                                }
                            } else if (nameLower.includes('blank') || nameLower === 'b') {
                                this.plateData[wellId].type = 'blank';
                            } else {
                                // Check if the name is just a number with unit (e.g., "400 ng/mL")
                                // This could also be a standard
                                const pureNumberMatch = nameStr.match(/^(\d+\.?\d*)\s*(ng\/ml|ng\/mL|pg\/ml|pg\/mL)?$/i);
                                if (pureNumberMatch) {
                                    this.plateData[wellId].type = 'standard';
                                    this.plateData[wellId].concentration = parseFloat(pureNumberMatch[1]);
                                } else if (nameStr !== '') {
                                    this.plateData[wellId].type = 'sample';
                                }
                            }
                            this.updateWellAppearance(wellId);
                        }
                    });
                });

                this.updateStandardsTable();

                // Update file status
                const status = document.getElementById('namesFileStatus');
                status.textContent = `✓ ${file.name}`;
                status.classList.add('loaded');

            } catch (error) {
                alert('Error importing Well Names CSV: ' + error.message);
            }
        };
        reader.readAsText(file);

        // Reset input to allow re-importing same file
        e.target.value = '';
    }

    /**
     * Handle Absorbance CSV import
     * CSV format: 96-well plate layout (8 rows x 12 columns)
     */
    handleAbsCsvImport(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = this.parsePlateLayoutCsv(event.target.result);

                // Apply absorbance values to plate data
                this.rows.forEach((row, rowIdx) => {
                    this.cols.forEach((col, colIdx) => {
                        const wellId = `${row}${col}`;
                        const value = data[rowIdx]?.[colIdx];
                        if (value !== undefined && value !== null && value !== '') {
                            const absValue = parseFloat(value);
                            if (!isNaN(absValue)) {
                                this.plateData[wellId].absorbance = absValue;
                                this.updateWellAppearance(wellId);
                            }
                        }
                    });
                });

                this.updateStandardsTable();

                // Update file status
                const status = document.getElementById('absFileStatus');
                status.textContent = `✓ ${file.name}`;
                status.classList.add('loaded');

                // Auto-fit curve if we have enough standards
                if (this.fittedParams) {
                    this.updateCalculations();
                }

            } catch (error) {
                alert('Error importing Absorbance CSV: ' + error.message);
            }
        };
        reader.readAsText(file);

        // Reset input to allow re-importing same file
        e.target.value = '';
    }

    /**
     * Parse CSV in plate layout format (8 rows x 12 columns)
     * Automatically detects and skips row/column labels
     */
    parsePlateLayoutCsv(csvText) {
        const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
        const result = [];

        let startRow = 0;
        let startCol = 0;

        // Parse all lines first
        const allRows = lines.map(line => {
            // Handle both comma and tab separated values
            return line.split(/[,\t]/).map(cell => cell.trim());
        });

        // Detect if first row is column labels (1-12 or similar)
        const firstRow = allRows[0];
        if (firstRow && (firstRow[0] === '' || /^[A-Ha-h]$/.test(firstRow[0]))) {
            // First cell is empty or a row label - check if rest are numbers
            const potentialLabels = firstRow.slice(1, 13);
            const areNumbers = potentialLabels.every((cell, idx) => {
                const num = parseInt(cell);
                return !isNaN(num) && num === idx + 1;
            });
            if (areNumbers) {
                startRow = 1;
            }
        }

        // Detect if first column is row labels (A-H)
        const firstColValues = allRows.slice(startRow).map(row => row[0]);
        const areRowLabels = firstColValues.length >= 8 &&
            firstColValues.slice(0, 8).every((val, idx) =>
                val && val.toUpperCase() === this.rows[idx]
            );
        if (areRowLabels) {
            startCol = 1;
        }

        // Extract 8x12 data matrix
        for (let r = 0; r < 8; r++) {
            const rowData = [];
            const sourceRow = allRows[startRow + r];
            if (sourceRow) {
                for (let c = 0; c < 12; c++) {
                    rowData.push(sourceRow[startCol + c] || '');
                }
            }
            result.push(rowData);
        }

        return result;
    }

    /**
     * Clear all plate data for ALL plates
     */
    clearAll() {
        if (!confirm('Are you sure you want to clear all data from all plates?')) return;

        // Reset all plates
        for (let i = 0; i < 10; i++) {
            this.plates[i] = this.createEmptyPlate();
        }
        this.plateData = this.plates[0];
        this.fittedParams = null;
        this.currentPlateIndex = 0;

        // Reset UI for current plate display
        Object.keys(this.plateData).forEach(wellId => {
            const well = document.getElementById(`well-${wellId}`);
            if (well) {
                well.classList.remove('standard', 'sample', 'blank', 'selected');
                well.innerHTML = `<span class="well-label">${wellId}</span>`;
            }
        });

        this.selectedWells.clear();
        this.updateSelectedWellsInfo();
        this.updateStandardsTable();
        this.chartManager.clear();
        this.clearParameters();
        this.clearResultsTable();

        // Reset master drop zone
        const statusEl = document.getElementById('masterDropStatus');
        const masterZone = document.getElementById('masterDropZone');
        if (statusEl) statusEl.textContent = 'Ready to import';
        if (masterZone) masterZone.classList.remove('loaded');

        // Reset plate status indicators
        document.querySelectorAll('.plate-status-item').forEach(item => {
            item.classList.remove('active');
        });

        // Update plate tabs
        this.updatePlateTabIndicators();

        // Clear sample charts
        const chartsContainer = document.getElementById('sampleChartsContainer');
        if (chartsContainer) {
            chartsContainer.innerHTML = '<p class="no-charts-message">Click "Generate Charts" after fitting the curve to display sample graphs.</p>';
        }
    }

    /**
     * Fit 4PL curve using standards from ALL plates
     */
    /**
     * Fit 4PL curve for EACH plate individually
     */
    fitCurve() {
        this.plateParams = new Array(10).fill(null);
        this.plateMinODs = new Array(10).fill(0);
        let anySuccess = false;

        // Get analysis settings
        const subtractMinEl = document.getElementById('settingSubtractMin');
        const blankAsStdEl = document.getElementById('settingBlankAsStandard');

        const subtractMin = subtractMinEl ? subtractMinEl.checked : false;
        const blankAsStandard = blankAsStdEl ? blankAsStdEl.checked : true;

        // Fit for each plate
        for (let i = 0; i < 10; i++) {
            const plate = this.plates[i];

            // Calculate Min OD if subtractMin is enabled
            let minOD = 0;
            if (subtractMin) {
                let minVal = Infinity;
                Object.values(plate).forEach(d => {
                    if ((d.type === 'standard' || d.type === 'blank') && d.absorbance !== null) {
                        if (d.absorbance < minVal) minVal = d.absorbance;
                    }
                });
                if (minVal !== Infinity) minOD = minVal;
            }
            this.plateMinODs[i] = minOD;

            // Group standards by concentration to calculate mean absorbance
            const standardsMap = new Map();
            let wellsProcessed = [];

            Object.entries(plate).forEach(([wellId, data]) => {
                let shouldUse = false;
                let conc = null;

                if (data.type === 'standard' && data.concentration !== null) {
                    shouldUse = true;
                    conc = data.concentration;
                } else if (data.type === 'blank') {
                    // Check setting to include blank
                    if (blankAsStandard) {
                        shouldUse = true;
                        conc = 0;
                    }
                }

                if (shouldUse && data.absorbance !== null) {
                    if (!standardsMap.has(conc)) {
                        standardsMap.set(conc, []);
                    }
                    // Apply correction
                    standardsMap.get(conc).push(data.absorbance - minOD);
                    wellsProcessed.push({ wellId, type: data.type, conc, abs: data.absorbance, corrected: data.absorbance - minOD });
                }
            });

            // Convert to array of {x, y} with averaged y
            const standardsData = Array.from(standardsMap.entries())
                .map(([conc, values]) => ({
                    x: conc,
                    y: values.reduce((a, b) => a + b, 0) / values.length
                }))
                .sort((a, b) => a.x - b.x);

            console.log(`Plate ${i + 1} - Settings: subtractMin=${subtractMin}, blankAsStandard=${blankAsStandard}, minOD=${minOD}`);
            console.log(`Plate ${i + 1} - Wells processed:`, wellsProcessed);
            console.log(`Plate ${i + 1} - Curve Fitting Data:`, JSON.stringify(standardsData, null, 2));

            if (standardsData.length >= 4) {
                try {
                    const result = this.curveFitter.fit(standardsData);
                    this.plateParams[i] = { ...result.params, rSquared: result.rSquared };
                    anySuccess = true;
                    console.log(`Plate ${i + 1} fitted successfully. R2: ${result.rSquared}`);
                } catch (error) {
                    console.warn(`Plate ${i + 1} fitting failed:`, error);
                }
            }
        }

        if (!anySuccess) {
            alert('Could not fit any curves. Ensure at least one plate has 4+ standards.');
            return;
        }

        // Update display for current plate
        this.fittedParams = this.plateParams[this.currentPlateIndex];
        if (this.fittedParams) {
            this.displayParameters(this.fittedParams, this.fittedParams.rSquared);
            this.updateChartForCurrentPlate();
        } else {
            this.clearParameters();
            this.chartManager.clear();
            const firstFittedIndex = this.plateParams.findIndex(p => p !== null);
            if (firstFittedIndex !== -1 && confirm(`Current plate has no curve. Switch to Plate ${firstFittedIndex + 1}?`)) {
                this.switchPlate(firstFittedIndex);
                return; // switchPlate calls updateCalculations implicitly via UI update flow? No, explicitly call it.
            }
        }

        this.updateCalculations();
        alert('Approximation curves created for all plates.');
    }

    /**
     * Display parameters
     */
    displayParameters(params, rSquared) {
        document.getElementById('paramA').textContent = params.A.toFixed(4);
        document.getElementById('paramB').textContent = params.B.toFixed(4);
        document.getElementById('paramC').textContent = params.C.toFixed(4);
        document.getElementById('paramD').textContent = params.D.toFixed(4);
        document.getElementById('paramR2').textContent = rSquared.toFixed(6);

        // Update fitted equation display
        const equationEl = document.getElementById('fittedEquation');
        if (equationEl) {
            const A = params.A.toFixed(4);
            const B = params.B.toFixed(4);
            const C = params.C.toFixed(4);
            const D = params.D.toFixed(4);

            equationEl.innerHTML = `y = ${D} + <span class="fraction"><span class="numerator">${A} - ${D}</span><span class="denominator">1 + (x / ${C})<sup>${B}</sup></span></span>`;
        }
    }

    /**
     * Clear parameters
     */
    clearParameters() {
        document.getElementById('paramA').textContent = '-';
        document.getElementById('paramB').textContent = '-';
        document.getElementById('paramC').textContent = '-';
        document.getElementById('paramD').textContent = '-';
        document.getElementById('paramR2').textContent = '-';

        const equationEl = document.getElementById('fittedEquation');
        if (equationEl) {
            equationEl.innerHTML = '<span class="placeholder-text">Fit the curve to see the equation</span>';
        }
    }

    /**
     * Update calculations for ALL plates based on their respective curves
     */
    updateCalculations() {
        const samplesForChart = [];
        const resultsData = [];
        const samplesResultMap = new Map();
        let globalWellIndex = 0;

        // Define specific order: Column pairs (1-2, 3-4...) then Rows (A-H)
        const wellOrder = [];
        for (let pair = 0; pair < 6; pair++) {
            const col1 = pair * 2 + 1;
            const col2 = pair * 2 + 2;
            this.rows.forEach(row => {
                wellOrder.push(`${row}${col1}`);
                wellOrder.push(`${row}${col2}`);
            });
        }

        // Calculate for all plates
        this.plates.forEach((plate, plateIdx) => {
            const params = this.plateParams[plateIdx];
            // Get current settings
            const subtractMinEl = document.getElementById('settingSubtractMin');
            const subtractMin = subtractMinEl ? subtractMinEl.checked : false;

            const minOD = (subtractMin && this.plateMinODs) ? this.plateMinODs[plateIdx] : 0;

            wellOrder.forEach(wellId => {
                const data = plate[wellId];
                if (!data) return;
                // Determine if we can calculate concentration
                let calcConc = null;

                // Apply MinOD correction
                const correctedAbs = data.absorbance !== null ? data.absorbance - minOD : null;

                // If we have params and absorbance, calculate
                if (params && correctedAbs !== null && (data.type === 'sample' || data.type === 'standard')) {
                    calcConc = this.curveFitter.calculateConcentration(correctedAbs, params);
                    data.calculatedConcentration = calcConc;
                } else {
                    data.calculatedConcentration = null;
                }

                if (data.type === 'sample' && correctedAbs !== null) {
                    // Calculated Conc should be dilution corrected (ng/mL)
                    const dilutedConc = calcConc !== null ? calcConc * data.dilution : null;
                    // Final Conc: #0-a and #0-b use 0.005, others use 0.01 (µg / 1M cells)
                    const is0Sample = data.name && (data.name.includes('#0-a') || data.name.includes('#0-b'));
                    const conversionFactor = is0Sample ? 0.005 : 0.01;
                    const finalConc = dilutedConc !== null ? dilutedConc * conversionFactor : null;

                    // Save to data object for chart generation
                    data.finalConcentration = finalConc;

                    // Add to chart source (individual points) - use corrected absorbance
                    if (calcConc !== null) {
                        samplesForChart.push({
                            x: calcConc,
                            y: correctedAbs,
                            plateIdx: plateIdx
                        });
                    }

                    // Add to results table data directly (no grouping)
                    const displayWellId = `P${plateIdx + 1}-${wellId}`;
                    resultsData.push({
                        wellId: displayWellId,
                        name: data.name,
                        type: data.type,
                        absorbance: correctedAbs,
                        dilution: data.dilution,
                        calculatedConc: dilutedConc,
                        finalConc: finalConc,
                        sortIndex: globalWellIndex // Maintain original order
                    });
                }
                globalWellIndex++;
            });
        });

        // samplesForChart currently shows all samples on the standard curve chart
        // Since we have multiple curves, maybe we should only show samples for the CURRENT plate
        // or just rely on updateChartForCurrentPlate to redraw everything.
        // Let's filter sample points to only show current plate samples on the curve chart
        const currentPlateSamples = samplesForChart
            .filter(s => s.plateIdx === this.currentPlateIndex)
            .map(s => ({ x: s.x, y: s.y }));

        this.chartManager.updateSamples(currentPlateSamples);
        this.updateResultsTable(resultsData);
    }


    /**
     * Update results table
     */
    updateResultsTable(results) {
        const tbody = document.getElementById('resultsTableBody');
        tbody.innerHTML = '';

        if (results.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">No sample results</td></tr>';
            return;
        }

        results.forEach(result => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${result.wellId}</td>
                <td>${result.name || '-'}</td>
                <td><span class="badge ${result.type}">${result.type}</span></td>
                <td>${result.absorbance.toFixed(4)}</td>
                <td>${result.dilution}x</td>
                <td>${result.calculatedConc !== null ? result.calculatedConc.toFixed(4) : 'Out of range'}</td>
                <td><strong>${result.finalConc !== null ? result.finalConc.toFixed(4) : '-'}</strong> µg / 1M cells</td>
            `;
            tbody.appendChild(row);
        });
    }

    /**
     * Clear results table
     */
    clearResultsTable() {
        const tbody = document.getElementById('resultsTableBody');
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">No sample results</td></tr>';
    }

    /**
     * Export results
     */
    exportResults() {
        const results = [];
        results.push(['Plate', 'Well', 'Name', 'Type', 'Concentration (std)', 'Absorbance', 'Dilution', 'Calculated Conc. (ng/mL)', 'Final Conc. (µg / 1M cells)'].join(','));

        // Define verify specific order: Column pairs (1-2, 3-4...) then Rows (A-H)
        const wellOrder = [];
        for (let pair = 0; pair < 6; pair++) {
            const col1 = pair * 2 + 1;
            const col2 = pair * 2 + 2;
            this.rows.forEach(row => {
                wellOrder.push(`${row}${col1}`);
                wellOrder.push(`${row}${col2}`);
            });
        }

        this.plates.forEach((plate, plateIdx) => {
            wellOrder.forEach(wellId => {
                const data = plate[wellId];
                if (data && data.type !== 'empty') {
                    const dilutedConc = data.calculatedConcentration !== null ? data.calculatedConcentration * data.dilution : null;
                    // Final Conc: #0-a and #0-b use 0.005, others use 0.01 (µg / 1M cells)
                    const is0Sample = data.name && (data.name.includes('#0-a') || data.name.includes('#0-b'));
                    const conversionFactor = is0Sample ? 0.005 : 0.01;
                    const finalConc = dilutedConc !== null ? dilutedConc * conversionFactor : null;

                    results.push([
                        plateIdx + 1,
                        wellId,
                        `"${data.name || ''}"`, // Quote name to handle commas
                        data.type,
                        data.concentration !== null ? data.concentration : '',
                        data.absorbance !== null ? data.absorbance.toFixed(4) : '',
                        data.dilution,
                        dilutedConc !== null ? dilutedConc.toFixed(4) : '',
                        finalConc !== null ? finalConc.toFixed(4) : ''
                    ].join(','));
                }
            });
        });

        const blob = new Blob([results.join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `elisa_results_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Handle keyboard shortcuts
     */
    handleKeyPress(e) {
        // Ignore if typing in an input field
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
            return;
        }

        if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
            e.preventDefault();
            this.selectAllWells();
        }
        if (e.key === 'Escape') {
            this.clearSelection();
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (this.selectedWells.size > 0) {
                e.preventDefault();
                this.clearSelectedWells();
            }
        }
    }

    /**
     * Clear selected wells to empty state
     */
    clearSelectedWells() {
        if (this.selectedWells.size === 0) {
            alert('No wells selected. Please select wells to clear.');
            return;
        }

        if (!confirm('Are you sure you want to clear the selected wells?')) return;

        this.selectedWells.forEach(wellId => {
            this.plateData[wellId] = {
                type: 'empty',
                name: '',
                concentration: null,
                absorbance: null,
                dilution: 1,
                calculatedConcentration: null
            };
            this.updateWellAppearance(wellId);
        });

        this.updateStandardsTable();

        // Update editor to reflect cleared state
        this.updateEditorFromSelection();

        if (this.fittedParams) {
            this.updateCalculations();
        }
    }

    /**
     * Select all wells
     */
    selectAllWells() {
        Object.keys(this.plateData).forEach(wellId => {
            this.selectedWells.add(wellId);
            document.getElementById(`well-${wellId}`).classList.add('selected');
        });
        this.updateSelectedWellsInfo();
    }

    /**
     * Storage for sample chart instances
     */
    sampleCharts = {};

    /**
     * Generate sample charts grouped by condition
     */
    generateSampleCharts() {
        if (!this.fittedParams) {
            alert('Please fit the 4PL curve first.');
            return;
        }

        const container = document.getElementById('sampleChartsContainer');
        container.innerHTML = '';

        // Destroy existing chart instances
        Object.values(this.sampleCharts).forEach(chart => chart.destroy());
        this.sampleCharts = {};

        // Group samples by condition (extract day info from name)
        const groupedData = this.groupSamplesByCondition();

        if (Object.keys(groupedData).length === 0) {
            container.innerHTML = '<p class="no-charts-message">No sample data available. Make sure samples have names with day information (e.g., "Sample A d1", "Sample A d3").</p>';
            return;
        }

        // Sort condition names naturally
        const sortedConditions = Object.keys(groupedData).sort((a, b) => {
            return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
        });

        // Create a chart for each condition
        sortedConditions.forEach(conditionName => {
            const dayData = groupedData[conditionName];

            const chartItem = document.createElement('div');
            chartItem.className = 'sample-chart-item';

            // Header with title and export button
            const chartHeader = document.createElement('div');
            chartHeader.className = 'chart-item-header';
            chartHeader.style.display = 'flex';
            chartHeader.style.justifyContent = 'space-between';
            chartHeader.style.alignItems = 'center';
            chartHeader.style.marginBottom = '10px';

            const title = document.createElement('div');
            title.className = 'sample-chart-title';
            title.style.marginBottom = '0';
            title.textContent = conditionName;
            chartHeader.appendChild(title);

            // Export dropdown for this chart
            const canvasId = `chart-${conditionName.replace(/[^a-zA-Z0-9]/g, '-')}`;
            const exportDropdown = this.createChartExportDropdown(canvasId, conditionName);
            chartHeader.appendChild(exportDropdown);

            chartItem.appendChild(chartHeader);

            const canvasContainer = document.createElement('div');
            canvasContainer.className = 'sample-chart-canvas';
            const canvas = document.createElement('canvas');
            canvas.id = canvasId;
            canvasContainer.appendChild(canvas);
            chartItem.appendChild(canvasContainer);

            container.appendChild(chartItem);

            // Sort by day - only include days with actual data
            const sortedDays = Object.keys(dayData)
                .map(d => parseInt(d))
                .filter(d => dayData[d] && dayData[d].values && dayData[d].values.length > 0)
                .sort((a, b) => a - b);
            const labels = sortedDays.map(d => `Day ${d}`);
            const values = sortedDays.map(d => dayData[d].mean);
            const errors = sortedDays.map(d => dayData[d].sd);

            // Calculate N (number of samples per day - use first day as representative)
            const nPerDay = sortedDays.length > 0 ? dayData[sortedDays[0]].values.length : 0;

            // Collect individual data points for scatter overlay
            const scatterData = [];
            sortedDays.forEach((day, dayIndex) => {
                const label = `Day ${day}`;  // Use category label to match bar chart
                const stats = dayData[day];
                if (stats.values) {
                    stats.values.forEach((val, i) => {
                        // Use the category label as x coordinate for proper alignment with bar chart
                        // val is now an object { value, plateIdx, wellId }
                        scatterData.push({ x: label, y: val.value, source: val });
                    });
                }
            });

            // Calculate dynamic max Y to fit error bars and individual points
            let maxY = 0;
            values.forEach((v, i) => {
                const err = errors[i] || 0;
                if ((v + err) > maxY) maxY = v + err;
            });
            scatterData.forEach(p => {
                if (p.y > maxY) maxY = p.y;
            });
            const yAxisMax = maxY > 0 ? maxY * 1.2 : 1;

            // Create bar chart with error bars and scatter overlay
            this.sampleCharts[canvasId] = new Chart(canvas.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: `Mean ± SD (N=${nPerDay})`,
                            data: values,
                            backgroundColor: 'rgba(102, 102, 102, 0.5)',
                            borderColor: '#333333',
                            borderWidth: 1,
                            borderRadius: 0,
                            barPercentage: 0.7,
                            categoryPercentage: 0.8,
                            order: 2  // Draw bars first (behind)
                        },
                        {
                            type: 'scatter',
                            label: 'Individual Values',
                            data: scatterData,
                            backgroundColor: '#000000',  // Black
                            borderColor: '#000000',
                            borderWidth: 1,
                            pointRadius: 3,
                            pointHoverRadius: 5,
                            order: 1  // Draw points on top
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            align: 'end',
                            labels: {
                                color: '#000000',
                                font: {
                                    size: 11
                                },
                                usePointStyle: true,
                                pointStyle: 'rect'
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: (context) => {
                                    const point = context.raw;
                                    let label = context.dataset.label || '';
                                    if (label) label += ': ';
                                    label += point.y.toFixed(3);
                                    return label;
                                },
                                afterLabel: (context) => {
                                    const point = context.raw;
                                    if (point.source) {
                                        return `Source: Plate ${point.source.plateIdx + 1} - ${point.source.wellId}`;
                                    }
                                    return '';
                                }
                            }
                        }
                    },
                    scales: {

                        x: {
                            grid: {
                                display: false
                            },
                            border: {
                                color: '#000000',
                                width: 2
                            },
                            ticks: {
                                color: '#000000',
                                font: {
                                    family: 'Arial, Helvetica, sans-serif',
                                    size: 14,
                                    weight: 'bold'
                                },
                                maxRotation: 45,
                                minRotation: 45
                            },
                            title: {
                                display: false
                            }
                        },
                        y: {
                            beginAtZero: true,
                            suggestedMax: yAxisMax,
                            grid: {
                                color: '#cccccc',
                                lineWidth: 1
                            },
                            border: {
                                color: '#000000',
                                width: 2
                            },
                            ticks: {
                                color: '#000000',
                                font: {
                                    family: 'Arial, Helvetica, sans-serif',
                                    size: 12,
                                    weight: 'bold'
                                },
                                padding: 8
                            },
                            title: {
                                display: true,
                                text: 'Albumin [µg / 1M cells]',
                                color: '#000000',
                                font: {
                                    family: 'Arial, Helvetica, sans-serif',
                                    size: 14,
                                    weight: 'bold'
                                },
                                padding: { bottom: 10 }
                            }
                        }
                    }
                },
                plugins: [{
                    // Custom plugin for error bars
                    id: 'errorBars',
                    afterDatasetsDraw: (chart) => {
                        const { ctx, scales: { y } } = chart;

                        chart.getDatasetMeta(0).data.forEach((bar, index) => {
                            const value = values[index];
                            const error = errors[index];

                            if (error === 0 || value === null) return;

                            const x = bar.x;
                            const yTop = y.getPixelForValue(value + error);
                            const yBottom = y.getPixelForValue(value - error);

                            ctx.save();
                            ctx.beginPath();
                            ctx.strokeStyle = '#000000';
                            ctx.lineWidth = 1.5;

                            // Vertical line
                            ctx.moveTo(x, yTop);
                            ctx.lineTo(x, yBottom);

                            // Cap lines
                            const capWidth = 5;
                            ctx.moveTo(x - capWidth, yTop);
                            ctx.lineTo(x + capWidth, yTop);
                            ctx.moveTo(x - capWidth, yBottom);
                            ctx.lineTo(x + capWidth, yBottom);

                            ctx.stroke();
                            ctx.restore();
                        });
                        ctx.restore();
                    }
                }]
            });

            // Store error bar data for SVG export
            this.sampleCharts[canvasId].errorData = errors;
            this.sampleCharts[canvasId].barValues = values;
        });

        // ==========================================
        // Combined Comparison Chart - All conditions side by side
        // ==========================================
        this.generateCombinedComparisonChart(groupedData, sortedConditions, container);
    }

    /**
     * Generate a combined comparison chart with all conditions side by side
     * Similar to the reference image: grouped bars by condition with days within each group
     * X-axis shows day numbers, grouped by condition
     */
    generateCombinedComparisonChart(groupedData, sortedConditions, container) {
        // Create a full-width wrapper that spans outside the normal container
        const wideWrapper = document.createElement('div');
        wideWrapper.className = 'combined-chart-wrapper';
        wideWrapper.style.width = '100%';
        wideWrapper.style.marginTop = '40px';
        wideWrapper.style.marginBottom = '20px';
        wideWrapper.style.overflowX = 'auto'; // Allow horizontal scroll if needed
        wideWrapper.style.padding = '20px 0';
        wideWrapper.style.backgroundColor = '#ffffff';
        wideWrapper.style.borderRadius = '8px';
        wideWrapper.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';

        // Create container for combined chart
        const combinedChartItem = document.createElement('div');
        combinedChartItem.className = 'sample-chart-item combined-chart-item';
        // Use 100% width to fit the page
        combinedChartItem.style.width = '100%';
        combinedChartItem.style.maxWidth = '100%';
        combinedChartItem.style.margin = '0 auto';
        combinedChartItem.style.padding = '0 20px';

        // Header with title and export button
        const chartHeader = document.createElement('div');
        chartHeader.style.display = 'flex';
        chartHeader.style.justifyContent = 'space-between';
        chartHeader.style.alignItems = 'center';
        chartHeader.style.marginBottom = '20px';
        chartHeader.style.padding = '0 10px';

        const title = document.createElement('div');
        title.className = 'sample-chart-title';
        title.textContent = 'Combined Comparison - All Conditions';
        title.style.fontSize = '18px';
        title.style.fontWeight = 'bold';
        title.style.margin = '0';
        chartHeader.appendChild(title);

        // Export dropdown for combined chart
        const canvasId = 'chart-combined-comparison';
        const exportDropdown = this.createChartExportDropdown(canvasId, 'Combined Comparison');
        chartHeader.appendChild(exportDropdown);

        combinedChartItem.appendChild(chartHeader);

        const canvasContainer = document.createElement('div');
        canvasContainer.className = 'sample-chart-canvas';
        canvasContainer.style.height = '500px'; // Taller for better visibility
        canvasContainer.style.width = '100%';
        const canvas = document.createElement('canvas');
        canvas.id = canvasId;
        canvasContainer.appendChild(canvas);
        combinedChartItem.appendChild(canvasContainer);

        wideWrapper.appendChild(combinedChartItem);
        container.appendChild(wideWrapper);

        // Collect all unique days across all conditions
        const allDays = new Set();
        Object.values(groupedData).forEach(dayData => {
            Object.keys(dayData).forEach(day => allDays.add(parseInt(day)));
        });
        const sortedDays = Array.from(allDays).sort((a, b) => a - b);

        // Create flat data structure: each bar is one condition-day combination
        // Labels show day numbers, bars are grouped by condition
        const flatLabels = [];
        const flatValues = [];
        const flatErrors = [];
        const conditionGroupInfo = []; // Track where each condition starts

        sortedConditions.forEach((condition, condIdx) => {
            const conditionData = groupedData[condition];
            // Get only days that have actual data for this condition
            const conditionDays = Object.keys(conditionData)
                .map(d => parseInt(d))
                .filter(d => conditionData[d] && conditionData[d].values && conditionData[d].values.length > 0)
                .sort((a, b) => a - b);

            conditionGroupInfo.push({
                condition: condition,
                startIndex: flatLabels.length,
                endIndex: flatLabels.length + conditionDays.length - 1
            });

            conditionDays.forEach(day => {
                flatLabels.push(day.toString()); // Just the day number as label
                flatValues.push(conditionData[day].mean);
                flatErrors.push(conditionData[day].sd);
            });
        });

        // Calculate max Y for proper scaling
        let maxY = 0;
        flatValues.forEach((v, i) => {
            if (v !== null) {
                const err = flatErrors[i] || 0;
                if ((v + err) > maxY) maxY = v + err;
            }
        });
        const yAxisMax = maxY > 0 ? maxY * 1.25 : 1;

        // Generate grayscale colors for bars (alternating pattern based on condition)
        const barColors = flatLabels.map((_, idx) => {
            const conditionIdx = Math.floor(idx / sortedDays.length);
            const dayIdx = idx % sortedDays.length;
            // Grayscale gradient based on day position
            const grayLevels = [30, 80, 120, 160]; // darker to lighter
            const grayValue = grayLevels[dayIdx % grayLevels.length];
            return `rgba(${grayValue}, ${grayValue}, ${grayValue}, 0.8)`;
        });

        // Create the chart
        this.sampleCharts[canvasId] = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: flatLabels,
                datasets: [{
                    label: 'Albumin secretion',
                    data: flatValues,
                    backgroundColor: barColors,
                    borderColor: '#333333',
                    borderWidth: 1,
                    barPercentage: 0.6,
                    categoryPercentage: 0.7
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: {
                        bottom: 35 // Extra space for condition labels
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            title: (context) => {
                                const idx = context[0].dataIndex;
                                const conditionIdx = Math.floor(idx / sortedDays.length);
                                const condition = sortedConditions[conditionIdx];
                                return condition;
                            },
                            label: (context) => {
                                const value = context.parsed.y;
                                return `Day ${context.label}: ${value !== null ? value.toFixed(3) : 'N/A'} µg/1M cells`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        border: {
                            color: '#000000',
                            width: 2
                        },
                        ticks: {
                            color: '#000000',
                            font: {
                                family: 'Arial, Helvetica, sans-serif',
                                size: 14,
                                weight: 'bold'
                            },
                            maxRotation: 45,
                            minRotation: 45
                        },
                        title: {
                            display: false
                        }
                    },
                    y: {
                        beginAtZero: true,
                        suggestedMax: yAxisMax,
                        grid: {
                            color: '#cccccc',
                            lineWidth: 1
                        },
                        border: {
                            color: '#000000',
                            width: 2
                        },
                        ticks: {
                            color: '#000000',
                            font: {
                                family: 'Arial, Helvetica, sans-serif',
                                size: 12,
                                weight: 'bold'
                            },
                            padding: 8
                        },
                        title: {
                            display: true,
                            text: 'Albumin [µg / 1M cells]',
                            color: '#000000',
                            font: {
                                family: 'Arial, Helvetica, sans-serif',
                                size: 14,
                                weight: 'bold'
                            },
                            padding: { bottom: 10 }
                        }
                    }
                }
            },
            plugins: [{
                // Custom plugin for error bars
                id: 'combinedErrorBars',
                afterDatasetsDraw: (chart) => {
                    const { ctx, scales: { y } } = chart;
                    const meta = chart.getDatasetMeta(0);
                    if (!meta || meta.data.length === 0) return;

                    meta.data.forEach((bar, index) => {
                        const value = flatValues[index];
                        const error = flatErrors[index];

                        if (value === null || error === 0 || error === undefined) return;

                        const barX = bar.x;
                        const yTop = y.getPixelForValue(value + error);
                        const yBottom = y.getPixelForValue(Math.max(0, value - error));

                        ctx.save();
                        ctx.beginPath();
                        ctx.strokeStyle = '#000000';
                        ctx.lineWidth = 1.5;

                        // Vertical line
                        ctx.moveTo(barX, yTop);
                        ctx.lineTo(barX, yBottom);

                        // Cap lines
                        const capWidth = 4;
                        ctx.moveTo(barX - capWidth, yTop);
                        ctx.lineTo(barX + capWidth, yTop);
                        ctx.moveTo(barX - capWidth, yBottom);
                        ctx.lineTo(barX + capWidth, yBottom);

                        ctx.stroke();
                        ctx.restore();
                    });
                }
            },
            {
                // Custom plugin to draw condition group labels below the x-axis
                id: 'conditionLabels',
                afterDraw: (chart) => {
                    const { ctx, chartArea, scales: { x } } = chart;
                    const numDays = sortedDays.length;

                    ctx.save();
                    ctx.font = 'bold 11px Inter, sans-serif';
                    ctx.fillStyle = '#000000';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'top';

                    sortedConditions.forEach((condition, condIdx) => {
                        // Calculate center position for this condition group
                        const startBarIdx = condIdx * numDays;
                        const endBarIdx = startBarIdx + numDays - 1;

                        const meta = chart.getDatasetMeta(0);
                        if (meta.data.length === 0) return;

                        const startX = meta.data[startBarIdx]?.x || 0;
                        const endX = meta.data[endBarIdx]?.x || 0;
                        const centerX = (startX + endX) / 2;

                        // Draw condition name below the chart
                        const yPos = chartArea.bottom + 55; // Below the day labels
                        ctx.fillText(condition, centerX, yPos);

                        // Draw separator line between condition groups (except after last)
                        if (condIdx < sortedConditions.length - 1) {
                            const separatorX = endX + (meta.data[endBarIdx + 1]?.x - endX) / 2;
                            ctx.beginPath();
                            ctx.strokeStyle = '#cccccc';
                            ctx.lineWidth = 1;
                            ctx.setLineDash([3, 3]);
                            ctx.moveTo(separatorX, chartArea.top);
                            ctx.lineTo(separatorX, chartArea.bottom);
                            ctx.stroke();
                            ctx.setLineDash([]);
                        }
                    });

                    ctx.restore();
                }
            }]
        });

        // Store data for SVG export
        this.sampleCharts[canvasId].errorData = flatErrors;
        this.sampleCharts[canvasId].barValues = flatValues;
        this.sampleCharts[canvasId].conditionLabels = sortedConditions;
        this.sampleCharts[canvasId].isCombinedChart = true;
        this.sampleCharts[canvasId].numDaysPerCondition = sortedDays.length;
    }

    /**
     * Group samples by condition from ALL plates, extracting day info from name
     * Groups replicates (#1, #2, #3) together and calculates mean and SD
     * Returns: { conditionName: { day: { mean, sd, values }, ... }, ... }
     */
    groupSamplesByCondition() {
        const rawData = {};

        // Process all plates - collect all values
        console.log("=== groupSamplesByCondition START ===");
        const processedSamples = new Set();  // Track processed samples to detect duplicates

        this.plates.forEach((plate, plateIndex) => {
            Object.entries(plate).forEach(([wellId, data]) => {
                // Use calculatedConcentration as the source of truth
                if (data.type === 'sample' && data.calculatedConcentration !== null && data.calculatedConcentration !== undefined) {
                    const name = data.name || '';

                    // Create unique key for this sample
                    const sampleKey = `P${plateIndex}_${wellId}_${name}_${data.calculatedConcentration?.toFixed(4)}`;

                    if (processedSamples.has(sampleKey)) {
                        console.warn(`[DUPLICATE] Already processed: ${sampleKey}`);
                        return;
                    }
                    processedSamples.add(sampleKey);

                    // Extract day number from name
                    // Match patterns: "d6", "D6", "Day 6", "day6" etc.
                    // Avoid matching "10x" or similar patterns
                    // Use word boundary or space before d/D to avoid matching inside words
                    const dayMatch = name.match(/(?:^|\s)(day|Day|d|D)\s*(\d+)(?!\d*x)/i);
                    if (!dayMatch) {
                        console.log(`[Plate ${plateIndex}] Skipped (no day): "${name}"`);
                        return;
                    }

                    const day = parseInt(dayMatch[2]);  // Note: now index 2 due to capture group

                    // Remove day info, dilution factor, replicate number, and experimenter names
                    let conditionName = name
                        .replace(/(?:Day|day|d|D)\s*\d+\s*/gi, ' ')  // Remove day info
                        .replace(/\s*\(\d+x\)\s*/gi, ' ')             // Remove (10x)
                        .replace(/\s*\d+x\s*/gi, ' ')                 // Remove 10x
                        .replace(/\s*#\d+(?![-\w])/g, ' ')            // Remove #1 but keep #0-a
                        .replace(/\s*\(\s*\)\s*/g, ' ')               // Remove ()
                        .replace(/\b(Matsumoto|sugawa|yada)\b/gi, ' ') // Remove experimenter names
                        .replace(/\s+/g, ' ')                         // Normalize spaces
                        .trim();

                    console.log(`[Plate ${plateIndex}] ${wellId}: "${name}" -> Condition: "${conditionName}", Day: ${day}, calcConc: ${data.calculatedConcentration?.toFixed(2)}`);

                    if (!conditionName) return;

                    // Initialize structure
                    if (!rawData[conditionName]) {
                        rawData[conditionName] = {};
                    }
                    if (!rawData[conditionName][day]) {
                        rawData[conditionName][day] = [];
                    }

                    // Re-calculate final concentration strictly from calculatedConcentration and dilution
                    // This ensures consistency with the Export Results logic
                    const dilution = data.dilution || 1;
                    const dilutedConc = data.calculatedConcentration * dilution;
                    // Final Conc: #0-a and #0-b use 0.005, others use 0.01 (µg / 1M cells)
                    const is0Sample = data.name && (data.name.includes('#0-a') || data.name.includes('#0-b'));
                    const conversionFactor = is0Sample ? 0.005 : 0.01;
                    const finalConc = dilutedConc * conversionFactor;

                    // Store detailed object including source info
                    rawData[conditionName][day].push({
                        value: finalConc,
                        plateIdx: plateIndex,
                        wellId: wellId
                    });
                }
            });
        });

        // Log summary
        console.log("=== groupSamplesByCondition END ===");
        console.log("Total processed samples:", processedSamples.size);
        Object.entries(rawData).forEach(([condition, days]) => {
            Object.entries(days).forEach(([day, values]) => {
                console.log(`  ${condition} Day ${day}: ${values.length} values`);
            });
        });

        // Calculate mean and SD for each condition/day
        const grouped = {};
        Object.entries(rawData).forEach(([conditionName, days]) => {
            grouped[conditionName] = {};
            Object.entries(days).forEach(([day, valuesArr]) => {
                // valuesArr is now array of objects
                const values = valuesArr.map(v => v.value);
                const mean = values.reduce((a, b) => a + b, 0) / values.length;
                const sd = values.length > 1
                    ? Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (values.length - 1))
                    : 0;
                // Store objects in values property for later source tracking
                grouped[conditionName][day] = { mean, sd, n: values.length, values: valuesArr };
            });
        });

        return grouped;
    }

    /**
     * Setup drag and drop for master drop zone (multi-plate CSV)
     */
    setupDragAndDrop() {
        const masterDropZone = document.getElementById('masterDropZone');
        if (!masterDropZone) return;

        // Drag events
        masterDropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            masterDropZone.classList.add('drag-over');
        });

        masterDropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            masterDropZone.classList.remove('drag-over');
        });

        masterDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            masterDropZone.classList.remove('drag-over');

            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const file = files[0];
                if (file.name.endsWith('.csv')) {
                    this.handleMultiPlateCsvImport(file);
                } else {
                    alert('CSVファイルをドロップしてください。');
                }
            }
        });

        // Click to upload
        masterDropZone.addEventListener('click', (e) => {
            if (e.target.id === 'clearAllDataBtn') return;

            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.csv';
            input.onchange = (ev) => {
                const file = ev.target.files[0];
                if (file) {
                    this.handleMultiPlateCsvImport(file);
                }
            };
            input.click();
        });

        // Clear all data button
        const clearBtn = document.getElementById('clearAllDataBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.clearAllPlateData();
            });
        }
    }

    /**
     * Handle multi-plate CSV import (multiple plates stacked vertically)
     */
    handleMultiPlateCsvImport(file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const csvText = event.target.result;
                const allRows = this.parseMultiPlateCsv(csvText);

                // Each plate is 8 rows
                const rowsPerPlate = 8;
                const numPlates = Math.min(10, Math.ceil(allRows.length / rowsPerPlate));

                console.log(`Importing ${numPlates} plates from CSV (${allRows.length} rows total)`);

                // Clear existing data
                for (let i = 0; i < 10; i++) {
                    this.plates[i] = this.createEmptyPlate();
                }

                // Process each plate
                for (let plateIdx = 0; plateIdx < numPlates; plateIdx++) {
                    const startRow = plateIdx * rowsPerPlate;
                    const plateRows = allRows.slice(startRow, startRow + rowsPerPlate);

                    if (plateRows.length > 0) {
                        this.applyCombinedRowsToPlate(plateRows, plateIdx);
                    }
                }

                // Update UI
                const statusEl = document.getElementById('masterDropStatus');
                const masterZone = document.getElementById('masterDropZone');
                statusEl.textContent = `✓ ${file.name} (${numPlates} plates loaded)`;
                masterZone.classList.add('loaded');

                // Update plate status indicators
                this.updatePlateStatusIndicators();

                // Refresh display
                this.plateData = this.plates[this.currentPlateIndex];
                this.refreshPlateDisplay();
                this.updateStandardsTable();
                this.updatePlateTabIndicators();

            } catch (error) {
                alert(`CSVインポートエラー: ${error.message}`);
                console.error(error);
            }
        };
        reader.readAsText(file);
    }

    /**
     * Parse CSV for multi-plate format (returns all rows)
     */
    parseMultiPlateCsv(csvText) {
        const lines = csvText.trim().split(/\r?\n/);
        const allRows = [];

        for (const line of lines) {
            // Skip empty lines
            if (!line.trim()) continue;

            // Parse the row
            const cells = line.split(/[,\t]/);

            // Skip header rows (first cell is a row label like A, B, C or has column numbers)
            const firstCell = cells[0]?.trim() || '';
            if (firstCell === '' || /^[A-H]$/i.test(firstCell)) {
                // Remove the row label if present
                if (/^[A-H]$/i.test(firstCell)) {
                    cells.shift();
                }
                allRows.push(cells);
            } else if (/^\d+$/.test(firstCell) || firstCell.toLowerCase().includes('row')) {
                // Skip column header rows
                continue;
            } else {
                // Include the row as-is
                allRows.push(cells);
            }
        }

        return allRows;
    }

    /**
     * Apply rows to a specific plate (combined format: cols 0-11 names, cols 12-23 absorbance)
     * Full 96-well plate: 8 rows x 12 columns
     * Each sample uses 2 wells (duplicate), so column 2 may be empty (inherits from column 1)
     * BUT: If both name AND absorbance are empty, treat as truly empty well
     */
    applyCombinedRowsToPlate(rows, plateIndex) {
        const plate = this.plates[plateIndex];

        rows.forEach((cells, rowIdx) => {
            if (rowIdx >= 8) return; // Only 8 rows per plate

            const rowLetter = this.rows[rowIdx]; // A, B, C, etc.
            let lastValidName = null;
            let lastValidType = 'empty';
            let lastValidConcentration = null;
            let lastValidDilution = 1;

            // Process all 12 wells per row
            for (let colIdx = 0; colIdx < 12; colIdx++) {
                const wellId = `${rowLetter}${colIdx + 1}`;
                const nameValue = cells[colIdx];
                const absValue = cells[colIdx + 12]; // Absorbance is in columns 12-23

                // Check if both name and absorbance are empty -> truly empty well
                const nameIsEmpty = nameValue === undefined || nameValue === null || nameValue.toString().trim() === '';
                const absIsEmpty = absValue === undefined || absValue === null || absValue.toString().trim() === '';

                if (nameIsEmpty && absIsEmpty) {
                    // Both are empty -> reset inheritance chain and mark as empty
                    lastValidName = null;
                    lastValidType = 'empty';
                    lastValidConcentration = null;
                    lastValidDilution = 1;
                    // Well stays as empty (default state)
                    plate[wellId].type = 'empty';
                    plate[wellId].name = '';
                    plate[wellId].concentration = null;
                    plate[wellId].absorbance = null;
                    plate[wellId].dilution = 1;
                    continue;
                }

                // Apply name (with inheritance for duplicate wells)
                if (!nameIsEmpty) {
                    const nameStr = nameValue.toString().trim();
                    plate[wellId].name = nameStr;
                    lastValidName = nameStr;

                    // Determine well type
                    const lowerName = nameStr.toLowerCase();
                    if (lowerName.includes('standard') || lowerName.includes('std')) {
                        plate[wellId].type = 'standard';
                        lastValidType = 'standard';
                        const concMatch = nameStr.match(/([\d.]+)\s*(ng|pg|µg|ug|mg)/i);
                        if (concMatch) {
                            plate[wellId].concentration = parseFloat(concMatch[1]);
                            lastValidConcentration = plate[wellId].concentration;
                        }
                    } else if (lowerName.includes('blank') || lowerName === '0' || lowerName.includes('0 ng')) {
                        plate[wellId].type = 'blank';
                        lastValidType = 'blank';
                        plate[wellId].concentration = 0;
                        lastValidConcentration = 0;
                    } else if (nameStr.length > 0) {
                        plate[wellId].type = 'sample';
                        lastValidType = 'sample';

                        // Reset dilution default and update lastValidDilution
                        plate[wellId].dilution = 1;
                        lastValidDilution = 1;

                        // Extract dilution factor - supports (10x), 10x,etc.
                        const dilutionMatch = nameStr.match(/(?:^|\s|\()(\d+)x(?:\s|\)|$)/i);
                        if (dilutionMatch) {
                            plate[wellId].dilution = parseInt(dilutionMatch[1]);
                            lastValidDilution = plate[wellId].dilution;
                        }
                    }
                } else if (lastValidName !== null && !absIsEmpty) {
                    // Name is empty but absorbance exists -> inherit from previous well (duplicate well)
                    plate[wellId].name = lastValidName;
                    plate[wellId].type = lastValidType;
                    if (lastValidConcentration !== null) {
                        plate[wellId].concentration = lastValidConcentration;
                    }
                    plate[wellId].dilution = lastValidDilution;
                }

                // Apply absorbance
                if (!absIsEmpty) {
                    const numVal = parseFloat(absValue);
                    if (!isNaN(numVal)) {
                        plate[wellId].absorbance = numVal;
                    }
                }
            }
        });

        console.log(`Applied data to plate ${plateIndex + 1}:`, plate);
    }

    /**
     * Update plate status indicators in the UI
     */
    updatePlateStatusIndicators() {
        for (let i = 0; i < 10; i++) {
            const plate = this.plates[i];
            const hasData = Object.values(plate).some(well => well.type !== 'empty');
            const statusItem = document.querySelector(`.plate-status-item[data-plate="${i + 1}"]`);
            if (statusItem) {
                statusItem.classList.toggle('active', hasData);
            }
        }
    }

    /**
     * Clear all plate data (for the master drop zone)
     */
    clearAllPlateData() {
        // Reset all plates
        for (let i = 0; i < 10; i++) {
            this.plates[i] = this.createEmptyPlate();
        }
        this.plateData = this.plates[0];
        this.currentPlateIndex = 0;

        // Reset UI
        const statusEl = document.getElementById('masterDropStatus');
        const masterZone = document.getElementById('masterDropZone');
        if (statusEl) statusEl.textContent = 'Ready to import';
        if (masterZone) masterZone.classList.remove('loaded');

        // Reset plate status indicators
        document.querySelectorAll('.plate-status-item').forEach(item => {
            item.classList.remove('active');
        });

        // Reset plate tabs
        document.querySelectorAll('.plate-tab').forEach((tab, idx) => {
            tab.classList.toggle('active', idx === 0);
            tab.classList.remove('has-data');
        });

        // Refresh display
        this.refreshPlateDisplay();
        this.updateStandardsTable();
        this.chartManager.clear();
        this.clearParameters();
        this.clearResultsTable();

        // Clear sample charts
        const chartsContainer = document.getElementById('sampleChartsContainer');
        if (chartsContainer) {
            chartsContainer.innerHTML = '<p class="no-charts-message">Click "Generate Charts" after fitting the curve to display sample graphs.</p>';
        }
    }

    /**
     * Clear a specific plate zone (names, absorbance, or combined)
     */
    clearPlateZone(plateIndex, type, zone) {
        const plate = this.plates[plateIndex];

        // Clear the specific data
        Object.keys(plate).forEach(wellId => {
            if (type === 'names') {
                plate[wellId].name = '';
                plate[wellId].type = 'empty';
                plate[wellId].concentration = null;
                plate[wellId].dilution = 1;
            } else if (type === 'abs') {
                plate[wellId].absorbance = null;
                plate[wellId].calculatedConcentration = null;
            } else if (type === 'combined') {
                // Clear everything
                plate[wellId].name = '';
                plate[wellId].type = 'empty';
                plate[wellId].concentration = null;
                plate[wellId].dilution = 1;
                plate[wellId].absorbance = null;
                plate[wellId].calculatedConcentration = null;
            }
        });

        // Reset zone status
        const statusEl = zone.querySelector('.drop-status');
        statusEl.textContent = 'Drop here';
        zone.classList.remove('loaded');

        // Refresh display
        if (plateIndex === this.currentPlateIndex) {
            this.refreshPlateDisplay();
        }

        this.updateStandardsTable();
        this.updatePlateTabIndicators();
    }

    /**
     * Handle file drop for a specific plate
     */
    handlePlateFileDrop(file, plateIndex, type, zone) {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = this.parsePlateLayoutCsv(event.target.result);

                if (type === 'combined') {
                    // Combined format: left half (cols 1-6) = names, right half (cols 7-12) = absorbance
                    this.applyCombinedCsvToPlate(data, plateIndex);
                } else if (type === 'names') {
                    this.applyNamesToPlateDirect(data, plateIndex);
                } else if (type === 'abs') {
                    this.applyAbsorbanceToPlateDirect(data, plateIndex);
                }

                // Update status
                const statusEl = zone.querySelector('.drop-status');
                statusEl.textContent = `✓ ${file.name}`;
                zone.classList.add('loaded');

                // Update display if this is the current plate
                if (plateIndex === this.currentPlateIndex) {
                    this.refreshPlateDisplay();
                }

                this.updateStandardsTable();
                this.updatePlateTabIndicators();

            } catch (error) {
                alert(`Error importing CSV: ${error.message}`);
                console.error(error);
            }
        };
        reader.readAsText(file);
    }

    /**
     * Apply combined CSV format to a plate
     * Left half (cols 1-6) = well names, Right half (cols 7-12) = absorbance
     */
    applyCombinedCsvToPlate(data, plateIndex) {
        const plate = this.plates[plateIndex];

        // Process 8 rows (A-H), 6 columns each side
        this.rows.forEach((row, rowIdx) => {
            // Left side (cols 0-5): well names -> wells A1-A6, B1-B6, etc.
            for (let colIdx = 0; colIdx < 6; colIdx++) {
                const wellId = `${row}${colIdx + 1}`;
                const nameValue = data[rowIdx]?.[colIdx];

                if (nameValue !== undefined && nameValue !== null && nameValue !== '') {
                    const nameStr = nameValue.toString().trim();
                    plate[wellId].name = nameStr;

                    // Determine well type and extract data
                    const lowerName = nameStr.toLowerCase();
                    if (lowerName.includes('standard') || lowerName.includes('std')) {
                        plate[wellId].type = 'standard';
                        const concMatch = nameStr.match(/([\d.]+)\s*(ng|pg|µg|ug)/i);
                        if (concMatch) {
                            plate[wellId].concentration = parseFloat(concMatch[1]);
                        }
                    } else if (lowerName.includes('blank') || lowerName === '0' || lowerName.includes('0 ng')) {
                        plate[wellId].type = 'blank';
                        plate[wellId].concentration = 0;
                    } else if (nameStr.length > 0) {
                        plate[wellId].type = 'sample';
                        // Extract dilution factor from (10x), (20x), etc.
                        const dilutionMatch = nameStr.match(/\((\d+)x\)/i);
                        if (dilutionMatch) {
                            plate[wellId].dilution = parseInt(dilutionMatch[1]);
                        }
                    }
                }

                // Right side (cols 6-11): absorbance values -> same wells A1-A6, B1-B6, etc.
                const absColIdx = colIdx + 6;
                const absValue = data[rowIdx]?.[absColIdx];

                if (absValue !== undefined && absValue !== null && absValue !== '') {
                    const numVal = parseFloat(absValue);
                    if (!isNaN(numVal)) {
                        plate[wellId].absorbance = numVal;
                    }
                }
            }
        });

        console.log(`Applied combined CSV to plate ${plateIndex + 1}:`, plate);
    }

    /**
     * Apply names data directly to a specific plate
     */
    applyNamesToPlateDirect(data, plateIndex) {
        const plate = this.plates[plateIndex];

        this.rows.forEach((row, rowIdx) => {
            this.cols.forEach((col, colIdx) => {
                const wellId = `${row}${col}`;
                const value = data[rowIdx]?.[colIdx];
                if (value !== undefined && value !== null && value !== '') {
                    const nameStr = value.toString().trim();
                    plate[wellId].name = nameStr;

                    const nameLower = nameStr.toLowerCase();

                    // Extract dilution factor
                    const dilutionMatch = nameStr.match(/(\d+)x/i);
                    if (dilutionMatch) {
                        plate[wellId].dilution = parseInt(dilutionMatch[1]);
                    }

                    // Check for standard pattern and extract concentration
                    if (nameLower.includes('std') || nameLower.includes('standard')) {
                        plate[wellId].type = 'standard';
                        const concMatch = nameStr.match(/(\d+\.?\d*)\s*(ng\/ml|ng\/mL|pg\/ml|pg\/mL)?/i);
                        if (concMatch) {
                            plate[wellId].concentration = parseFloat(concMatch[1]);
                        }
                    } else if (nameLower.includes('blank') || nameLower === 'b') {
                        plate[wellId].type = 'blank';
                    } else {
                        const pureNumberMatch = nameStr.match(/^(\d+\.?\d*)\s*(ng\/ml|ng\/mL|pg\/ml|pg\/mL)?$/i);
                        if (pureNumberMatch) {
                            plate[wellId].type = 'standard';
                            plate[wellId].concentration = parseFloat(pureNumberMatch[1]);
                        } else if (nameStr !== '') {
                            plate[wellId].type = 'sample';
                        }
                    }
                }
            });
        });
    }

    /**
     * Apply absorbance data directly to a specific plate
     */
    applyAbsorbanceToPlateDirect(data, plateIndex) {
        const plate = this.plates[plateIndex];

        this.rows.forEach((row, rowIdx) => {
            this.cols.forEach((col, colIdx) => {
                const wellId = `${row}${col}`;
                const value = data[rowIdx]?.[colIdx];
                if (value !== undefined && value !== null && value !== '') {
                    const absValue = parseFloat(value);
                    if (!isNaN(absValue)) {
                        plate[wellId].absorbance = absValue;
                    }
                }
            });
        });
    }

    /**
     * Refresh the plate grid display for current plate
     */
    refreshPlateDisplay() {
        Object.keys(this.plateData).forEach(wellId => {
            this.updateWellAppearance(wellId);
        });
    }

    /**
     * Get merged data from all plates (for curve fitting and charts)
     */
    getMergedPlateData() {
        const merged = {};
        let wellCounter = 0;

        this.plates.forEach((plate, plateIdx) => {
            Object.entries(plate).forEach(([wellId, data]) => {
                if (data.type !== 'empty') {
                    // Create unique key with plate prefix
                    const uniqueKey = `P${plateIdx + 1}_${wellId}`;
                    merged[uniqueKey] = {
                        ...data,
                        plateIndex: plateIdx,
                        originalWellId: wellId
                    };
                }
            });
        });

        return merged;
    }

    /**
     * Create a temporary canvas with white background from source canvas
     */
    createWhiteBackgroundCanvas(sourceCanvas) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = sourceCanvas.width;
        tempCanvas.height = sourceCanvas.height;
        const ctx = tempCanvas.getContext('2d');

        // Fill with white
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

        // Draw original canvas
        ctx.drawImage(sourceCanvas, 0, 0);

        return tempCanvas;
    }

    /**
     * Export all sample charts as PNG
     */
    exportChartsAsPng() {
        const charts = Object.entries(this.sampleCharts);
        if (charts.length === 0) {
            alert('No charts to export. Generate charts first.');
            return;
        }

        charts.forEach(([canvasId, chart]) => {
            const canvas = document.getElementById(canvasId);
            if (canvas) {
                const whiteCanvas = this.createWhiteBackgroundCanvas(canvas);
                const link = document.createElement('a');
                link.download = `${canvasId}.png`;
                link.href = whiteCanvas.toDataURL('image/png', 1.0);
                link.click();
            }
        });
    }

    /**
     * Export all sample charts as SVG
     */
    exportChartsAsSvg() {
        const charts = Object.entries(this.sampleCharts);
        if (charts.length === 0) {
            alert('No charts to export. Generate charts first.');
            return;
        }

        charts.forEach(([canvasId, chart]) => {
            const svg = this.chartToSvg(chart, canvasId);
            const blob = new Blob([svg], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = `${canvasId}.svg`;
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);
        });
    }

    /**
     * Create export dropdown for individual chart
     */
    createChartExportDropdown(canvasId, chartTitle) {
        const dropdown = document.createElement('div');
        dropdown.className = 'chart-export-dropdown';
        dropdown.style.position = 'relative';

        const btn = document.createElement('button');
        btn.className = 'btn btn-secondary btn-sm';
        btn.innerHTML = '📥';
        btn.title = 'Export this chart';
        btn.style.padding = '4px 8px';
        btn.style.fontSize = '12px';

        const menu = document.createElement('div');
        menu.className = 'chart-export-menu';
        menu.style.display = 'none';
        menu.style.position = 'absolute';
        menu.style.right = '0';
        menu.style.top = '100%';
        menu.style.zIndex = '100';
        menu.style.background = '#ffffff';
        menu.style.border = '1px solid #ddd';
        menu.style.borderRadius = '4px';
        menu.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
        menu.style.minWidth = '120px';

        const pngBtn = document.createElement('button');
        pngBtn.textContent = 'PNG';
        pngBtn.style.display = 'block';
        pngBtn.style.width = '100%';
        pngBtn.style.padding = '8px 12px';
        pngBtn.style.border = 'none';
        pngBtn.style.background = 'none';
        pngBtn.style.textAlign = 'left';
        pngBtn.style.cursor = 'pointer';
        pngBtn.style.fontSize = '0.85rem';
        pngBtn.addEventListener('mouseenter', () => pngBtn.style.background = '#f0f0f0');
        pngBtn.addEventListener('mouseleave', () => pngBtn.style.background = 'none');
        pngBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.exportSingleChartAsPng(canvasId, chartTitle);
            menu.style.display = 'none';
        });

        const svgBtn = document.createElement('button');
        svgBtn.textContent = 'SVG';
        svgBtn.style.display = 'block';
        svgBtn.style.width = '100%';
        svgBtn.style.padding = '8px 12px';
        svgBtn.style.border = 'none';
        svgBtn.style.background = 'none';
        svgBtn.style.textAlign = 'left';
        svgBtn.style.cursor = 'pointer';
        svgBtn.style.fontSize = '0.85rem';
        svgBtn.style.borderTop = '1px solid #eee';
        svgBtn.addEventListener('mouseenter', () => svgBtn.style.background = '#f0f0f0');
        svgBtn.addEventListener('mouseleave', () => svgBtn.style.background = 'none');
        svgBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.exportSingleChartAsSvg(canvasId, chartTitle);
            menu.style.display = 'none';
        });

        menu.appendChild(pngBtn);
        menu.appendChild(svgBtn);

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
        });

        // Close menu when clicking outside
        document.addEventListener('click', () => {
            menu.style.display = 'none';
        });

        dropdown.appendChild(btn);
        dropdown.appendChild(menu);

        return dropdown;
    }

    /**
     * Export single chart as PNG
     */
    exportSingleChartAsPng(canvasId, chartTitle) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            alert('Chart not found.');
            return;
        }

        const whiteCanvas = this.createWhiteBackgroundCanvas(canvas);
        const link = document.createElement('a');
        const filename = chartTitle.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        link.download = `${filename}.png`;
        link.href = whiteCanvas.toDataURL('image/png', 1.0);
        link.click();
    }

    /**
     * Export single chart as SVG
     */
    exportSingleChartAsSvg(canvasId, chartTitle) {
        const chart = this.sampleCharts[canvasId];
        if (!chart) {
            alert('Chart not found.');
            return;
        }

        const svg = this.chartToSvg(chart, canvasId);
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const filename = chartTitle.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        link.download = `${filename}.svg`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Convert Chart.js chart to SVG string - Improved version
     * Accurately reproduces the visual appearance from the canvas
     */
    chartToSvg(chart, title) {
        const canvas = chart.canvas;
        const width = canvas.offsetWidth || canvas.width;
        const height = canvas.offsetHeight || canvas.height;
        const data = chart.data;
        const scales = chart.scales;
        const chartArea = chart.chartArea;

        // Use actual chart dimensions
        const actualWidth = Math.max(width, 800);
        const actualHeight = Math.max(height, 400);

        // Get scale information
        const xScale = scales.x;
        const yScale = scales.y;

        // Calculate padding based on chart area
        const padding = {
            top: chartArea ? chartArea.top : 60,
            right: chartArea ? (actualWidth - chartArea.right) : 30,
            bottom: chartArea ? (actualHeight - chartArea.bottom) : 100,
            left: chartArea ? chartArea.left : 80
        };

        const chartWidth = actualWidth - padding.left - padding.right;
        const chartHeight = actualHeight - padding.top - padding.bottom;

        // Get Y axis range
        const yMax = yScale ? yScale.max : Math.max(...data.datasets.flatMap(d => d.data.filter(v => v !== null))) * 1.25;
        const yMin = yScale ? yScale.min : 0;

        // Clean title for display
        const displayTitle = title
            .replace('chart-', '')
            .replace(/-/g, ' ')
            .replace(/combined comparison/i, 'Combined Comparison - All Conditions');

        let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${actualWidth}" height="${actualHeight}" viewBox="0 0 ${actualWidth} ${actualHeight}">
  <style>
    .chart-text { font-family: 'Inter', 'Arial', sans-serif; }
    .title { font-size: 18px; font-weight: bold; fill: #000000; }
    .axis-label { font-size: 14px; font-weight: bold; fill: #000000; }
    .tick-label { font-size: 11px; fill: #000000; }
    .condition-label { font-size: 11px; font-weight: bold; fill: #000000; }
  </style>
  
  <!-- Background -->
  <rect width="${actualWidth}" height="${actualHeight}" fill="white"/>
  
  <!-- Title -->
  <text x="${actualWidth / 2}" y="25" text-anchor="middle" class="chart-text title">${displayTitle}</text>
  
  <!-- Y Axis -->
  <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${actualHeight - padding.bottom}" stroke="#000000" stroke-width="2"/>
  
  <!-- X Axis -->
  <line x1="${padding.left}" y1="${actualHeight - padding.bottom}" x2="${actualWidth - padding.right}" y2="${actualHeight - padding.bottom}" stroke="#000000" stroke-width="2"/>
  
  <!-- Y Axis Label -->
  <text x="25" y="${actualHeight / 2}" text-anchor="middle" transform="rotate(-90 25 ${actualHeight / 2})" class="chart-text axis-label">Albumin secretion (µg/1 M Cells/Day)</text>
  
  <!-- X Axis Label -->
  <text x="${actualWidth / 2}" y="${actualHeight - 15}" text-anchor="middle" class="chart-text axis-label">Day</text>`;

        // Add Y axis grid lines and ticks
        const yTicks = 5;
        for (let i = 0; i <= yTicks; i++) {
            const yVal = yMin + ((yMax - yMin) / yTicks) * i;
            const y = actualHeight - padding.bottom - (chartHeight / yTicks) * i;

            // Grid line
            if (i > 0) {
                svg += `
  <line x1="${padding.left}" y1="${y}" x2="${actualWidth - padding.right}" y2="${y}" stroke="#e0e0e0" stroke-width="1"/>`;
            }

            // Tick and label
            svg += `
  <text x="${padding.left - 10}" y="${y + 4}" text-anchor="end" class="chart-text tick-label">${yVal.toFixed(1)}</text>
  <line x1="${padding.left - 5}" y1="${y}" x2="${padding.left}" y2="${y}" stroke="#000000"/>`;
        }

        const labels = data.labels || [];
        const datasets = data.datasets;

        // Determine if this is a single dataset chart or multi-dataset (combined comparison)
        if (datasets.length === 1 || (datasets[0].type !== 'scatter' && datasets.length <= 2)) {
            // Single dataset bar chart (individual condition charts)
            const dataset = datasets[0];
            const values = dataset.data;
            const bgColors = Array.isArray(dataset.backgroundColor)
                ? dataset.backgroundColor
                : labels.map(() => dataset.backgroundColor || 'rgba(102, 102, 102, 0.7)');

            const barTotalWidth = chartWidth / labels.length;
            const barWidth = barTotalWidth * 0.7;
            const barGap = barTotalWidth * 0.15;

            labels.forEach((label, i) => {
                const value = values[i];
                if (value === null || value === undefined) return;

                const x = padding.left + barTotalWidth * i + barGap;
                const barHeight = ((value - yMin) / (yMax - yMin)) * chartHeight;
                const y = actualHeight - padding.bottom - barHeight;

                // Get color for this bar
                const color = bgColors[i] || 'rgba(102, 102, 102, 0.7)';
                const fillColor = color.replace(/[\d.]+\)$/, '0.8)'); // Ensure good opacity

                svg += `
  <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${fillColor}" stroke="#333333" stroke-width="1"/>
  <text x="${x + barWidth / 2}" y="${actualHeight - padding.bottom + 15}" text-anchor="end" transform="rotate(-45 ${x + barWidth / 2} ${actualHeight - padding.bottom + 15})" class="chart-text tick-label">${label}</text>`;
            });

            // Add scatter points (individual values) if present
            if (datasets.length > 1 && datasets[1].data) {
                datasets[1].data.forEach(point => {
                    if (!point || point.y === null || point.y === undefined) return;

                    // Find the category index
                    const labelIndex = labels.indexOf(point.x);
                    if (labelIndex === -1) return;

                    const barTotalWidth = chartWidth / labels.length;
                    const barCenterX = padding.left + barTotalWidth * labelIndex + barTotalWidth / 2;
                    const pointY = actualHeight - padding.bottom - ((point.y - yMin) / (yMax - yMin)) * chartHeight;

                    svg += `
  <circle cx="${barCenterX}" cy="${pointY}" r="3" fill="#000000"/>`;
                });
            }

            // Add error bars from stored chart data
            if (chart.errorData && chart.barValues) {
                const errors = chart.errorData;
                const barVals = chart.barValues;

                labels.forEach((label, i) => {
                    const value = barVals[i];
                    const error = errors[i];

                    if (value === null || value === undefined || error === 0 || error === undefined) return;

                    const barCenterX = padding.left + barTotalWidth * i + barTotalWidth / 2;
                    const yTop = actualHeight - padding.bottom - ((value + error - yMin) / (yMax - yMin)) * chartHeight;
                    const yBottom = actualHeight - padding.bottom - ((Math.max(0, value - error) - yMin) / (yMax - yMin)) * chartHeight;

                    // Error bar vertical line
                    svg += `
  <line x1="${barCenterX}" y1="${yTop}" x2="${barCenterX}" y2="${yBottom}" stroke="#000000" stroke-width="1.5"/>`;

                    // Error bar caps
                    const capWidth = 5;
                    svg += `
  <line x1="${barCenterX - capWidth}" y1="${yTop}" x2="${barCenterX + capWidth}" y2="${yTop}" stroke="#000000" stroke-width="1.5"/>
  <line x1="${barCenterX - capWidth}" y1="${yBottom}" x2="${barCenterX + capWidth}" y2="${yBottom}" stroke="#000000" stroke-width="1.5"/>`;
                });
            }
        }

        svg += `
</svg>`;

        return svg;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new ELISAPlateAnalyzer();
});
