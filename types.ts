export type GasType = 'air' | 'naturalGas';

export interface SystemInputs {
  inletPressure: number;
  availableCompressorFlow: number;
  minOutletPressure: number;
  maxTypicalOutletPressure: number;
  demandSafetyFactor: number;
  tankVolume: number;
  gasType: GasType;
}

export interface HeaderGeometry {
  headerLength: number;
  maxLineVelocity: number;
  pipeRoughness: number;
  airTemperature: number;
}

export interface PipeSize {
  nominal: string;
  id_in: number;
  selected: boolean;
}

export interface SubDrop {
  id: string;
  name: string;
  length: number;
  reqPressure: number;
  reqFlow: number;
}

export interface Drop {
  id: string;
  name: string;
  length: number;
  reqPressure: number;
  reqFlow: number;
  subDrops: SubDrop[];
}

export type SizingStatus = 'OK' | 'High velocity' | 'Insufficient outlet pressure' | 'Excessive ΔP' | 'High velocity & Excessive ΔP' | 'Inactive' | 'No feasible size';

export interface SizingResultRow {
  nominal: string;
  id_in: number;
  velocity: number;
  deltaP: number;
  outletPressure: number | null; // Null for drops/sub-drops
  status: SizingStatus;
  severity?: 'ok' | 'warn' | 'bad';
}

export interface HeaderResults {
  recommendedSize: string;
  outletPressure: number;
  designScfm: number;
  velocity: number;
  comparisonTable: SizingResultRow[];
}

export interface SubDropResult {
  name: string;
  reqPressure: number;
  reqFlow: number;
  length: number;
  recommendedSize: string;
  status: SizingStatus;
  velocity: number;
  deltaP: number;
  sizingOptions: SizingResultRow[];
}

export interface DropResult {
  id: string;
  name: string;
  length: number;
  reqPressure: number;
  reqFlow: number;
  subDropTotalFlow: number;
  usedFlow: number;
  isSizedOnSubDrops: boolean;
  recommendedSize: string;
  velocity: number;
  deltaP: number;
  comparisonTable: SizingResultRow[];
  subDropResults: SubDropResult[];
}

export interface TankMetrics {
    equivalentStorageScf: number;
    referenceFlowScfm: number;
    coverageTimeMinutes: number;
    isCoveringDeficit: boolean;
}

interface CalculationDetailBlock {
    formula: string;
    p_avg_abs_psia: number;
    rho: number;
    q_acfm: number;
    q_cfs: number;
    recommended_pipe: {
        d_ft: number;
        area_ft2: number;
        reynolds: number;
        friction_factor: number;
    } | null;
}

export interface CalculationDetails {
    gas: {
        name: string;
        R: number;
        nu: number;
    };
    header: CalculationDetailBlock | null;
    sampleDrop: (CalculationDetailBlock & { name: string; q_scfm: number; allowed_deltaP: number; }) | null;
}

export interface CalculationResults {
  totalDemandScfm: number;
  totalDesignDemandScfm: number;
  capacityStatus: 'OK' | 'SHORTFALL' | 'No demand';
  capacityMarginOrDeficitScfm: number;
  headerDesignScfm: number;
  header: HeaderResults | null;
  drops: DropResult[];
  tankMetrics: TankMetrics | null;
  details: CalculationDetails;
}