import React, { useState, useMemo, FC, useCallback, useRef, useEffect } from 'react';
import { SystemInputs, HeaderGeometry, PipeSize, Drop, SubDrop, CalculationResults, SizingResultRow, DropResult, SubDropResult, SizingStatus, GasType, CalculationDetails } from './types';
import { DEFAULT_PIPE_SIZES } from './constants';
import { performAllCalculations } from './services/sizingService';
import { exportResultsToCsv } from './services/exportService';

// --- Helper & UI Components ---

const InfoIcon: FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className || "w-4 h-4"}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
    </svg>
);

const PlusIcon: FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-1">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
);

const TrashIcon: FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.134-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.067-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </svg>
);

const ExportIcon: FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
  </svg>
);

const CalculatorIcon: FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008Zm0 2.25h.008v.008H8.25V13.5Zm0 2.25h.008v.008H8.25v-.008Zm0 2.25h.008v.008H8.25V18Zm2.498-6.75h.007v.008h-.007v-.008Zm0 2.25h.007v.008h-.007V13.5Zm0 2.25h.007v.008h-.007v-.008Zm0 2.25h.007v.008h-.007V18Zm2.504-6.75h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V13.5Zm0 2.25h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V18Zm2.498-6.75h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V13.5ZM8.25 6h7.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
);


interface CardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
  headerContent?: React.ReactNode;
}
const Card: FC<CardProps> = ({ title, children, className, actions, headerContent }) => (
  <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
    <div className="flex justify-between items-center p-3 border-b border-gray-200 bg-gray-50/70 rounded-t-lg">
      <h2 className="text-md font-bold text-gray-700">{title}</h2>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
    {headerContent && <div>{headerContent}</div>}
    <div className="p-4">{children}</div>
  </div>
);

interface NumberInputProps {
  label: string;
  unit: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
}
const NumberInput: FC<NumberInputProps> = ({ label, unit, value, onChange, step = 1, min = 0 }) => (
  <div className="mb-3">
    <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
    <div className="relative">
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        onBlur={(e) => {
            const parsedValue = parseFloat(e.target.value);
            if (isNaN(parsedValue) || parsedValue < min) {
                onChange(min);
            }
        }}
        step={step}
        min={min}
        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
      />
      <span className="absolute inset-y-0 right-2 flex items-center text-xs text-gray-500">{unit}</span>
    </div>
  </div>
);

interface TextInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}
const TextInput: FC<TextInputProps> = ({ label, value, onChange, placeholder }) => (
    <div className="mb-3">
        <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
        <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
        />
    </div>
);


const getStatusColor = (status: SizingStatus) => {
    switch (status) {
        case 'OK': return 'text-green-700 bg-green-100';
        case 'High velocity': return 'text-yellow-800 bg-yellow-200';
        case 'Insufficient outlet pressure':
        case 'Excessive ΔP': return 'text-orange-700 bg-orange-100';
        case 'High velocity & Excessive ΔP': return 'text-red-700 bg-red-100';
        case 'Inactive': return 'text-gray-500 bg-gray-100';
        case 'No feasible size': return 'text-red-700 bg-red-100';
        default: return 'text-red-700 bg-red-100';
    }
};

const getSeverityBgColor = (severity?: 'ok' | 'warn' | 'bad') => {
    switch (severity) {
        case 'ok': return 'bg-white';
        case 'warn': return 'bg-yellow-50';
        case 'bad': return 'bg-red-50';
        default: return 'bg-white';
    }
};

// --- CHARTING COMPONENTS ---

interface ChartPoint {
  x: number;
  y: number;
  label: string;
  originalData: any;
}

interface LineChartProps {
    data: any[];
    xKey: string;
    yKey: string;
    title: string;
    yUnit: string;
    threshold?: { value: number; label: string; color: string };
}
const LineChart: FC<LineChartProps> = ({ data, xKey, yKey, title, yUnit, threshold }) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const [hoveredPoint, setHoveredPoint] = useState<ChartPoint | null>(null);
    const [viewBox, setViewBox] = useState({ width: 500, height: 250 });

    const padding = { top: 20, right: 20, bottom: 30, left: 50 };
    const chartWidth = viewBox.width - padding.left - padding.right;
    const chartHeight = viewBox.height - padding.top - padding.bottom;

    const yValues = data.map(d => d[yKey]);
    const yDomainMin = Math.min(0, ...yValues, threshold ? threshold.value : 0);
    const yDomainMax = Math.max(...yValues, threshold ? threshold.value : 0) * 1.1 || 10;
    
    const xScale = (index: number) => padding.left + (index / (data.length - 1)) * chartWidth;
    const yScale = (value: number) => {
        const range = yDomainMax - yDomainMin;
        if (range === 0) return padding.top + chartHeight / 2;
        return padding.top + chartHeight - ((value - yDomainMin) / range) * chartHeight;
    };

    const linePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(d[yKey])}`).join(' ');
    
    const points: ChartPoint[] = data.map((d, i) => ({
      x: xScale(i),
      y: yScale(d[yKey]),
      label: d[xKey],
      originalData: d
    }));

    const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
      if (!svgRef.current || points.length === 0) return;
      const svgPoint = svgRef.current.createSVGPoint();
      svgPoint.x = event.clientX;
      svgPoint.y = event.clientY;
      const inverted = svgPoint.matrixTransform(svgRef.current.getScreenCTM()?.inverse());
      
      const closestPoint = points.reduce((prev, curr) => 
        Math.abs(curr.x - inverted.x) < Math.abs(prev.x - inverted.x) ? curr : prev
      );
      setHoveredPoint(closestPoint);
    };

    const handleMouseLeave = () => setHoveredPoint(null);

    const yAxisTicks = useMemo(() => {
        const ticks = [];
        const tickCount = 5;
        const range = yDomainMax - yDomainMin;
        if (range <= 0) return [yDomainMin];
        const step = range / tickCount;
        for (let i = 0; i <= tickCount; i++) {
            ticks.push(yDomainMin + i * step);
        }
        return ticks;
    }, [yDomainMin, yDomainMax]);

    return (
        <div className="p-4 border-t border-gray-200">
            <h4 className="text-sm font-bold text-gray-700 mb-2">{title}</h4>
            <div className="relative">
                <svg ref={svgRef} viewBox={`0 0 ${viewBox.width} ${viewBox.height}`} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} className="w-full h-auto">
                    {/* Y Axis & Gridlines */}
                    {yAxisTicks.map((tick, i) => (
                        <g key={i}>
                            <line x1={padding.left} y1={yScale(tick)} x2={viewBox.width - padding.right} y2={yScale(tick)} stroke="#e5e7eb" strokeWidth="1" />
                            <text x={padding.left - 8} y={yScale(tick)} dy="0.32em" textAnchor="end" className="text-[10px] fill-gray-500">{tick.toFixed(1)}</text>
                        </g>
                    ))}

                    {/* X Axis */}
                    {points.map((point, i) => (
                        <text key={i} x={point.x} y={viewBox.height - padding.bottom + 15} textAnchor="middle" className="text-[10px] fill-gray-500">{point.label}</text>
                    ))}

                    {/* Threshold Line */}
                    {threshold && (
                         <g>
                            <line x1={padding.left} y1={yScale(threshold.value)} x2={viewBox.width - padding.right} y2={yScale(threshold.value)} stroke={threshold.color} strokeWidth="1.5" strokeDasharray="4 2"/>
                            <text x={viewBox.width - padding.right} y={yScale(threshold.value)} dy="-0.5em" textAnchor="end" className="text-xs font-semibold" fill={threshold.color}>{threshold.label}</text>
                        </g>
                    )}

                    {/* Data Line */}
                    <path d={linePath} fill="none" stroke="#4f46e5" strokeWidth="2" />
                    {points.map((point, i) => <circle key={i} cx={point.x} cy={point.y} r="3" fill="#4f46e5" />)}

                    {/* Hover Tracker */}
                    {hoveredPoint && (
                        <g>
                            <line x1={hoveredPoint.x} y1={padding.top} x2={hoveredPoint.x} y2={viewBox.height - padding.bottom} stroke="#9ca3af" strokeWidth="1" />
                            <circle cx={hoveredPoint.x} cy={hoveredPoint.y} r="5" fill="white" stroke="#4f46e5" strokeWidth="2" />
                        </g>
                    )}
                </svg>
                {/* Tooltip */}
                {hoveredPoint && (
                    <div className="absolute p-2 text-xs bg-gray-800 text-white rounded-md shadow-lg pointer-events-none" style={{
                      top: `${hoveredPoint.y - 10}px`, 
                      left: `${hoveredPoint.x + 10}px`,
                      transform: 'translateY(-100%)',
                    }}>
                        <div><strong>{hoveredPoint.originalData[xKey]}</strong></div>
                        <div>{`${hoveredPoint.originalData[yKey].toFixed(2)} ${yUnit}`}</div>
                    </div>
                )}
            </div>
        </div>
    );
};

interface ScatterPlotProps {
    data: any[];
    xKey: string;
    yKey: string;
    title: string;
    xLabel: string;
    yLabel: string;
    threshold?: { value: number; label: string; color: string };
}
const ScatterPlot: FC<ScatterPlotProps> = ({ data, xKey, yKey, title, xLabel, yLabel, threshold }) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const [hoveredPoint, setHoveredPoint] = useState<any | null>(null);
    const [viewBox] = useState({ width: 500, height: 300 });

    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartWidth = viewBox.width - padding.left - padding.right;
    const chartHeight = viewBox.height - padding.top - padding.bottom;
    
    const xValues = data.map(d => d[xKey]);
    const yValues = data.map(d => d[yKey]);

    const xDomainMin = 0;
    const xDomainMax = Math.max(...xValues) * 1.1 || 10;
    const yDomainMin = 0;
    const yDomainMax = Math.max(...yValues, threshold ? threshold.value : 0) * 1.1 || 10;

    const xScale = (value: number) => padding.left + ((value - xDomainMin) / (xDomainMax - xDomainMin)) * chartWidth;
    const yScale = (value: number) => padding.top + chartHeight - ((value - yDomainMin) / (yDomainMax - yDomainMin)) * chartHeight;

    const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
        if (!svgRef.current || data.length === 0) return;
        const svgPoint = svgRef.current.createSVGPoint();
        svgPoint.x = event.clientX;
        svgPoint.y = event.clientY;
        const inverted = svgPoint.matrixTransform(svgRef.current.getScreenCTM()?.inverse());
        
        let closestPoint = null;
        let minDistance = 50; // Pixel distance threshold
        for(const point of data) {
            const px = xScale(point[xKey]);
            const py = yScale(point[yKey]);
            const distance = Math.sqrt(Math.pow(px - inverted.x, 2) + Math.pow(py - inverted.y, 2));
            if (distance < minDistance) {
                minDistance = distance;
                closestPoint = point;
            }
        }
        setHoveredPoint(closestPoint);
    };
    
    const handleMouseLeave = () => setHoveredPoint(null);

    const axisTicks = (min: number, max: number, count: number) => {
        const ticks = [];
        const range = max - min;
        if (range <= 0) return [min];
        const step = range / count;
        for (let i = 0; i <= count; i++) {
            ticks.push(min + i * step);
        }
        return ticks;
    }

    const yAxisTicks = useMemo(() => axisTicks(yDomainMin, yDomainMax, 5), [yDomainMin, yDomainMax]);
    const xAxisTicks = useMemo(() => axisTicks(xDomainMin, xDomainMax, 5), [xDomainMin, xDomainMax]);

    return (
        <div className="p-4 border-t border-gray-200">
            <h4 className="text-sm font-bold text-gray-700 mb-2">{title}</h4>
            <div className="relative">
                <svg ref={svgRef} viewBox={`0 0 ${viewBox.width} ${viewBox.height}`} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} className="w-full h-auto">
                    {/* Y Axis */}
                    <text x={padding.left - 35} y={padding.top + chartHeight/2} transform={`rotate(-90, ${padding.left - 35}, ${padding.top + chartHeight/2})`} textAnchor="middle" className="text-xs fill-gray-600">{yLabel}</text>
                    {yAxisTicks.map((tick, i) => (
                        <g key={`y-${i}`}>
                            <line x1={padding.left} y1={yScale(tick)} x2={viewBox.width - padding.right} y2={yScale(tick)} stroke="#e5e7eb" strokeWidth="1" />
                            <text x={padding.left - 8} y={yScale(tick)} dy="0.32em" textAnchor="end" className="text-[10px] fill-gray-500">{tick.toFixed(1)}</text>
                        </g>
                    ))}
                    {/* X Axis */}
                    <text x={padding.left + chartWidth / 2} y={viewBox.height - 5} textAnchor="middle" className="text-xs fill-gray-600">{xLabel}</text>
                    {xAxisTicks.map((tick, i) => (
                         <g key={`x-${i}`}>
                            <text x={xScale(tick)} y={viewBox.height - padding.bottom + 15} textAnchor="middle" className="text-[10px] fill-gray-500">{tick.toFixed(1)}</text>
                        </g>
                    ))}
                    {/* Threshold Line */}
                    {threshold && (
                         <g>
                            <line x1={padding.left} y1={yScale(threshold.value)} x2={viewBox.width - padding.right} y2={yScale(threshold.value)} stroke={threshold.color} strokeWidth="1.5" strokeDasharray="4 2"/>
                            <text x={viewBox.width - padding.right} y={yScale(threshold.value)} dy="-0.5em" textAnchor="end" className="text-xs font-semibold" fill={threshold.color}>{threshold.label}</text>
                        </g>
                    )}
                    {/* Data Points */}
                    {data.map((point, i) => (
                        <circle key={i} cx={xScale(point[xKey])} cy={yScale(point[yKey])} r={hoveredPoint === point ? 6 : 4} 
                          className={`transition-all duration-150 ${point.type === 'Sub-Drop' ? 'fill-indigo-400' : 'fill-indigo-600'}`} 
                          stroke="white" strokeWidth="1"/>
                    ))}
                </svg>
                 {/* Tooltip */}
                {hoveredPoint && (
                    <div className="absolute p-2 text-xs bg-gray-800 text-white rounded-md shadow-lg pointer-events-none" style={{
                      top: `${yScale(hoveredPoint[yKey])}px`, 
                      left: `${xScale(hoveredPoint[xKey])}px`,
                      transform: 'translate(10px, -110%)',
                    }}>
                        <div className="font-bold border-b border-gray-600 pb-1 mb-1">{hoveredPoint.name} <span className="font-normal text-gray-300">({hoveredPoint.type})</span></div>
                        <div>{xLabel}: {hoveredPoint[xKey].toFixed(1)}</div>
                        <div>{yLabel}: {hoveredPoint[yKey].toFixed(2)}</div>
                        {hoveredPoint.velocity !== undefined && <div>Velocity: {hoveredPoint.velocity.toFixed(1)} ft/s</div>}
                        {hoveredPoint.deltaP !== undefined && <div>ΔP: {hoveredPoint.deltaP.toFixed(2)} psi</div>}
                        <div>Rec. Size: {hoveredPoint.recommendedSize}</div>
                    </div>
                )}
            </div>
        </div>
    )
}


// --- Calculation Details Modal ---
interface CalculationDetailsModalProps {
    details: CalculationDetails | null;
    onClose: () => void;
}
const CalculationDetailsModal: FC<CalculationDetailsModalProps> = ({ details, onClose }) => {
    if (!details) return null;

    const renderHeaderDetails = () => {
        if (!details.header) return <p className="text-sm text-gray-500">Header calculations not available (no design flow).</p>;
        const { formula, p_avg_abs_psia, rho, q_acfm, q_cfs, recommended_pipe } = details.header;
        const isAir = details.gas.name.includes('Air');
        return (
            <div>
                <h4 className="font-semibold text-gray-800">1. Header Sizing</h4>
                <p className='font-bold text-indigo-700 mb-1'>Formula Used: {formula}</p>
                <p><code>P_avg_abs = {p_avg_abs_psia.toFixed(1)} psia</code></p>
                <p><code>Q_acfm = Q_scfm * (P_atm / P_avg_abs) = {q_acfm.toFixed(1)} ACFM</code></p>
                <p><code>Q_cfs = Q_acfm / 60 = {q_cfs.toFixed(2)} ft³/s</code></p>
                {isAir && <p><code>ρ = (P_avg_abs * 144) / (R * T_abs) = {rho.toFixed(4)} lbm/ft³</code></p>}
                {recommended_pipe && isAir && (
                    <div className="mt-2 pt-2 border-t">
                        <p className="font-semibold">For Recommended Pipe (Darcy-Weisbach):</p>
                        <p><code>v = Q_cfs / Area = {recommended_pipe.area_ft2 > 0 ? (q_cfs/recommended_pipe.area_ft2).toFixed(1) : '0'} ft/s</code></p>
                        <p><code>Re = v * D / ν = {recommended_pipe.reynolds.toExponential(2)}</code></p>
                        <p><code>f = 0.25 / [log10(...)]² = {recommended_pipe.friction_factor.toFixed(4)}</code> (Swamee-Jain)</p>
                    </div>
                )}
            </div>
        );
    };

    const renderDropDetails = () => {
        if (!details.sampleDrop) return <p className="text-sm text-gray-500 mt-4">No active drops to detail.</p>;
        const { name, formula, p_avg_abs_psia, rho, q_acfm, q_cfs, allowed_deltaP, recommended_pipe } = details.sampleDrop;
        const isAir = details.gas.name.includes('Air');
        return (
             <div className="mt-4">
                <h4 className="font-semibold text-gray-800">2. Sample Drop Sizing ({name})</h4>
                <p className='font-bold text-indigo-700 mb-1'>Formula Used: {formula}</p>
                <p><code>P_avg_abs = {p_avg_abs_psia.toFixed(1)} psia</code></p>
                <p><code>Q_acfm = Q_scfm * (P_atm / P_avg_abs) = {q_acfm.toFixed(1)} ACFM</code></p>
                <p><code>ΔP_allowed = P_in - P_req = {allowed_deltaP.toFixed(2)} psi</code></p>
                 {isAir && <p><code>ρ = (P_avg_abs * 144) / (R * T_abs) = {rho.toFixed(4)} lbm/ft³</code></p>}
                 {recommended_pipe && isAir && (
                    <div className="mt-2 pt-2 border-t">
                        <p className="font-semibold">For Recommended Pipe (Darcy-Weisbach):</p>
                        <p><code>v = Q_cfs / Area = {recommended_pipe.area_ft2 > 0 ? (q_cfs/recommended_pipe.area_ft2).toFixed(1) : '0'} ft/s</code></p>
                        <p><code>Re = v * D / ν = {recommended_pipe.reynolds.toExponential(2)}</code></p>
                        <p><code>f = {recommended_pipe.friction_factor.toFixed(4)}</code> (Swamee-Jain)</p>
                    </div>
                )}
            </div>
        )
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b sticky top-0 bg-white">
                    <h3 className="text-lg font-bold text-gray-800">Calculation Details</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl font-bold">&times;</button>
                </div>
                <div className="p-4 text-xs font-mono text-gray-700 space-y-2">
                    <h4 className="font-semibold text-gray-800 text-sm">Gas Properties ({details.gas.name})</h4>
                    <p><code>Gas Constant (R) = {details.gas.R} ft·lbf/(lbm·°R)</code></p>
                    <p><code>Kinematic Viscosity (ν) = {details.gas.nu.toExponential(2)} ft²/s</code></p>
                    <hr className="my-4" />
                    {renderHeaderDetails()}
                    <hr className="my-4" />
                    {renderDropDetails()}
                </div>
                 <div className="p-4 border-t bg-gray-50 text-right">
                    <button onClick={onClose} className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-md hover:bg-indigo-700">Close</button>
                </div>
            </div>
        </div>
    );
};

// --- Main App Component ---

const App: FC = () => {
  const [systemInputs, setSystemInputs] = useState<SystemInputs>({
    inletPressure: 130,
    availableCompressorFlow: 500,
    minOutletPressure: 90,
    maxTypicalOutletPressure: 110,
    demandSafetyFactor: 1.2,
    tankVolume: 0,
    gasType: 'air',
  });

  const [headerGeometry, setHeaderGeometry] = useState<HeaderGeometry>({
    headerLength: 1000,
    maxLineVelocity: 50,
    pipeRoughness: 0.00015,
    airTemperature: 70,
  });

  const [candidatePipes, setCandidatePipes] = useState<PipeSize[]>(DEFAULT_PIPE_SIZES);
  const [drops, setDrops] = useState<Drop[]>([]);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'summary' | 'charts'>('summary');

  const handleSystemInputChange = <K extends keyof SystemInputs>(key: K, value: SystemInputs[K]) => {
    setSystemInputs(prev => ({ ...prev, [key]: value }));
  };

  const handleHeaderGeometryChange = <K extends keyof HeaderGeometry>(key: K, value: HeaderGeometry[K]) => {
    setHeaderGeometry(prev => ({ ...prev, [key]: value }));
  };

  const togglePipeSelection = (nominal: string) => {
    setCandidatePipes(pipes =>
      pipes.map(p => (p.nominal === nominal ? { ...p, selected: !p.selected } : p))
    );
  };
  
  const handleAddDrop = () => {
    const newDrop: Drop = {
      id: `drop-${Date.now()}`,
      name: `Drop ${drops.length + 1}`,
      length: 100,
      reqPressure: 95,
      reqFlow: 100,
      subDrops: [],
    };
    setDrops(prev => [...prev, newDrop]);
  };
  
  const handleRemoveDrop = (id: string) => {
    setDrops(prev => prev.filter(d => d.id !== id));
  };

  const handleDropChange = (id: string, field: keyof Omit<Drop, 'id' | 'subDrops'>, value: string | number) => {
    setDrops(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d));
  };

  const handleAddSubDrop = (dropId: string) => {
    setDrops(prev => prev.map(d => {
      if (d.id === dropId) {
        const newSubDrop: SubDrop = {
          id: `subdrop-${Date.now()}`,
          name: `Sub-drop ${d.subDrops.length + 1}`,
          length: 40,
          reqPressure: 90,
          reqFlow: 20,
        };
        return { ...d, subDrops: [...d.subDrops, newSubDrop] };
      }
      return d;
    }));
  };

  const handleRemoveSubDrop = (dropId: string, subDropId: string) => {
    setDrops(prev => prev.map(d => 
        d.id === dropId ? { ...d, subDrops: d.subDrops.filter(sd => sd.id !== subDropId) } : d
    ));
  };

  const handleSubDropChange = (dropId: string, subDropId: string, field: keyof Omit<SubDrop, 'id'>, value: string | number) => {
    setDrops(prev => prev.map(d =>
      d.id === dropId
        ? { ...d, subDrops: d.subDrops.map(sd => sd.id === subDropId ? { ...sd, [field]: value } : sd) }
        : d
    ));
  };

  const calculationResults: CalculationResults = useMemo(() => {
    return performAllCalculations(systemInputs, headerGeometry, candidatePipes, drops);
  }, [systemInputs, headerGeometry, candidatePipes, drops]);

  const handleExport = () => {
    exportResultsToCsv(calculationResults, systemInputs, headerGeometry);
  };

  const availableFlowLabel = systemInputs.gasType === 'naturalGas' 
    ? 'Available natural gas flow, Q_avail' 
    : 'Available compressor flow, Q_avail';
  const availableFlowUnit = systemInputs.gasType === 'naturalGas' ? 'SCFH' : 'SCFM';
  const demandFlowUnit = systemInputs.gasType === 'naturalGas' ? 'SCFH' : 'SCFM';

  // --- RESULT DISPLAY COMPONENTS ---
  
  const renderCharts = () => {
    const { header, drops } = calculationResults;
    const displayMultiplier = systemInputs.gasType === 'naturalGas' ? 60 : 1;
    const displayUnit = systemInputs.gasType === 'naturalGas' ? 'SCFH' : 'SCFM';
    
    if (!header && drops.length === 0) {
        return <div className="p-4 text-center text-gray-500">No data available to display charts. Please add drops to begin.</div>;
    }

    const allDistributionPoints = [
        ...drops.map(d => ({
            name: d.name,
            type: 'Drop',
            designFlow: d.usedFlow * systemInputs.demandSafetyFactor * displayMultiplier,
            velocity: d.velocity,
            deltaP: d.deltaP,
            recommendedSize: d.recommendedSize
        })),
        ...drops.flatMap(d => d.subDropResults.map(sd => ({
            name: sd.name,
            type: 'Sub-Drop',
            designFlow: sd.reqFlow * systemInputs.demandSafetyFactor * displayMultiplier,
            velocity: sd.velocity,
            deltaP: sd.deltaP,
            recommendedSize: sd.recommendedSize
        })))
    ].filter(p => isFinite(p.designFlow) && isFinite(p.velocity) && isFinite(p.deltaP));
    
    // Filter out rows with non-finite values for charting
    const chartableHeaderData = header?.comparisonTable.filter(row => isFinite(row.velocity) && isFinite(row.deltaP) && row.outletPressure !== null && isFinite(row.outletPressure)) || [];

    return (
        <div className="bg-white rounded-b-lg">
            {header && chartableHeaderData.length > 0 && (
                <>
                    <LineChart
                        title="Header Velocity vs. Pipe Size"
                        data={chartableHeaderData}
                        xKey="nominal"
                        yKey="velocity"
                        yUnit="ft/s"
                        threshold={{ value: headerGeometry.maxLineVelocity, label: 'Max', color: '#ef4444' }}
                    />
                    <LineChart
                        title="Header Pressure Drop (ΔP) vs. Pipe Size"
                        data={chartableHeaderData}
                        xKey="nominal"
                        yKey="deltaP"
                        yUnit="psi"
                    />
                    <LineChart
                        title="Header Outlet Pressure vs. Pipe Size"
                        data={chartableHeaderData}
                        xKey="nominal"
                        yKey="outletPressure"
                        yUnit="psig"
                        threshold={{ value: systemInputs.minOutletPressure, label: 'Min', color: '#f97316' }}
                    />
                </>
            )}
            {allDistributionPoints.length > 0 && (
              <>
                <ScatterPlot 
                  title="Distribution Performance: Pressure Drop vs. Design Flow"
                  data={allDistributionPoints}
                  xKey="designFlow"
                  yKey="deltaP"
                  xLabel={`Design Flow (${displayUnit})`}
                  yLabel="Pressure Drop (psi)"
                />
                <ScatterPlot 
                  title="Distribution Performance: Velocity vs. Design Flow"
                  data={allDistributionPoints}
                  xKey="designFlow"
                  yKey="velocity"
                  xLabel={`Design Flow (${displayUnit})`}
                  yLabel="Velocity (ft/s)"
                  threshold={{ value: headerGeometry.maxLineVelocity, label: 'Max Velocity', color: '#ef4444' }}
                />
              </>
            )}
        </div>
    );
  };

  const renderSummary = () => {
    const { 
      capacityStatus, capacityMarginOrDeficitScfm, totalDemandScfm, totalDesignDemandScfm, header, drops: dropResults, tankMetrics 
    } = calculationResults;
    
    const displayMultiplier = systemInputs.gasType === 'naturalGas' ? 60 : 1;
    const displayUnit = systemInputs.gasType === 'naturalGas' ? 'SCFH' : 'SCFM';
    
    const displayTotalDemand = totalDemandScfm * displayMultiplier;
    const displayDesignDemand = totalDesignDemandScfm * displayMultiplier;
    const displayMarginOrDeficit = capacityMarginOrDeficitScfm * displayMultiplier;

    let capacityPill, capacityText;
    if (capacityStatus === 'No demand') {
        capacityPill = 'bg-gray-200 text-gray-700';
        capacityText = 'No active demand – define at least one drop.';
    } else if (capacityStatus === 'OK') {
        capacityPill = 'bg-green-100 text-green-800 border border-green-200';
        capacityText = `Capacity OK: margin ${displayMarginOrDeficit.toFixed(1)} ${displayUnit}`;
    } else {
        capacityPill = 'bg-red-100 text-red-800 border border-red-200';
        capacityText = `CAPACITY SHORTFALL: deficit ${Math.abs(displayMarginOrDeficit).toFixed(1)} ${displayUnit}`;
    }

    return (
        <div className="bg-white rounded-b-lg">
        {/* Capacity Summary */}
        <div className="p-4 border-b border-gray-200">
            <div className={`text-sm font-bold p-2 text-center rounded-md mb-3 ${capacityPill}`}>{capacityText}</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Q_avail:</span><span className="font-semibold">{systemInputs.availableCompressorFlow} {availableFlowUnit}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Total Demand:</span><span className="font-semibold">{displayTotalDemand.toFixed(1)} {displayUnit}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Design Demand:</span><span className="font-semibold">{displayDesignDemand.toFixed(1)} {displayUnit}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Margin/Deficit:</span><span className="font-semibold">{displayMarginOrDeficit.toFixed(1)} {displayUnit}</span></div>
            </div>
        </div>

        {/* Header Sizing */}
        {header && (
            <div className="p-4 border-b border-gray-200">
                <h3 className="text-base font-bold text-gray-700 mb-2">Header Summary</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-sm mb-3">
                    <div className="flex justify-between"><span className="text-gray-500">Rec. Size:</span><span className="font-bold text-indigo-600">{header.recommendedSize}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Outlet P:</span><span className="font-semibold">{header.outletPressure.toFixed(1)} psig</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Velocity:</span><span className="font-semibold">{header.velocity.toFixed(1)} ft/s</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Design Flow:</span><span className="font-semibold">{(header.designScfm * displayMultiplier).toFixed(1)} {displayUnit}</span></div>
                </div>
                 <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left text-gray-600">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                            <tr>
                                <th scope="col" className="px-3 py-2">Nominal Size</th>
                                <th scope="col" className="px-3 py-2">Velocity (ft/s)</th>
                                <th scope="col" className="px-3 py-2">ΔP (psi)</th>
                                <th scope="col" className="px-3 py-2">P_out (psig)</th>
                                <th scope="col" className="px-3 py-2">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {header.comparisonTable.map((row: SizingResultRow) => (
                                <tr key={row.nominal} className={`border-b ${row.nominal === header.recommendedSize ? 'bg-indigo-50 font-semibold' : getSeverityBgColor(row.severity)}`}>
                                    <td className="px-3 py-2">{row.nominal}</td>
                                    <td className="px-3 py-2">{row.velocity.toFixed(1)}</td>
                                    <td className="px-3 py-2">{row.deltaP.toFixed(2)}</td>
                                    <td className="px-3 py-2">{row.outletPressure !== null ? row.outletPressure.toFixed(1) : 'N/A'}</td>
                                    <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(row.status)}`}>{row.status}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                 </div>
            </div>
        )}
        
        {/* Tank Metrics */}
        {tankMetrics && (
            <div className="p-4 border-b border-gray-200">
                <h3 className="text-base font-bold text-gray-700 mb-2">Receiver / Tank Metrics</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-sm mb-2">
                    <div className="flex justify-between"><span className="text-gray-500">Equiv. Storage:</span><span className="font-semibold">{tankMetrics.equivalentStorageScf.toFixed(0)} SCF</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Reference Flow:</span><span className="font-semibold">{(tankMetrics.referenceFlowScfm * displayMultiplier).toFixed(1)} {displayUnit}</span></div>
                    <div className="flex justify-between items-baseline"><span className="text-gray-500">Coverage:</span><span className="font-bold text-lg">{tankMetrics.coverageTimeMinutes.toFixed(1)} min</span></div>
                </div>
                <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded-md">
                    {tankMetrics.isCoveringDeficit
                        ? `Tank can cover the deficit of ${(tankMetrics.referenceFlowScfm * displayMultiplier).toFixed(1)} ${displayUnit} for this duration.`
                        : `Tank can supply full design demand for this duration if compressors are offline.`
                    }
                </p>
            </div>
        )}

        {/* Drops and Sub-drops */}
        {dropResults.length > 0 && (
             <div className="p-4">
                <h3 className="text-base font-bold text-gray-700 mb-3">Distribution Drops & Sub-drops</h3>
                <div className="space-y-4">
                  {dropResults.map((drop: DropResult) => (
                    <div key={drop.id} className="border border-gray-200 rounded-lg p-3 bg-white">
                        <h4 className="font-bold text-sm text-gray-800 mb-2">{drop.name}</h4>
                        {drop.isSizedOnSubDrops && <div className="text-xs flex items-start gap-2 bg-yellow-100 text-yellow-800 p-2 rounded-md mb-2 border border-yellow-200">
                          <InfoIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold">Sizing Alert:</span> Sub-drop demand ({drop.subDropTotalFlow.toFixed(0)} {demandFlowUnit}) exceeds this drop's requirement ({drop.reqFlow} {demandFlowUnit}). The main drop line has been sized for the higher flow. 
                            <span className="block mt-1 font-semibold">Recommendation: Consider updating this drop's 'Req. Flow' to {drop.subDropTotalFlow.toFixed(0)} for design clarity.</span>
                          </div>
                          </div>}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3 text-xs text-center">
                            <div className="bg-indigo-50 p-2 rounded"><div className="text-indigo-800 font-semibold">Rec. Size</div><div className="text-base font-bold text-indigo-900">{drop.recommendedSize}</div></div>
                            <div className="bg-gray-50 p-2 rounded"><div className="text-gray-600">Velocity</div><div className="text-sm font-semibold text-gray-800">{drop.velocity.toFixed(1)} ft/s</div></div>
                            <div className="bg-gray-50 p-2 rounded"><div className="text-gray-600">Pressure Drop</div><div className="text-sm font-semibold text-gray-800">{drop.deltaP.toFixed(2)} psi</div></div>
                            <div className="bg-gray-50 p-2 rounded"><div className="text-gray-600">Design Flow</div><div className="text-sm font-semibold text-gray-800">{(drop.usedFlow * systemInputs.demandSafetyFactor).toFixed(1)} {demandFlowUnit}</div></div>
                        </div>

                        {drop.subDropResults.length > 0 && (
                             <div className="mt-3">
                                {drop.subDropResults.map((sd: SubDropResult, index: number) => (
                                <div key={index} className="border-t pt-2 mt-2">
                                    <p className="font-semibold text-xs text-gray-700 mb-1">{sd.name} (Flow: {sd.reqFlow} {demandFlowUnit}, Length: {sd.length} ft)</p>
                                    <div className="flex flex-wrap gap-2 items-start">
                                        <div className="bg-gray-100 border border-gray-200 rounded p-2 flex-shrink-0">
                                            <div className="text-xs text-gray-600 text-center">Primary Rec.</div>
                                            <div className="text-sm font-bold text-center">{sd.recommendedSize}</div>
                                            <div className={`px-1 text-center mt-1 rounded text-xs ${getStatusColor(sd.status)}`}>{sd.status}</div>
                                        </div>
                                        <div className="flex-grow">
                                            <div className="text-xs text-gray-600 mb-1">Sizing Options:</div>
                                            <div className="flex flex-wrap gap-2">
                                                {sd.sizingOptions.length > 0 ? sd.sizingOptions.map(opt => (
                                                    <div key={opt.nominal} className={`p-1.5 border rounded ${opt.severity === 'ok' ? 'border-green-200 bg-green-50' : opt.severity === 'warn' ? 'border-yellow-200 bg-yellow-50' : 'border-red-200 bg-red-50'}`}>
                                                        <div className="font-bold text-xs">{opt.nominal}</div>
                                                        <div className="text-xs text-gray-600">v: {opt.velocity.toFixed(1)} ft/s</div>
                                                        <div className="text-xs text-gray-600">ΔP: {opt.deltaP.toFixed(2)} psi</div>
                                                    </div>
                                                )) : <span className="text-xs text-gray-500">No options meet criteria.</span>}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                ))}
                            </div>
                        )}
                    </div>
                  ))}
                </div>
             </div>
        )}
        </div>
    );
  };


  return (
    <div className="min-h-screen bg-gray-50 font-sans p-4 sm:p-6 text-gray-800">
      <header className="mb-6 text-center">
        <h1 className="text-3xl font-bold text-gray-800">Compressed Air & Gas Network Sizer</h1>
        <p className="text-gray-600 text-sm mt-1">A capacity-driven tool for validating and sizing gas distribution networks.</p>
      </header>

      <div className="container mx-auto max-w-screen-2xl">
        <div className="flex flex-col lg:flex-row gap-6">
          
          {/* --- INPUTS PANEL --- */}
          <div className="w-full lg:w-2/5 xl:w-1/3 flex-shrink-0 space-y-4">
            <Card title="System Requirements">
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-600 mb-1">Gas Type</label>
                <div className="flex gap-2 rounded-md bg-gray-100 p-1">
                  <button onClick={() => handleSystemInputChange('gasType', 'air')} className={`w-full text-sm py-1 rounded-md transition-colors ${systemInputs.gasType === 'air' ? 'bg-white shadow-sm font-semibold text-indigo-600' : 'text-gray-600 hover:bg-gray-200'}`}>
                    Compressed Air
                  </button>
                  <button onClick={() => handleSystemInputChange('gasType', 'naturalGas')} className={`w-full text-sm py-1 rounded-md transition-colors ${systemInputs.gasType === 'naturalGas' ? 'bg-white shadow-sm font-semibold text-indigo-600' : 'text-gray-600 hover:bg-gray-200'}`}>
                    Natural Gas
                  </button>
                </div>
              </div>
              <NumberInput label="Inlet pressure @ header, P_in" unit="psig" value={systemInputs.inletPressure} onChange={val => handleSystemInputChange('inletPressure', val)} />
              <NumberInput label={availableFlowLabel} unit={availableFlowUnit} value={systemInputs.availableCompressorFlow} onChange={val => handleSystemInputChange('availableCompressorFlow', val)} />
              <NumberInput label="Minimum required outlet pressure, P_out_min" unit="psig" value={systemInputs.minOutletPressure} onChange={val => handleSystemInputChange('minOutletPressure', val)} />
              <NumberInput label="Safety factor on demand, SF_demand" unit="" value={systemInputs.demandSafetyFactor} onChange={val => handleSystemInputChange('demandSafetyFactor', val)} step={0.05} min={1} />
              <NumberInput label="Dry receiver tank volume, V_tank" unit="gallons" value={systemInputs.tankVolume} onChange={val => handleSystemInputChange('tankVolume', val)} />
            </Card>

            <Card title="Header Geometry & Pipe Settings">
              <NumberInput label="Header equivalent length, L_header" unit="ft" value={headerGeometry.headerLength} onChange={val => handleHeaderGeometryChange('headerLength', val)} />
              <NumberInput label="Max allowable line velocity, v_max" unit="ft/s" value={headerGeometry.maxLineVelocity} onChange={val => handleHeaderGeometryChange('maxLineVelocity', val)} />
              <NumberInput label="Pipe roughness, ε" unit="ft" value={headerGeometry.pipeRoughness} onChange={val => handleHeaderGeometryChange('pipeRoughness', val)} step={0.00001} />
              <NumberInput label="Gas temperature, T" unit="°F" value={headerGeometry.airTemperature} onChange={val => handleHeaderGeometryChange('airTemperature', val)} />
            </Card>

            <Card title="Candidate Pipe Sizes">
                 <div className="grid grid-cols-3 gap-x-2 gap-y-1">
                  {candidatePipes.map(pipe => (
                    <label key={pipe.nominal} className="flex items-center space-x-2 text-sm">
                      <input type="checkbox" checked={pipe.selected} onChange={() => togglePipeSelection(pipe.nominal)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                      <span>{pipe.nominal}</span>
                    </label>
                  ))}
                </div>
            </Card>

            <Card title="Distribution Legs / Drops">
                <div className="space-y-3">
                    {drops.map((drop, dropIndex) => (
                        <div key={drop.id} className="border border-gray-200 rounded-lg bg-white">
                                <div className="p-3 space-y-3">
                                    <div className="flex justify-between items-center">
                                      <TextInput label="Drop Name" value={drop.name} onChange={val => handleDropChange(drop.id, 'name', val)} />
                                      <button onClick={() => handleRemoveDrop(drop.id)} className="p-2 text-red-500 hover:bg-red-100 rounded-full mt-3 ml-2"><TrashIcon/></button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <NumberInput label="Length" unit="ft" value={drop.length} onChange={val => handleDropChange(drop.id, 'length', val)} />
                                        <NumberInput label="Req. Flow" unit={demandFlowUnit} value={drop.reqFlow} onChange={val => handleDropChange(drop.id, 'reqFlow', val)} />
                                    </div>
                                    <NumberInput label="Req. Outlet Pressure" unit="psig" value={drop.reqPressure} onChange={val => handleDropChange(drop.id, 'reqPressure', val)} />

                                    <div className="pt-2 border-t mt-3">
                                        <h4 className="font-semibold text-xs text-gray-600 mb-2">Sub-drops for this leg</h4>
                                        <div className="space-y-2">
                                            {drop.subDrops.map((sd, sdIndex) => (
                                                <div key={sd.id} className="p-2 bg-gray-50 rounded-md border">
                                                    <div className="flex justify-between items-center mb-1">
                                                      <p className="font-medium text-xs text-gray-700">{sd.name || `Sub-drop ${sdIndex + 1}`}</p>
                                                      <button onClick={() => handleRemoveSubDrop(drop.id, sd.id)} className="p-1 text-red-500 hover:bg-red-100 rounded-full"><TrashIcon/></button>
                                                    </div>
                                                    <TextInput label="Name" value={sd.name} onChange={val => handleSubDropChange(drop.id, sd.id, 'name', val)} />
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <NumberInput label="Length" unit="ft" value={sd.length} onChange={val => handleSubDropChange(drop.id, sd.id, 'length', val)} />
                                                        <NumberInput label="Req. Flow" unit={demandFlowUnit} value={sd.reqFlow} onChange={val => handleSubDropChange(drop.id, sd.id, 'reqFlow', val)} />
                                                    </div>
                                                    <NumberInput label="Req. Outlet Pressure" unit="psig" value={sd.reqPressure} onChange={val => handleSubDropChange(drop.id, sd.id, 'reqPressure', val)} />
                                                </div>
                                            ))}
                                        </div>
                                        <button onClick={() => handleAddSubDrop(drop.id)} className="mt-2 w-full flex items-center justify-center px-3 py-1.5 border border-dashed border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                                            <PlusIcon/> Add Sub-drop
                                        </button>
                                    </div>
                                </div>
                        </div>
                    ))}
                </div>
                <button onClick={handleAddDrop} className="mt-3 w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                    <PlusIcon/> Add Drop
                </button>
            </Card>

          </div>

          {/* --- RESULTS PANEL --- */}
          <div className="w-full lg:w-3/5 xl:w-2/3">
              <Card 
                title="Results" 
                className="sticky top-6 bg-white"
                headerContent={
                    <div className="flex justify-between items-center border-b border-gray-200 px-3">
                        <div className="flex">
                            <button onClick={() => setActiveTab('summary')} className={`-mb-px px-4 py-2 text-sm font-semibold border-b-2 ${activeTab === 'summary' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                                Summary
                            </button>
                            <button onClick={() => setActiveTab('charts')} className={`-mb-px px-4 py-2 text-sm font-semibold border-b-2 ${activeTab === 'charts' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                                Charts
                            </button>
                        </div>
                        <div className="flex items-center gap-2 py-2">
                             <button onClick={() => setIsDetailsModalOpen(true)} className="flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                                <CalculatorIcon /> Calculation Details
                            </button>
                            <button onClick={handleExport} className="flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                                <ExportIcon /> Export CSV
                            </button>
                        </div>
                    </div>
                }
              >
               {activeTab === 'summary' ? renderSummary() : renderCharts()}
              </Card>
          </div>
        </div>
      </div>
      {isDetailsModalOpen && <CalculationDetailsModal details={calculationResults.details} onClose={() => setIsDetailsModalOpen(false)} />}
    </div>
  );
};

export default App;
