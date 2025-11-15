import { PipeSize, GasType } from './types';

// Physical Constants
export const P_ATM_PSIA = 14.7;
export const G_C_LBM_FT_LBF_S2 = 32.174;
export const GALLONS_PER_FT3 = 7.48;

// Gas-specific properties
interface GasProperties {
  R: number; // Gas Constant in ft·lbf/(lbm·°R)
  nu: number; // Kinematic Viscosity in ft²/s
  name: string;
}

export const GAS_PROPERTIES: Record<GasType, GasProperties> = {
  air: {
    R: 53.35,
    nu: 1.6e-4, // at 70F
    name: 'Compressed Air',
  },
  naturalGas: {
    R: 96.5, // Approx. for SG 0.6
    nu: 1.72e-4, // at 70F
    name: 'Natural Gas (SG 0.6)',
  },
};

// Default Candidate Pipe Sizes (Nominal and Internal Diameter in inches)
// Using Schedule 40 ID for common sizes.
export const DEFAULT_PIPE_SIZES: PipeSize[] = [
  { nominal: '1/4"', id_in: 0.364, selected: true },
  { nominal: '1/2"', id_in: 0.622, selected: true },
  { nominal: '3/4"', id_in: 0.824, selected: true },
  { nominal: '1"', id_in: 1.049, selected: true },
  { nominal: '1-1/4"', id_in: 1.380, selected: true },
  { nominal: '1-1/2"', id_in: 1.610, selected: true },
  { nominal: '2"', id_in: 2.067, selected: true },
  { nominal: '2-1/2"', id_in: 2.469, selected: true },
  { nominal: '3"', id_in: 3.068, selected: true },
  { nominal: '4"', id_in: 4.026, selected: true },
  { nominal: '5"', id_in: 5.047, selected: true },
  { nominal: '6"', id_in: 6.065, selected: true },
];