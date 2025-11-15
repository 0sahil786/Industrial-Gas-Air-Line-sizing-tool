import { SystemInputs, HeaderGeometry, PipeSize, Drop, SizingStatus, SizingResultRow, HeaderResults, DropResult, SubDropResult, CalculationResults, TankMetrics, CalculationDetails, GasType } from '../types';
import { P_ATM_PSIA, G_C_LBM_FT_LBF_S2, GALLONS_PER_FT3, GAS_PROPERTIES } from '../constants';

// Convert Fahrenheit to absolute Rankine temperature scale.
const toAbsRankine = (tempF: number) => tempF + 459.67;

/**
 * Calculates the Darcy friction factor for turbulent flow in pipes using the Swamee-Jain equation.
 * @param roughness_ft - Absolute pipe roughness in feet.
 * @param diameter_ft - Internal pipe diameter in feet.
 * @param reynoldsNumber - The Reynolds number for the flow.
 * @returns The friction factor, f.
 */
const swameeJainFrictionFactor = (roughness_ft: number, diameter_ft: number, reynoldsNumber: number): number => {
  if (reynoldsNumber <= 2300) return 64 / reynoldsNumber; // Laminar flow
  const term1 = roughness_ft / (3.7 * diameter_ft);
  const term2 = 5.74 / Math.pow(reynoldsNumber, 0.9);
  const logTerm = Math.log10(term1 + term2);
  return 0.25 / (logTerm * logTerm);
};

const calculateSeverity = (
    isOk: boolean, 
    velocity: number, maxVelocity: number, 
    deltaP: number, allowedDeltaP: number
): 'ok' | 'warn' | 'bad' => {
    if (isOk) return 'ok';
    const velocityExceededBadly = velocity > 1.5 * maxVelocity;
    const pressureExceededBadly = allowedDeltaP > 0 && deltaP > 1.5 * allowedDeltaP;
    return velocityExceededBadly || pressureExceededBadly ? 'bad' : 'warn';
};


/**
 * Generic pipe sizing function. It iterates through candidate pipe sizes to find the smallest one
 * that meets velocity and pressure drop constraints for a given flow rate.
 * All flow rates passed to this function MUST be in SCFM.
 */
const sizePipe = (
  flowScfm: number,
  length_ft: number,
  upstreamPressure_psig: number,
  requiredOutletPressure_psig: number,
  maxVelocity_fts: number,
  airTemperature_F: number,
  pipeRoughness_ft: number,
  candidatePipes: PipeSize[],
  gasType: GasType
): { table: SizingResultRow[], recommended: string, velocity: number, deltaP: number, status: SizingStatus, details: Omit<CalculationDetails['sampleDrop'], 'name' | 'q_scfm' | 'allowed_deltaP'> | null } => {
  if (flowScfm <= 0) {
    return { table: [], recommended: 'N/A (Inactive)', velocity: 0, deltaP: 0, status: 'Inactive', details: null };
  }

  const GAS = GAS_PROPERTIES[gasType];
  const t_abs_R = toAbsRankine(airTemperature_F);
  const p_in_abs_psia = upstreamPressure_psig + P_ATM_PSIA;
  
  const allowedDeltaP = Math.max(1e-6, upstreamPressure_psig - requiredOutletPressure_psig);

  const results: SizingResultRow[] = [];
  const detailsMap = new Map<string, any>();
  
  for (const pipe of candidatePipes) {
    if (!pipe.selected) continue;

    let deltaP_psi: number;
    let p_out_psig: number;
    let v_fts: number;
    let pipeDetails: any = {};

    const d_in = pipe.id_in;
    const d_ft = d_in / 12;
    const area_ft2 = (Math.PI * d_ft * d_ft) / 4;

    if (gasType === 'naturalGas') {
        // --- IFGC Code Formula for Natural Gas (e.g., IFGC 2021 402.4.1) ---
        // Q = 2207 * D^2.582 * ( (P1^2 - P2^2) / L )^0.522
        // This is rearranged to solve for P2 (outlet pressure).
        const flowScfh = flowScfm * 60;
        const p1_sq = p_in_abs_psia * p_in_abs_psia;

        // Check for zero flow to avoid division by zero
        if (flowScfh > 0) {
            const term_in_parens = flowScfh / (2207 * Math.pow(d_in, 2.582));
            const delta_p_sq = length_ft * Math.pow(term_in_parens, 1 / 0.522);
            const p2_sq = p1_sq - delta_p_sq;
            
            if (p2_sq < 0) {
                p_out_psig = -P_ATM_PSIA; // Physically impossible flow
            } else {
                p_out_psig = Math.sqrt(p2_sq) - P_ATM_PSIA;
            }
        } else {
            p_out_psig = upstreamPressure_psig; // No flow, no pressure drop
        }

        deltaP_psi = upstreamPressure_psig - p_out_psig;

        const p_out_abs_psia = p_out_psig + P_ATM_PSIA;
        const p_avg_abs_psia = (p_in_abs_psia + p_out_abs_psia) / 2;
        const q_acfm = flowScfm * (P_ATM_PSIA / p_avg_abs_psia);
        const q_cfs = q_acfm / 60;
        v_fts = q_cfs / area_ft2;
        pipeDetails = { formula: 'IFGC 402.4.1', d_ft, area_ft2, reynolds: 0, friction_factor: 0 };

    } else {
        // --- Iterative Darcy-Weisbach for Compressed Air ---
        let p_out_psig_iter = requiredOutletPressure_psig;
        let re=0, f=0;
        
        for (let i = 0; i < 5; i++) {
            const p_out_abs_iter = p_out_psig_iter + P_ATM_PSIA;
            const p_avg_abs_iter = (p_in_abs_psia + p_out_abs_iter) / 2;
            const rho_iter = (p_avg_abs_iter * 144) / (GAS.R * t_abs_R);
            const q_acfm_iter = flowScfm * (P_ATM_PSIA / p_avg_abs_iter);
            const q_cfs_iter = q_acfm_iter / 60;

            v_fts = q_cfs_iter / area_ft2;
            re = (v_fts * d_ft) / GAS.nu;
            f = swameeJainFrictionFactor(pipeRoughness_ft, d_ft, re);

            const deltaP_lbf_ft2 = f * (length_ft / d_ft) * (rho_iter * v_fts * v_fts) / (2 * G_C_LBM_FT_LBF_S2);
            deltaP_psi = deltaP_lbf_ft2 / 144;
            p_out_psig_iter = upstreamPressure_psig - deltaP_psi;
        }
        p_out_psig = p_out_psig_iter; // Final value after iterations
        pipeDetails = { formula: 'Darcy-Weisbach (Iterative)', d_ft, area_ft2, reynolds: re, friction_factor: f };
    }
    
    const velocityOk = v_fts <= maxVelocity_fts;
    const pressureOk = deltaP_psi <= allowedDeltaP;
    
    let status: SizingStatus = 'OK';
    if (!velocityOk && !pressureOk) status = 'High velocity & Excessive ΔP';
    else if (!velocityOk) status = 'High velocity';
    else if (!pressureOk) status = 'Excessive ΔP';
    
    results.push({
      nominal: pipe.nominal,
      id_in: pipe.id_in,
      velocity: v_fts,
      deltaP: deltaP_psi,
      outletPressure: null,
      status: status,
      severity: calculateSeverity(status === 'OK', v_fts, maxVelocity_fts, deltaP_psi, allowedDeltaP)
    });
    detailsMap.set(pipe.nominal, pipeDetails);
  }

  const okSizes = results.filter(r => r.status === 'OK');
  const recommendedSize = okSizes.length > 0 ? okSizes[0].nominal : 'No feasible size';
  const recommendedResult = results.find(r => r.nominal === recommendedSize) || results[0];
  const recommendedPipeDetails = detailsMap.get(recommendedSize);

  let finalDetails: Omit<CalculationDetails['sampleDrop'], 'name' | 'q_scfm' | 'allowed_deltaP'> | null = null;
    if (recommendedResult && recommendedPipeDetails) {
        const final_p_out_psig = upstreamPressure_psig - recommendedResult.deltaP;
        const final_p_out_abs = final_p_out_psig + P_ATM_PSIA;
        const final_p_avg_abs = (p_in_abs_psia + final_p_out_abs) / 2;
        const final_rho = (final_p_avg_abs * 144) / (GAS.R * t_abs_R);
        const final_q_acfm = flowScfm * (P_ATM_PSIA / final_p_avg_abs);
        const final_q_cfs = final_q_acfm / 60;

        finalDetails = {
            formula: recommendedPipeDetails.formula,
            p_avg_abs_psia: final_p_avg_abs,
            rho: final_rho,
            q_acfm: final_q_acfm,
            q_cfs: final_q_cfs,
            recommended_pipe: {
                d_ft: recommendedPipeDetails.d_ft,
                area_ft2: recommendedPipeDetails.area_ft2,
                reynolds: recommendedPipeDetails.reynolds,
                friction_factor: recommendedPipeDetails.friction_factor,
            }
        };
    }

  return {
    table: results,
    recommended: recommendedSize,
    velocity: recommendedResult?.velocity ?? 0,
    deltaP: recommendedResult?.deltaP ?? 0,
    status: recommendedResult?.status ?? 'No feasible size',
    details: finalDetails
  };
};

/**
 * Sizes the main header based on a specified design flow.
 */
const calculateHeaderSizing = (
  designScfm: number,
  system: SystemInputs,
  geometry: HeaderGeometry,
  pipes: PipeSize[]
): {results: HeaderResults | null, details: CalculationDetails['header']} => {
  const selectedPipes = pipes.filter(p => p.selected);
  if (selectedPipes.length === 0 || designScfm <= 0) return {results: null, details: null};

  const GAS = GAS_PROPERTIES[system.gasType];
  const t_abs_R = toAbsRankine(geometry.airTemperature);
  const p_in_abs_psia = system.inletPressure + P_ATM_PSIA;
  
  const comparisonTable: SizingResultRow[] = [];
  const detailsMap = new Map<string, any>();
  
  for (const pipe of selectedPipes) {
    const d_in = pipe.id_in;
    const d_ft = d_in / 12;
    const area_ft2 = (Math.PI * d_ft * d_ft) / 4;
    
    let deltaP_psi: number;
    let p_out_psig: number;
    let v_fts: number;
    let pipeDetails: any = {};

    if (system.gasType === 'naturalGas') {
        // --- IFGC Code Formula for Natural Gas ---
        const flowScfh = designScfm * 60;
        const p1_sq = p_in_abs_psia * p_in_abs_psia;
        
        if (flowScfh > 0) {
            const term_in_parens = flowScfh / (2207 * Math.pow(d_in, 2.582));
            const delta_p_sq = geometry.headerLength * Math.pow(term_in_parens, 1 / 0.522);
            const p2_sq = p1_sq - delta_p_sq;

            if (p2_sq < 0) {
                p_out_psig = -P_ATM_PSIA;
            } else {
                p_out_psig = Math.sqrt(p2_sq) - P_ATM_PSIA;
            }
        } else {
            p_out_psig = system.inletPressure;
        }

        deltaP_psi = system.inletPressure - p_out_psig;

        const p_out_abs_psia = p_out_psig + P_ATM_PSIA;
        const p_avg_abs_psia = (p_in_abs_psia + p_out_abs_psia) / 2;
        const q_acfm = designScfm * (P_ATM_PSIA / p_avg_abs_psia);
        const q_cfs = q_acfm / 60;
        v_fts = q_cfs / area_ft2;
        pipeDetails = { formula: 'IFGC 402.4.1' };
    } else {
        // --- Iterative Darcy-Weisbach for Air ---
        p_out_psig = system.inletPressure; // Initial guess
        let re=0, f=0;
        for (let iter = 0; iter < 5; iter++) {
            const p_out_abs = p_out_psig + P_ATM_PSIA;
            const p_avg_abs = (p_in_abs_psia + p_out_abs) / 2;
            const rho_iter = (p_avg_abs * 144) / (GAS.R * t_abs_R);
            const q_acfm_iter = designScfm * (P_ATM_PSIA / p_avg_abs);
            const q_cfs_iter = q_acfm_iter / 60;
            
            v_fts = q_cfs_iter / area_ft2;
            re = (v_fts * d_ft) / GAS.nu;
            f = swameeJainFrictionFactor(geometry.pipeRoughness, d_ft, re);

            const deltaP_lbf_ft2 = f * (geometry.headerLength / d_ft) * (rho_iter * v_fts * v_fts) / (2 * G_C_LBM_FT_LBF_S2);
            deltaP_psi = deltaP_lbf_ft2 / 144;
            p_out_psig = system.inletPressure - deltaP_psi;
        }
        pipeDetails = { formula: 'Darcy-Weisbach (Iterative)', re, f };
    }

    detailsMap.set(pipe.nominal, pipeDetails);
    const pressureOk = p_out_psig >= system.minOutletPressure;
    const velocityOk = v_fts <= geometry.maxLineVelocity;

    let status: SizingStatus = 'OK';
    if (!pressureOk) status = 'Insufficient outlet pressure';
    if (!velocityOk) status = 'High velocity';
    if (!pressureOk && !velocityOk) status = 'High velocity & Excessive ΔP';

    comparisonTable.push({
      nominal: pipe.nominal,
      id_in: d_in,
      velocity: v_fts,
      deltaP: deltaP_psi,
      outletPressure: p_out_psig,
      status: status,
      severity: calculateSeverity(status==='OK', v_fts, geometry.maxLineVelocity, deltaP_psi, system.inletPressure - system.minOutletPressure)
    });
  }

  const okSizes = comparisonTable.filter(r => r.status === 'OK');
  const recommendedSize = okSizes.length > 0 ? okSizes[0].nominal : 'No feasible size';
  const recommendedResult = comparisonTable.find(r => r.nominal === recommendedSize);
  
  const results: HeaderResults = {
    recommendedSize,
    outletPressure: recommendedResult?.outletPressure ?? 0,
    designScfm,
    velocity: recommendedResult?.velocity ?? 0,
    comparisonTable,
  };

  let details: CalculationDetails['header'] = null;
    if (recommendedResult) {
        const recommendedPipe = selectedPipes.find(p => p.nominal === recommendedSize);
        if (recommendedPipe) {
            const d_ft = recommendedPipe.id_in / 12;
            const area_ft2 = (Math.PI * d_ft * d_ft) / 4;
            
            const p_out_abs = recommendedResult.outletPressure + P_ATM_PSIA;
            const p_avg_abs = (p_in_abs_psia + p_out_abs) / 2;
            const rho = (p_avg_abs * 144) / (GAS.R * t_abs_R);
            const q_acfm = designScfm * (P_ATM_PSIA / p_avg_abs);
            const q_cfs = q_acfm / 60;
            
            const pipeDetails = detailsMap.get(recommendedSize) || {};
            
            details = {
                formula: pipeDetails.formula || 'N/A',
                p_avg_abs_psia: p_avg_abs,
                rho: rho,
                q_acfm: q_acfm,
                q_cfs: q_cfs,
                recommended_pipe: {
                    d_ft: d_ft,
                    area_ft2: area_ft2,
                    reynolds: pipeDetails.re || 0,
                    friction_factor: pipeDetails.f || 0,
                }
            };
        }
    }

  return {results, details};
};

/**
 * Calculates receiver tank buffer metrics.
 */
const calculateTankMetrics = (
  system: SystemInputs,
  totalDesignDemandScfm: number,
  capacityMarginOrDeficitScfm: number,
): TankMetrics | null => {
    if (system.tankVolume <= 0) return null;

    const p_in_abs_psia = system.inletPressure + P_ATM_PSIA;
    const p_min_abs_psia = system.minOutletPressure + P_ATM_PSIA;

    const v_tank_ft3 = system.tankVolume / GALLONS_PER_FT3;
    const equivalentStorageScf = v_tank_ft3 * (p_in_abs_psia - p_min_abs_psia) / P_ATM_PSIA;

    if (totalDesignDemandScfm <= 0) {
        return {
            equivalentStorageScf,
            referenceFlowScfm: 0,
            coverageTimeMinutes: Infinity,
            isCoveringDeficit: false,
        };
    }

    const isCoveringDeficit = capacityMarginOrDeficitScfm < 0;
    let referenceFlowScfm: number;
    
    if (isCoveringDeficit) { // Capacity deficit
        referenceFlowScfm = Math.abs(capacityMarginOrDeficitScfm);
    } else { // No capacity shortfall
        referenceFlowScfm = totalDesignDemandScfm;
    }
    
    const coverageTimeMinutes = (referenceFlowScfm > 0) ? (equivalentStorageScf / referenceFlowScfm) : Infinity;

    return {
        equivalentStorageScf,
        referenceFlowScfm,
        coverageTimeMinutes,
        isCoveringDeficit,
    };
};


/**
 * Sizes all distribution drops and their associated sub-drops.
 */
const calculateDropsSizing = (
  drops: Drop[],
  system: SystemInputs,
  geometry: HeaderGeometry,
  pipes: PipeSize[]
): {dropResults: DropResult[], sampleDropDetails: CalculationDetails['sampleDrop']} => {
    const selectedPipes = pipes.filter(p => p.selected);
    let sampleDropDetails: CalculationDetails['sampleDrop'] = null;
    if (selectedPipes.length === 0) return {dropResults: [], sampleDropDetails};
    
    const flowDivisor = system.gasType === 'naturalGas' ? 60 : 1;
    let firstActiveDropProcessed = false;
    
    const dropResults = drops.map((drop) => {
        const subDropTotalFlow = drop.subDrops.reduce((sum, sd) => sum + (sd.reqFlow || 0), 0);
        const usedFlow = Math.max(drop.reqFlow || 0, subDropTotalFlow);
        
        // Convert design flow from user units (SCFM or SCFH) to SCFM for calculation
        const designFlowScfm = (usedFlow * system.demandSafetyFactor) / flowDivisor;

        // Size the main drop line
        const dropSizing = sizePipe(
            designFlowScfm,
            drop.length,
            system.inletPressure,
            drop.reqPressure,
            geometry.maxLineVelocity,
            geometry.airTemperature,
            geometry.pipeRoughness,
            selectedPipes,
            system.gasType
        );

        // Capture details for the first active drop
        if (!firstActiveDropProcessed && designFlowScfm > 0) {
            if (dropSizing.details) {
              sampleDropDetails = { 
                name: drop.name, 
                ...dropSizing.details,
                q_scfm: designFlowScfm,
                allowed_deltaP: Math.max(1e-6, system.inletPressure - drop.reqPressure)
              };
            }
            firstActiveDropProcessed = true;
        }

        // Size each sub-drop connected to this drop
        const subDropResults: SubDropResult[] = drop.subDrops.map(sd => {
            // Convert design flow from user units (SCFM or SCFH) to SCFM for calculation
            const subDropDesignFlowScfm = ((sd.reqFlow || 0) * system.demandSafetyFactor) / flowDivisor;
            
            const subDropSizing = sizePipe(
                subDropDesignFlowScfm,
                sd.length,
                system.inletPressure,
                sd.reqPressure,
                geometry.maxLineVelocity,
                geometry.airTemperature,
                geometry.pipeRoughness,
                selectedPipes,
                system.gasType
            );
            
            // Logic for finding up to 3 sizing options
            const okOptions = subDropSizing.table.filter(r => r.severity === 'ok');
            let sizingOptions: SizingResultRow[];
            if (okOptions.length > 0) {
                sizingOptions = okOptions.slice(0, 3);
            } else {
                sizingOptions = subDropSizing.table.slice(0, 3);
            }

            return {
                name: sd.name,
                reqPressure: sd.reqPressure,
                reqFlow: sd.reqFlow,
                length: sd.length,
                recommendedSize: subDropSizing.recommended,
                status: subDropSizing.status,
                velocity: subDropSizing.velocity,
                deltaP: subDropSizing.deltaP,
                sizingOptions: sizingOptions
            };
        });

        return {
            id: drop.id,
            name: drop.name,
            length: drop.length,
            reqPressure: drop.reqPressure,
            reqFlow: drop.reqFlow,
            subDropTotalFlow,
            usedFlow,
            isSizedOnSubDrops: subDropTotalFlow > drop.reqFlow && drop.reqFlow >= 0,
            recommendedSize: dropSizing.recommended,
            velocity: dropSizing.velocity,
            deltaP: dropSizing.deltaP,
            comparisonTable: dropSizing.table,
            subDropResults,
        };
    });
    return {dropResults, sampleDropDetails};
};

/**
 * Main calculation orchestrator.
 */
export const performAllCalculations = (
    systemInputs: SystemInputs,
    headerGeometry: HeaderGeometry,
    candidatePipes: PipeSize[],
    drops: Drop[]
): CalculationResults => {
    
    // 0. Define conversion factors
    const gasProps = GAS_PROPERTIES[systemInputs.gasType];
    const flowDivisor = systemInputs.gasType === 'naturalGas' ? 60 : 1;
    
    // 1. Perform Sizing Calculations for all drops to determine their actual usage
    const { dropResults, sampleDropDetails } = calculateDropsSizing(drops, systemInputs, headerGeometry, candidatePipes);

    // 2. Demand Aggregation from drop results (convert from user units to SCFM)
    const totalDemandScfm = dropResults.reduce((sum, dr) => sum + (dr.usedFlow / flowDivisor), 0);
    const totalDesignDemandScfm = totalDemandScfm * systemInputs.demandSafetyFactor;

    // 3. Convert available flow to SCFM
    const availableFlowScfm = systemInputs.availableCompressorFlow / flowDivisor;
    
    // 4. Capacity Check
    let capacityStatus: CalculationResults['capacityStatus'] = 'No demand';
    let capacityMarginOrDeficitScfm = availableFlowScfm;
    
    if (totalDesignDemandScfm > 0) {
        capacityMarginOrDeficitScfm = availableFlowScfm - totalDesignDemandScfm;
        capacityStatus = capacityMarginOrDeficitScfm >= 0 ? 'OK' : 'SHORTFALL';
    }
    
    // 5. Determine Header Design Flow
    const headerDesignScfm = Math.min(availableFlowScfm, totalDesignDemandScfm);
    
    // 6. Perform Header Sizing & Tank Calculations
    const { results: headerResults, details: headerDetails } = calculateHeaderSizing(headerDesignScfm, systemInputs, headerGeometry, candidatePipes);
    const tankMetrics = calculateTankMetrics(systemInputs, totalDesignDemandScfm, capacityMarginOrDeficitScfm);
    
    return {
        totalDemandScfm,
        totalDesignDemandScfm,
        capacityStatus,
        capacityMarginOrDeficitScfm,
        headerDesignScfm,
        header: headerResults,
        drops: dropResults,
        tankMetrics: tankMetrics,
        details: {
            gas: { name: gasProps.name, R: gasProps.R, nu: gasProps.nu },
            header: headerDetails,
            sampleDrop: sampleDropDetails,
        }
    };
}