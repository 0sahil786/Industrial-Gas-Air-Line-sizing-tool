import { CalculationResults, SystemInputs, HeaderGeometry, DropResult, SizingResultRow, SubDropResult } from '../types';

const CSV_SEPARATOR = ',';

const formatRow = (items: (string | number)[]) => {
    return items.map(item => `"${String(item).replace(/"/g, '""')}"`).join(CSV_SEPARATOR) + '\r\n';
};

export const exportResultsToCsv = (
    results: CalculationResults,
    system: SystemInputs,
    geometry: HeaderGeometry
) => {
    let csvContent = '';

    // Section: Summary
    csvContent += 'Compressed Air & Gas Network Sizer - Results Summary\r\n';
    csvContent += `Date:,"${new Date().toLocaleString()}"\r\n`;
    csvContent += '\r\n';

    const availableFlowLabel = system.gasType === 'naturalGas' ? 'Available Natural Gas Flow' : 'Available Compressor Flow';
    const availableFlowUnit = system.gasType === 'naturalGas' ? 'SCFH' : 'SCFM';
    const demandFlowUnit = system.gasType === 'naturalGas' ? 'SCFH' : 'SCFM';
    const displayMultiplier = system.gasType === 'naturalGas' ? 60 : 1;


    csvContent += 'SYSTEM & CAPACITY SUMMARY\r\n';
    csvContent += formatRow(['Parameter', 'Value', 'Unit']);
    csvContent += formatRow(['Gas Type', results.details.gas.name, '']);
    csvContent += formatRow(['Inlet Pressure', system.inletPressure, 'psig']);
    csvContent += formatRow(['Min Outlet Pressure', system.minOutletPressure, 'psig']);
    csvContent += formatRow(['Max Velocity', geometry.maxLineVelocity, 'ft/s']);
    csvContent += formatRow([availableFlowLabel, system.availableCompressorFlow, availableFlowUnit]);
    csvContent += formatRow(['Total Demand', (results.totalDemandScfm * displayMultiplier).toFixed(1), demandFlowUnit]);
    csvContent += formatRow(['Design Demand (with SF)', (results.totalDesignDemandScfm * displayMultiplier).toFixed(1), demandFlowUnit]);
    csvContent += formatRow(['Capacity Margin/Deficit', (results.capacityMarginOrDeficitScfm * displayMultiplier).toFixed(1), demandFlowUnit]);
    csvContent += formatRow(['Capacity Status', results.capacityStatus, '']);
    csvContent += '\r\n';
    
    // Section: Tank Metrics
    if (results.tankMetrics) {
        csvContent += 'RECEIVER TANK METRICS\r\n';
        csvContent += formatRow(['Parameter', 'Value', 'Unit']);
        csvContent += formatRow(['Tank Volume', system.tankVolume, 'gallons']);
        csvContent += formatRow(['Equivalent Storage', results.tankMetrics.equivalentStorageScf.toFixed(1), 'SCF']);
        csvContent += formatRow(['Reference Flow', (results.tankMetrics.referenceFlowScfm * displayMultiplier).toFixed(1), demandFlowUnit]);
        csvContent += formatRow(['Coverage Time', results.tankMetrics.coverageTimeMinutes.toFixed(2), 'minutes']);
        
        const displayTankRefFlow = results.tankMetrics.referenceFlowScfm * displayMultiplier;
        const interpretationText = results.tankMetrics.isCoveringDeficit 
            ? `Tank can cover the deficit of ${displayTankRefFlow.toFixed(1)} ${demandFlowUnit} for this duration.`
            : `Tank can supply full design demand for this duration if compressors are offline.`;
        csvContent += `Interpretation:,"${interpretationText}"\r\n`;
        csvContent += '\r\n';
    }

    // Section: Header Sizing
    if (results.header) {
        csvContent += 'HEADER SIZING RESULTS\r\n';
        csvContent += formatRow(['Recommended Size', results.header.recommendedSize, '']);
        csvContent += formatRow(['Design Flow', (results.header.designScfm * displayMultiplier).toFixed(1), demandFlowUnit]);
        csvContent += '\r\n';
        csvContent += 'Header Sizing Comparison Table\r\n';
        csvContent += formatRow(['Nominal Size', 'ID (in)', 'Velocity (ft/s)', 'Delta P (psi)', 'Outlet P (psig)', 'Status']);
        results.header.comparisonTable.forEach((row: SizingResultRow) => {
            csvContent += formatRow([row.nominal, row.id_in, row.velocity.toFixed(2), row.deltaP.toFixed(3), row.outletPressure?.toFixed(2) ?? 'N/A', row.status]);
        });
        csvContent += '\r\n';
    }

    // Section: Drops & Sub-drops
    if (results.drops.length > 0) {
        csvContent += 'DISTRIBUTION DROPS & SUB-DROPS\r\n\r\n';
        results.drops.forEach((drop: DropResult) => {
            csvContent += `DROP: ${drop.name}\r\n`;
            csvContent += formatRow(['Parameter', 'Value', 'Unit']);
            csvContent += formatRow(['Length', drop.length, 'ft']);
            csvContent += formatRow(['Required Flow', drop.reqFlow, demandFlowUnit]);
            csvContent += formatRow(['Sub-drop Total Flow', drop.subDropTotalFlow, demandFlowUnit]);
            csvContent += formatRow(['Used Flow for Sizing', drop.usedFlow, demandFlowUnit]);
            csvContent += formatRow(['Recommended Drop Size', drop.recommendedSize, '']);
            csvContent += formatRow(['Velocity @ Rec. Size', drop.velocity.toFixed(2), 'ft/s']);
            csvContent += formatRow(['Delta P @ Rec. Size', drop.deltaP.toFixed(3), 'psi']);
            csvContent += '\r\n';
            
            if (drop.subDropResults.length > 0) {
                csvContent += `SUB-DROPS for ${drop.name}\r\n`;
                csvContent += formatRow(['Sub-drop Name', 'Length (ft)', `Req. Flow (${demandFlowUnit})`, 'Rec. Size', 'Status', 'Option 1', 'Option 1 Details', 'Option 2', 'Option 2 Details', 'Option 3', 'Option 3 Details']);
                drop.subDropResults.forEach((sd: SubDropResult) => {
                    const rowData: (string | number)[] = [
                        sd.name,
                        sd.length,
                        sd.reqFlow,
                        sd.recommendedSize,
                        sd.status,
                    ];
                    // Add options data, splitting size and details
                    sd.sizingOptions.forEach(opt => {
                        rowData.push(opt.nominal);
                        rowData.push(`v:${opt.velocity.toFixed(1)} ft/s, dP:${opt.deltaP.toFixed(2)} psi`);
                    });
                    csvContent += formatRow(rowData);
                });
                 csvContent += '\r\n';
            }
        });
    }

    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `gas_network_sizing_${new Date().toISOString().slice(0,10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};