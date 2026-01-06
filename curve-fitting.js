/**
 * 4-Parameter Logistic (4PL) Curve Fitting Module
 * 
 * Model: y = D + (A - D) / (1 + (x / C)^B)
 * 
 * Parameters:
 * A - Minimum asymptote (response at zero concentration)
 * B - Hill slope (steepness of the curve)
 * C - EC50 (concentration at inflection point)
 * D - Maximum asymptote (response at infinite concentration)
 */

class CurveFitter {
    constructor() {
        this.params = null;
        this.rSquared = null;
    }

    /**
     * 4PL function
     * @param {number} x - Concentration
     * @param {object} params - {A, B, C, D}
     * @returns {number} - Predicted absorbance
     */
    fourPL(x, params) {
        const { A, B, C, D } = params;
        if (x <= 0) return A; // Corrected: Return A (response at zero concentration)
        return D + (A - D) / (1 + Math.pow(x / C, B));
    }

    /**
     * Inverse 4PL function - calculate concentration from absorbance
     * @param {number} y - Absorbance
     * @param {object} params - {A, B, C, D}
     * @returns {number|null} - Calculated concentration or null if invalid
     */
    inverse4PL(y, params) {
        const { A, B, C, D } = params;

        // Check if y is within valid range
        const minY = Math.min(A, D);
        const maxY = Math.max(A, D);

        if (y <= minY || y >= maxY) {
            return null; // Out of range
        }

        const ratio = (A - D) / (y - D) - 1;
        if (ratio <= 0) {
            return null; // Invalid calculation
        }

        return C * Math.pow(ratio, 1 / B);
    }

    /**
     * Calculate residual sum of squares
     * @param {array} data - Array of {x, y} points
     * @param {object} params - {A, B, C, D}
     * @returns {number} - Sum of squared residuals
     */
    calculateSSR(data, params) {
        let ssr = 0;
        for (const point of data) {
            const predicted = this.fourPL(point.x, params);
            ssr += Math.pow(point.y - predicted, 2);
        }
        return ssr;
    }

    /**
     * Calculate total sum of squares
     * @param {array} data - Array of {x, y} points
     * @returns {number} - Total sum of squares
     */
    calculateSST(data) {
        const mean = data.reduce((sum, p) => sum + p.y, 0) / data.length;
        return data.reduce((sum, p) => sum + Math.pow(p.y - mean, 2), 0);
    }

    /**
     * Calculate R-squared
     * @param {array} data - Array of {x, y} points
     * @param {object} params - {A, B, C, D}
     * @returns {number} - R-squared value
     */
    calculateRSquared(data, params) {
        const ssr = this.calculateSSR(data, params);
        const sst = this.calculateSST(data);
        return 1 - (ssr / sst);
    }

    /**
     * Initial parameter estimation
     * @param {array} data - Array of {x, y} points sorted by x
     * @returns {object} - Initial parameter estimates {A, B, C, D}
     */
    /**
     * Initial parameter estimation (Python scipy-like)
     * @param {array} data - Array of {x, y} points sorted by x
     * @returns {object} - Initial parameter estimates {A, B, C, D}
     */
    estimateInitialParams(data) {
        // Sort Y values to find min/max
        const sortedY = data.map(p => p.y).sort((a, b) => a - b);

        // p0 = [y.min(), 1.0, 50.0(use median X), y.max()]
        const A = sortedY[0];
        const B = 1.0;

        // Calculate Median X
        const sortedX = data.map(p => p.x).sort((a, b) => a - b);
        const mid = Math.floor(sortedX.length / 2);
        const C = sortedX.length % 2 !== 0
            ? sortedX[mid]
            : (sortedX[mid - 1] + sortedX[mid]) / 2;

        const D = sortedY[sortedY.length - 1];

        return { A, B, C, D };
    }

    /**
     * Levenberg-Marquardt optimization for 4PL fitting
     * Based on scipy.optimize.curve_fit behavior
     */
    optimize(data, initialParams, maxIterations = 100000, tolerance = 1e-15) {
        let params = { ...initialParams };
        let lambda = 0.001;
        let prevSSR = this.calculateSSR(data, params);

        // Bounds: A >= 0, B >= 0, C >= 1e-12, D >= 0
        const applyBounds = (p) => ({
            A: Math.max(0, p.A),
            B: Math.max(0, p.B),
            C: Math.max(1e-12, p.C),
            D: Math.max(0, p.D)
        });

        params = applyBounds(params);

        for (let iter = 0; iter < maxIterations; iter++) {
            // Calculate Jacobian and residuals
            const { jacobian, residuals } = this.calculateJacobianAndResiduals(data, params);

            // J^T * J
            const JtJ = this.matrixMultiply(this.transpose(jacobian), jacobian);

            // J^T * r
            const Jtr = this.matrixVectorMultiply(this.transpose(jacobian), residuals);

            // Add damping: (J^T * J + lambda * diag(J^T * J)) * delta = J^T * r
            // Using Marquardt's improvement: scale by diagonal
            for (let i = 0; i < 4; i++) {
                JtJ[i][i] *= (1 + lambda);
                if (JtJ[i][i] < 1e-10) JtJ[i][i] = 1e-10; // Prevent singularity
            }

            // Solve for delta
            const delta = this.solveLinearSystem(JtJ, Jtr);

            if (!delta || delta.some(d => !isFinite(d))) {
                lambda *= 10;
                if (lambda > 1e15) break;
                continue;
            }

            // Update parameters with bounds
            const newParams = applyBounds({
                A: params.A + delta[0],
                B: params.B + delta[1],
                C: params.C + delta[2],
                D: params.D + delta[3]
            });

            const newSSR = this.calculateSSR(data, newParams);

            if (newSSR < prevSSR) {
                // Accept update
                params = newParams;
                lambda = Math.max(1e-10, lambda / 10);

                // Convergence check: relative change in SSR
                const relChange = Math.abs(prevSSR - newSSR) / (prevSSR + 1e-15);
                if (relChange < tolerance) {
                    break;
                }
                prevSSR = newSSR;
            } else {
                // Reject update, increase damping
                lambda *= 10;
            }

            if (lambda > 1e15) {
                break;
            }
        }

        return params;
    }

    /**
     * Calculate Jacobian matrix and residuals
     * J[i][j] = d(predicted[i])/d(param[j])
     * residuals[i] = y[i] - predicted[i]
     */
    calculateJacobianAndResiduals(data, params) {
        const { A, B, C, D } = params;
        const jacobian = [];
        const residuals = [];
        const h = 1e-8;

        for (const point of data) {
            const x = point.x;
            const y = point.y;
            const predicted = this.fourPL(x, params);

            residuals.push(y - predicted);

            // Numerical partial derivatives with central differences for better accuracy
            const dA = (this.fourPL(x, { A: A + h, B, C, D }) - this.fourPL(x, { A: A - h, B, C, D })) / (2 * h);
            const dB = (this.fourPL(x, { A, B: B + h, C, D }) - this.fourPL(x, { A, B: B - h, C, D })) / (2 * h);
            const dC = (this.fourPL(x, { A, B, C: C + h, D }) - this.fourPL(x, { A, B, C: C - h, D })) / (2 * h);
            const dD = (this.fourPL(x, { A, B, C, D: D + h }) - this.fourPL(x, { A, B, C, D: D - h })) / (2 * h);

            jacobian.push([dA, dB, dC, dD]);
        }

        return { jacobian, residuals };
    }

    /**
     * Calculate Jacobian matrix and residuals
     */
    calculateJacobianAndResiduals(data, params) {
        const { A, B, C, D } = params;
        const jacobian = [];
        const residuals = [];
        const h = 1e-6; // Small step for numerical differentiation

        for (const point of data) {
            const x = point.x;
            const y = point.y;
            const predicted = this.fourPL(x, params);

            residuals.push(y - predicted);

            // Numerical partial derivatives
            const dA = (this.fourPL(x, { A: A + h, B, C, D }) - predicted) / h;
            const dB = (this.fourPL(x, { A, B: B + h, C, D }) - predicted) / h;
            const dC = (this.fourPL(x, { A, B, C: C + h, D }) - predicted) / h;
            const dD = (this.fourPL(x, { A, B, C, D: D + h }) - predicted) / h;

            jacobian.push([dA, dB, dC, dD]);
        }

        return { jacobian, residuals };
    }

    /**
     * Matrix transpose
     */
    transpose(matrix) {
        const rows = matrix.length;
        const cols = matrix[0].length;
        const result = [];

        for (let j = 0; j < cols; j++) {
            result[j] = [];
            for (let i = 0; i < rows; i++) {
                result[j][i] = matrix[i][j];
            }
        }

        return result;
    }

    /**
     * Matrix multiplication
     */
    matrixMultiply(a, b) {
        const rowsA = a.length;
        const colsA = a[0].length;
        const colsB = b[0].length;
        const result = [];

        for (let i = 0; i < rowsA; i++) {
            result[i] = [];
            for (let j = 0; j < colsB; j++) {
                result[i][j] = 0;
                for (let k = 0; k < colsA; k++) {
                    result[i][j] += a[i][k] * b[k][j];
                }
            }
        }

        return result;
    }

    /**
     * Matrix-vector multiplication
     */
    matrixVectorMultiply(matrix, vector) {
        const result = [];
        for (let i = 0; i < matrix.length; i++) {
            result[i] = 0;
            for (let j = 0; j < vector.length; j++) {
                result[i] += matrix[i][j] * vector[j];
            }
        }
        return result;
    }

    /**
     * Solve linear system Ax = b using Gaussian elimination
     */
    solveLinearSystem(A, b) {
        const n = b.length;
        const aug = A.map((row, i) => [...row, b[i]]);

        // Forward elimination
        for (let col = 0; col < n; col++) {
            // Find pivot
            let maxRow = col;
            for (let row = col + 1; row < n; row++) {
                if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) {
                    maxRow = row;
                }
            }

            // Swap rows
            [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

            if (Math.abs(aug[col][col]) < 1e-12) {
                return null; // Singular matrix
            }

            // Eliminate
            for (let row = col + 1; row < n; row++) {
                const factor = aug[row][col] / aug[col][col];
                for (let j = col; j <= n; j++) {
                    aug[row][j] -= factor * aug[col][j];
                }
            }
        }

        // Back substitution
        const x = new Array(n);
        for (let row = n - 1; row >= 0; row--) {
            x[row] = aug[row][n];
            for (let col = row + 1; col < n; col++) {
                x[row] -= aug[row][col] * x[col];
            }
            x[row] /= aug[row][row];
        }

        return x;
    }

    /**
     * Fit 4PL curve to data
     * @param {array} data - Array of {x: concentration, y: absorbance}
     * @returns {object} - {params: {A, B, C, D}, rSquared: number}
     */
    fit(data) {
        if (data.length < 4) {
            throw new Error('At least 4 data points are required for 4PL fitting');
        }

        // Filter out invalid data points (include x=0 for zero concentration standards)
        const validData = data.filter(p => p.x >= 0 && !isNaN(p.x) && !isNaN(p.y));

        if (validData.length < 4) {
            throw new Error('Not enough valid data points for 4PL fitting');
        }

        // Estimate initial parameters
        const initialParams = this.estimateInitialParams(validData);

        // Optimize parameters
        this.params = this.optimize(validData, initialParams);

        // Calculate R-squared
        this.rSquared = this.calculateRSquared(validData, this.params);

        return {
            params: this.params,
            rSquared: this.rSquared
        };
    }

    /**
     * Generate curve points for plotting
     * @param {number} minX - Minimum x value
     * @param {number} maxX - Maximum x value
     * @param {number} numPoints - Number of points to generate
     * @param {object} params - Optional parameters (uses fitted params if omitting)
     * @returns {array} - Array of {x, y} points
     */
    generateCurvePoints(minX, maxX, numPoints = 100, params = null) {
        const useParams = params || this.params;
        if (!useParams) {
            throw new Error('Curve must be fitted before generating points or params must be provided');
        }

        const points = [];
        const logMin = Math.log10(minX);
        const logMax = Math.log10(maxX);
        const step = (logMax - logMin) / (numPoints - 1);

        for (let i = 0; i < numPoints; i++) {
            const x = Math.pow(10, logMin + i * step);
            const y = this.fourPL(x, useParams);
            points.push({ x, y });
        }

        return points;
    }

    /**
     * Calculate concentration from absorbance
     * @param {number} absorbance - Measured absorbance
     * @param {object} params - Optional parameters (uses fitted params if omitting)
     * @returns {number|null} - Calculated concentration or null
     */
    calculateConcentration(absorbance, params = null) {
        const useParams = params || this.params;
        if (!useParams) {
            return null; // Instead of throwing, return null for safety
        }

        return this.inverse4PL(absorbance, useParams);
    }
}

// Export for use in other modules
window.CurveFitter = CurveFitter;
