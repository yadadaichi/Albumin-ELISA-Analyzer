/**
 * Statistics Utilities for ELISA Plate Analyzer
 * ANOVA and Tukey HSD statistical tests
 */

class StatisticsUtils {
    /**
     * Calculate mean of an array
     * @param {number[]} arr - Array of numbers
     * @returns {number} Mean value
     */
    static mean(arr) {
        if (arr.length === 0) return 0;
        return arr.reduce((sum, val) => sum + val, 0) / arr.length;
    }

    /**
     * Calculate variance of an array (sample variance)
     * @param {number[]} arr - Array of numbers
     * @returns {number} Variance
     */
    static variance(arr) {
        if (arr.length < 2) return 0;
        const m = this.mean(arr);
        return arr.reduce((sum, val) => sum + Math.pow(val - m, 2), 0) / (arr.length - 1);
    }

    /**
     * Calculate sum of squares
     * @param {number[]} arr - Array of numbers
     * @param {number} mean - Mean value
     * @returns {number} Sum of squares
     */
    static sumOfSquares(arr, mean) {
        return arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0);
    }

    /**
     * One-way ANOVA test
     * Tests if there are significant differences between group means
     * @param {Object[]} groups - Array of groups, each with {name, values}
     * @returns {Object} {fValue, pValue, dfBetween, dfWithin, significant}
     */
    static oneWayANOVA(groups) {
        const k = groups.length; // Number of groups
        if (k < 2) {
            return { fValue: 0, pValue: 1, dfBetween: 0, dfWithin: 0, significant: false };
        }

        // Calculate total N and grand mean
        let totalN = 0;
        let grandSum = 0;
        groups.forEach(g => {
            totalN += g.values.length;
            grandSum += g.values.reduce((a, b) => a + b, 0);
        });
        const grandMean = grandSum / totalN;

        // Debug: Log group info
        console.log('  ANOVA Groups:');
        groups.forEach(g => {
            const gMean = this.mean(g.values);
            const gVar = this.variance(g.values);
            console.log(`    ${g.name}: n=${g.values.length}, mean=${gMean.toFixed(4)}, var=${gVar.toFixed(6)}, values=[${g.values.map(v => v.toFixed(4)).join(', ')}]`);
        });
        console.log(`  Grand mean: ${grandMean.toFixed(4)}`);

        // Calculate SS Between (Sum of Squares Between groups)
        let ssBetween = 0;
        groups.forEach(g => {
            const groupMean = this.mean(g.values);
            ssBetween += g.values.length * Math.pow(groupMean - grandMean, 2);
        });

        // Calculate SS Within (Sum of Squares Within groups)
        let ssWithin = 0;
        groups.forEach(g => {
            const groupMean = this.mean(g.values);
            ssWithin += this.sumOfSquares(g.values, groupMean);
        });

        // Degrees of freedom
        const dfBetween = k - 1;
        const dfWithin = totalN - k;

        if (dfWithin <= 0) {
            return { fValue: 0, pValue: 1, dfBetween, dfWithin, significant: false };
        }

        // Mean Squares
        const msBetween = ssBetween / dfBetween;
        const msWithin = ssWithin / dfWithin;

        // F-value
        const fValue = msWithin > 0 ? msBetween / msWithin : 0;

        // Debug: Log ANOVA components
        console.log(`  SS_between=${ssBetween.toFixed(6)}, SS_within=${ssWithin.toFixed(6)}`);
        console.log(`  MS_between=${msBetween.toFixed(6)}, MS_within=${msWithin.toFixed(6)}`);
        console.log(`  df_between=${dfBetween}, df_within=${dfWithin}, F=${fValue.toFixed(4)}`);

        // Calculate p-value using F-distribution approximation
        const pValue = this.fDistributionPValue(fValue, dfBetween, dfWithin);

        return {
            fValue,
            pValue,
            dfBetween,
            dfWithin,
            msBetween,
            msWithin,
            ssBetween,
            ssWithin,
            significant: pValue < 0.05
        };
    }

    /**
     * Approximate p-value from F-distribution
     * P(F > f) = 1 - CDF(f)
     * Uses regularized incomplete beta function
     * @param {number} f - F-value
     * @param {number} df1 - Degrees of freedom (between)
     * @param {number} df2 - Degrees of freedom (within)
     * @returns {number} Approximate p-value
     */
    static fDistributionPValue(f, df1, df2) {
        if (f <= 0 || df1 <= 0 || df2 <= 0) return 1;

        // F-distribution CDF using the regularized incomplete beta function
        // P(F <= f) = I_x(df1/2, df2/2) where x = df1*f / (df1*f + df2)
        const x = (df1 * f) / (df1 * f + df2);
        const a = df1 / 2;
        const b = df2 / 2;

        // p-value = P(F > f) = 1 - CDF(f) = I_{1-x}(b, a) = 1 - I_x(a, b)
        const cdf = this.regularizedIncompleteBeta(x, a, b);
        const pValue = 1 - cdf;

        // Debug log
        console.log(`  F-dist p-value calc: F=${f.toFixed(3)}, df1=${df1}, df2=${df2}, x=${x.toFixed(6)}, CDF=${cdf.toFixed(6)}, p=${pValue.toFixed(6)}`);

        return Math.max(0, Math.min(1, pValue));
    }

    /**
     * Regularized Incomplete Beta function I_x(a,b)
     * Uses the continued fraction representation (Lentz's algorithm)
     */
    static regularizedIncompleteBeta(x, a, b) {
        if (x < 0 || x > 1) return 0;
        if (x === 0) return 0;
        if (x === 1) return 1;

        // Use the symmetry relation for better convergence
        if (x > (a + 1) / (a + b + 2)) {
            return 1 - this.regularizedIncompleteBeta(1 - x, b, a);
        }

        // Calculate the log of the beta function coefficient
        const lnBeta = this.logGamma(a) + this.logGamma(b) - this.logGamma(a + b);
        const front = Math.exp(a * Math.log(x) + b * Math.log(1 - x) - lnBeta);

        // Lentz's algorithm for continued fraction
        const maxIterations = 200;
        const epsilon = 1e-14;
        const tiny = 1e-30;

        // Initial values
        let c = 1;
        let d = 1 - (a + b) * x / (a + 1);
        if (Math.abs(d) < tiny) d = tiny;
        d = 1 / d;
        let h = d;

        for (let m = 1; m <= maxIterations; m++) {
            // Even step
            let m2 = 2 * m;
            let aa = m * (b - m) * x / ((a + m2 - 1) * (a + m2));

            d = 1 + aa * d;
            if (Math.abs(d) < tiny) d = tiny;
            c = 1 + aa / c;
            if (Math.abs(c) < tiny) c = tiny;
            d = 1 / d;
            h *= d * c;

            // Odd step
            aa = -(a + m) * (a + b + m) * x / ((a + m2) * (a + m2 + 1));

            d = 1 + aa * d;
            if (Math.abs(d) < tiny) d = tiny;
            c = 1 + aa / c;
            if (Math.abs(c) < tiny) c = tiny;
            d = 1 / d;
            const delta = d * c;
            h *= delta;

            if (Math.abs(delta - 1) < epsilon) break;
        }

        return front * h / a;
    }

    /**
     * Log Gamma function approximation (Lanczos approximation)
     */
    static logGamma(x) {
        const g = 7;
        const c = [
            0.99999999999980993,
            676.5203681218851,
            -1259.1392167224028,
            771.32342877765313,
            -176.61502916214059,
            12.507343278686905,
            -0.13857109526572012,
            9.9843695780195716e-6,
            1.5056327351493116e-7
        ];

        if (x < 0.5) {
            return Math.log(Math.PI / Math.sin(Math.PI * x)) - this.logGamma(1 - x);
        }

        x -= 1;
        let a = c[0];
        for (let i = 1; i < g + 2; i++) {
            a += c[i] / (x + i);
        }
        const t = x + g + 0.5;

        return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
    }

    /**
     * Tukey HSD (Honestly Significant Difference) test
     * Performs pairwise comparisons between all groups
     * @param {Object[]} groups - Array of groups, each with {name, values}
     * @param {number} msWithin - Mean Square Within from ANOVA
     * @param {number} dfWithin - Degrees of freedom within from ANOVA
     * @param {number} alpha - Significance level (default 0.05)
     * @returns {Object[]} Array of pairwise comparison results
     */
    static tukeyHSD(groups, msWithin, dfWithin, alpha = 0.05) {
        const k = groups.length;
        const results = [];

        if (k < 2 || msWithin <= 0) return results;

        // Get critical q value from Studentized Range distribution
        // This is an approximation table for common values
        const qCritical = this.getStudentizedRangeCritical(k, dfWithin, alpha);

        // Perform pairwise comparisons
        for (let i = 0; i < k; i++) {
            for (let j = i + 1; j < k; j++) {
                const group1 = groups[i];
                const group2 = groups[j];

                const mean1 = this.mean(group1.values);
                const mean2 = this.mean(group2.values);
                const meanDiff = Math.abs(mean1 - mean2);

                // Calculate harmonic mean of sample sizes for unequal groups
                const n1 = group1.values.length;
                const n2 = group2.values.length;
                const nHarmonic = (2 * n1 * n2) / (n1 + n2);

                // Standard error
                const se = Math.sqrt(msWithin / nHarmonic);

                // HSD (Honestly Significant Difference)
                const hsd = qCritical * se;

                // Q statistic for this comparison
                const qValue = meanDiff / se;

                // Determine significance level
                let significance = null;
                let pValue = this.approximateTukeyPValue(qValue, k, dfWithin);

                if (pValue < 0.001) {
                    significance = '***';
                } else if (pValue < 0.01) {
                    significance = '**';
                } else if (pValue < 0.05) {
                    significance = '*';
                }

                results.push({
                    group1: group1.name,
                    group2: group2.name,
                    mean1,
                    mean2,
                    meanDiff,
                    hsd,
                    qValue,
                    pValue,
                    significant: meanDiff > hsd,
                    significance
                });
            }
        }

        return results;
    }

    /**
     * Get critical value from Studentized Range distribution
     * Approximation for common values
     * @param {number} k - Number of groups
     * @param {number} df - Degrees of freedom
     * @param {number} alpha - Significance level
     * @returns {number} Critical q value
     */
    static getStudentizedRangeCritical(k, df, alpha = 0.05) {
        // Critical values table for alpha = 0.05
        // Rows: k (2-10), Columns: df approximation
        const qTable = {
            2: { 5: 3.64, 10: 3.15, 15: 3.01, 20: 2.95, 30: 2.89, 60: 2.83, 120: 2.80, inf: 2.77 },
            3: { 5: 4.60, 10: 4.00, 15: 3.82, 20: 3.74, 30: 3.67, 60: 3.58, 120: 3.53, inf: 3.49 },
            4: { 5: 5.22, 10: 4.55, 15: 4.33, 20: 4.23, 30: 4.14, 60: 4.04, 120: 3.98, inf: 3.93 },
            5: { 5: 5.67, 10: 4.94, 15: 4.70, 20: 4.59, 30: 4.49, 60: 4.38, 120: 4.31, inf: 4.26 },
            6: { 5: 6.03, 10: 5.24, 15: 4.98, 20: 4.86, 30: 4.76, 60: 4.64, 120: 4.57, inf: 4.51 },
            7: { 5: 6.33, 10: 5.49, 15: 5.22, 20: 5.09, 30: 4.98, 60: 4.86, 120: 4.78, inf: 4.72 },
            8: { 5: 6.58, 10: 5.70, 15: 5.41, 20: 5.28, 30: 5.16, 60: 5.04, 120: 4.96, inf: 4.89 },
            9: { 5: 6.80, 10: 5.89, 15: 5.59, 20: 5.45, 30: 5.32, 60: 5.19, 120: 5.11, inf: 5.04 },
            10: { 5: 7.00, 10: 6.05, 15: 5.74, 20: 5.60, 30: 5.47, 60: 5.33, 120: 5.25, inf: 5.17 }
        };

        // Clamp k to available range
        const kClamped = Math.min(Math.max(k, 2), 10);
        const table = qTable[kClamped];

        // Find closest df
        let qValue;
        if (df <= 5) qValue = table[5];
        else if (df <= 10) qValue = table[10];
        else if (df <= 15) qValue = table[15];
        else if (df <= 20) qValue = table[20];
        else if (df <= 30) qValue = table[30];
        else if (df <= 60) qValue = table[60];
        else if (df <= 120) qValue = table[120];
        else qValue = table.inf;

        return qValue;
    }

    /**
     * Approximate p-value for Tukey HSD test
     * Uses relationship between Studentized Range and normal distribution
     */
    static approximateTukeyPValue(q, k, df) {
        // Simple approximation using the relationship
        // P(Q > q) ≈ k * (k-1) / 2 * P(|Z| > q / sqrt(2))
        // where Z is standard normal

        // More accurate: use the F-distribution relationship
        // This is a rough approximation
        const z = q / Math.sqrt(2);
        const pNormal = 2 * (1 - this.normalCDF(z));
        const pAdjusted = Math.min(1, pNormal * k * (k - 1) / 2);

        return Math.max(0.0001, Math.min(1, pAdjusted));
    }

    /**
     * Standard normal CDF approximation
     */
    /**
     * Student's t-test (Unpaired, Two-tailed)
     * Can use either local variance (Welch/Student implies local) or pooled global variance
     * @param {Object} group1 - {name, values}
     * @param {Object} group2 - {name, values}
     * @param {Object} options - { pooledVariance: number, pooledDf: number } (Optional: from 2-way ANOVA)
     * @returns {Object} {tValue, pValue, df, significant, significance}
     */
    static tTest(group1, group2, options = {}) {
        const n1 = group1.values.length;
        const n2 = group2.values.length;

        if (n1 < 2 || n2 < 2) {
            return { tValue: 0, pValue: 1, df: 0, significant: false };
        }

        const m1 = this.mean(group1.values);
        const m2 = this.mean(group2.values);

        // Calculate t-value and df
        let tValue, df;

        if (options.pooledVariance !== undefined && options.pooledDf !== undefined) {
            // Use Global Pooled Variance (Mimics 2-way ANOVA Residuals)
            // SE = sqrt(MS_error * (1/n1 + 1/n2))
            const msError = options.pooledVariance;
            const se = Math.sqrt(msError * (1 / n1 + 1 / n2));
            tValue = Math.abs(m1 - m2) / se;
            df = options.pooledDf;
        } else {
            // Standard Unpaired t-test (Equal Variance assumption per comparison)
            const v1 = this.variance(group1.values);
            const v2 = this.variance(group2.values);
            // Pooled variance for just these 2 groups
            df = n1 + n2 - 2;
            const pooledVar = ((n1 - 1) * v1 + (n2 - 1) * v2) / df;
            const se = Math.sqrt(pooledVar * (1 / n1 + 1 / n2));
            tValue = Math.abs(m1 - m2) / se;
        }

        const pValue = this.tDistributionPValue(tValue, df);

        let significance = null;
        if (pValue < 0.0001) significance = '****';
        else if (pValue < 0.001) significance = '***';
        else if (pValue < 0.01) significance = '**';
        else if (pValue < 0.05) significance = '*';

        return {
            tValue,
            pValue,
            df,
            significant: pValue < 0.05,
            significance,
            meanDiff: m1 - m2,
            group1: group1.name,
            group2: group2.name
        };
    }

    /**
     * P-value for t-distribution (Two-tailed)
     * P(|T| > t) = I_x(df/2, 1/2) where x = df / (df + t^2)
     */
    static tDistributionPValue(t, df) {
        if (df <= 0) return 1;
        const x = df / (df + t * t);
        // regularized incomplete beta I_x(df/2, 0.5) is the two-tailed p-value
        return this.regularizedIncompleteBeta(x, df / 2, 0.5);
    }

    /**
     * Standard normal CDF approximation
     */
    static normalCDF(x) {
        const a1 = 0.254829592;
        const a2 = -0.284496736;
        const a3 = 1.421413741;
        const a4 = -1.453152027;
        const a5 = 1.061405429;
        const p = 0.3275911;

        const sign = x < 0 ? -1 : 1;
        x = Math.abs(x) / Math.sqrt(2);

        const t = 1.0 / (1.0 + p * x);
        const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

        return 0.5 * (1.0 + sign * y);
    }

    /**
     * Calculate Pooled Variance across ALL days and conditions (MS_within for 2-way ANOVA)
     */
    static calculateGlobalPooledVariance(groupedData, selectedConditions) {
        let totalSS = 0;
        let totalDf = 0;

        const allDays = new Set();
        selectedConditions.forEach(cond => {
            if (groupedData[cond]) {
                Object.keys(groupedData[cond]).forEach(day => allDays.add(day));
            }
        });

        allDays.forEach(day => {
            selectedConditions.forEach(cond => {
                const dayData = groupedData[cond]?.[day];
                if (dayData && dayData.values && dayData.values.length > 1) {
                    const values = dayData.values.map(v => v.value || v);
                    const mean = this.mean(values);
                    const ss = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0);
                    const df = values.length - 1;

                    totalSS += ss;
                    totalDf += df;
                }
            });
        });

        return totalDf > 0 ? { pooledVariance: totalSS / totalDf, pooledDf: totalDf } : null;
    }

    /**
     * Perform statistical analysis for a single day across multiple conditions
     * @param {Object} groupedData - Data grouped by condition: {conditionName: {day: {values: [...]}}}
     * @param {string[]} selectedConditions - List of selected condition names
     * @param {number} day - Day number to analyze
     * @param {Object} globalStats - { pooledVariance: number, pooledDf: number } (Optional: from 2-way ANOVA)
     * @returns {Object} {anovaResult, tukeyResults, significantPairs}
     */
    static analyzeDay(groupedData, selectedConditions, day, globalStats = null) {
        // Prepare groups for this day
        const groups = [];

        selectedConditions.forEach(condition => {
            const dayData = groupedData[condition]?.[day];
            if (dayData && dayData.values && dayData.values.length > 0) {
                groups.push({
                    name: condition,
                    values: dayData.values.map(v => v.value || v)
                });
            }
        });

        if (groups.length < 2) {
            return { anovaResult: null, tukeyResults: [], significantPairs: [] };
        }

        // Logic branching: 2 groups -> T-Test, 3+ groups -> ANOVA + Tukey
        if (groups.length === 2) {
            // Perform T-Test for 2 groups
            // Pass global pooled stats if available (mimic 2-way ANOVA)
            console.log(`[Day ${day}] Running T-Test for 2 groups (PooledVariance: ${!!globalStats})`);
            const tResult = this.tTest(groups[0], groups[1], globalStats || {});

            // Format to match ANOVA/Tukey structure
            const significantPairs = [];
            if (tResult.significant) {
                significantPairs.push({
                    group1: tResult.group1,
                    group2: tResult.group2,
                    significance: tResult.significance,
                    pValue: tResult.pValue
                });
            }

            // Pseudo-ANOVA result for display
            const anovaResult = {
                fValue: tResult.tValue * tResult.tValue, // F = t^2
                pValue: tResult.pValue,
                significant: tResult.significant,
                method: globalStats ? 'Unpaired t-test (Pooled SD)' : 'Unpaired t-test',
                df: tResult.df
            };

            return { anovaResult, tukeyResults: [], significantPairs };

        } else {
            // Perform One-way ANOVA for 3+ groups
            // Note: If we want to mimic 2-way ANOVA for 3+ groups, we should also use MS_error from globalStats
            // But OneWayANOVA implementation currently recalculates MS_within from local groups.
            // For now, we leave ANOVA as local (One-way) unless we want to rewrite ANOVA logic too.
            // But usually, user is comparing pairwise in Prism.

            console.log(`[Day ${day}] Running One-way ANOVA for ${groups.length} groups`);
            const anovaResult = this.oneWayANOVA(groups);
            anovaResult.method = 'One-way ANOVA';

            console.log(`  [ANOVA] F=${anovaResult.fValue.toFixed(3)}, p=${anovaResult.pValue.toFixed(4)}, significant=${anovaResult.significant}`);

            // If ANOVA is significant, perform Tukey HSD
            let tukeyResults = [];
            if (anovaResult.significant) {
                // Should use global MSE for Tukey too if we want full 2-way consistency
                // But Tukey method needs q-table and supports approximate.
                // We keep local Tukey for now, or update if user complains about 3+ groups.
                tukeyResults = this.tukeyHSD(groups, anovaResult.msWithin, anovaResult.dfWithin);

                // Updated Tukey significant logic
                tukeyResults.forEach(r => {
                    if (r.pValue < 0.0001) r.significance = '****';
                    else if (r.pValue < 0.001) r.significance = '***';
                    else if (r.pValue < 0.01) r.significance = '**';
                    else if (r.pValue < 0.05) r.significance = '*';
                });
            }

            // Extract significant pairs
            const significantPairs = tukeyResults
                .filter(r => r.significant)
                .map(r => ({
                    group1: r.group1,
                    group2: r.group2,
                    significance: r.significance,
                    pValue: r.pValue
                }));

            return { anovaResult, tukeyResults, significantPairs };
        }
    }

    /**
     * Analyze all days for selected conditions
     * @param {Object} groupedData - Data grouped by condition
     * @param {string[]} selectedConditions - List of selected condition names
     * @returns {Object} Analysis results by day: {day: {anovaResult, tukeyResults, significantPairs}}
     */
    static analyzeAllDays(groupedData, selectedConditions) {
        // 1. Calculate Global Pooled Variance (for 2-way ANOVA mimicry)
        const globalStats = this.calculateGlobalPooledVariance(groupedData, selectedConditions);
        if (globalStats) {
            console.log(`[GlobalStats] Pooled Variance (MS_error) = ${globalStats.pooledVariance.toFixed(4)}, df = ${globalStats.pooledDf}`);
        }

        // Find all unique days across selected conditions
        const daysSet = new Set();
        selectedConditions.forEach(condition => {
            if (groupedData[condition]) {
                Object.keys(groupedData[condition]).forEach(day => {
                    daysSet.add(parseInt(day));
                });
            }
        });

        const results = {};
        Array.from(daysSet).sort((a, b) => a - b).forEach(day => {
            // Pass globalStats to use for pooled variance in t-tests
            results[day] = this.analyzeDay(groupedData, selectedConditions, day, globalStats);
        });

        return results;
    }
}

// Export for use in other modules
window.StatisticsUtils = StatisticsUtils;
