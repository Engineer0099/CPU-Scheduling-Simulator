document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    const algorithmSelect = document.getElementById('algorithm');
    const timeSliceGroup = document.getElementById('time-slice-group');
    const schedulingTypeSelect = document.getElementById('scheduling-type');
    const setupBtn = document.getElementById('setup-btn');
    const processSection = document.getElementById('process-section');
    const addProcessBtn = document.getElementById('add-process-btn');
    const processTableBody = document.getElementById('process-table-body');
    const calculateBtn = document.getElementById('calculate-btn');
    const resultsDiv = document.getElementById('results');
    const resultsContent = document.getElementById('results-content');
    
    // Show/hide time quantum field based on algorithm selection
    algorithmSelect.addEventListener('change', function() {
        if (this.value === 'rr') {
            timeSliceGroup.style.display = 'block';
        } else {
            timeSliceGroup.style.display = 'none';
        }
        
        // Show/hide priority column based on algorithm
        const priorityColumns = document.querySelectorAll('.priority-column');
        priorityColumns.forEach(col => {
            col.style.display = this.value === 'priority' ? 'table-cell' : 'none';
        });
    });
    
    // Set up process table
    setupBtn.addEventListener('click', function() {
        processSection.style.display = 'block';
        processTableBody.innerHTML = ''; // Clear previous entries
        addProcessRow(); // Add first row by default
        
        // Scroll to process section
        processSection.scrollIntoView({ behavior: 'smooth' });
    });
    
    // Add process row
    addProcessBtn.addEventListener('click', addProcessRow);
    
    function addProcessRow() {
        const row = document.createElement('tr');
        const processCount = processTableBody.children.length + 1;
        const showPriority = algorithmSelect.value === 'priority';
        
        row.innerHTML = `
            <td><input type="text" class="process-id" value="P${processCount}" readonly></td>
            <td><input type="number" class="burst-time" min="1" value="5"></td>
            <td><input type="number" class="arrival-time" min="0" value="0"></td>
            <td class="priority-column" style="display: ${showPriority ? 'table-cell' : 'none'}"><input type="number" class="priority" min="0" value="${processCount}"></td>
            <td><button class="btn remove-btn" style="padding: 5px 10px; background-color: #dc3545;">Remove</button></td>
        `;
        
        processTableBody.appendChild(row);
        
        // Add event listener to remove button
        row.querySelector('.remove-btn').addEventListener('click', function() {
            row.remove();
            updateProcessIds();
        });
    }
    
    function updateProcessIds() {
        const rows = processTableBody.querySelectorAll('tr');
        rows.forEach((row, index) => {
            row.querySelector('.process-id').value = `P${index + 1}`;
        });
    }
    
    // Calculate scheduling
    calculateBtn.addEventListener('click', function() {
        const processes = getProcesses();
        if (processes.length === 0) {
            alert('Please add at least one process');
            return;
        }
        
        const algorithm = algorithmSelect.value;
        const schedulingType = schedulingTypeSelect.value;
        const timeQuantum = algorithm === 'rr' ? parseInt(document.getElementById('time-slice').value) : null;
        
        let results;
        
        if (schedulingType === 'both') {
            // Calculate both preemptive and non-preemptive versions if algorithm supports it
            if (algorithm === 'sjf') {
                const nonPreemptive = calculateSJF(processes, false);
                const preemptive = calculateSJF(processes, true);
                results = compareResults(nonPreemptive, preemptive);
            } else if (algorithm === 'priority') {
                const nonPreemptive = calculatePriority(processes, false);
                const preemptive = calculatePriority(processes, true);
                results = compareResults(nonPreemptive, preemptive);
            } else {
                // For algorithms that don't have both versions, just calculate once
                results = calculateAlgorithm(processes, algorithm, timeQuantum);
            }
        } else {
            const isPreemptive = schedulingType === 'preemptive';
            results = calculateAlgorithm(processes, algorithm, timeQuantum, isPreemptive);
        }
        
        displayResults(results);
        resultsDiv.style.display = 'block';
        resultsDiv.scrollIntoView({ behavior: 'smooth' });
    });
    
    function getProcesses() {
        const processes = [];
        const rows = processTableBody.querySelectorAll('tr');
        
        rows.forEach(row => {
            processes.push({
                id: row.querySelector('.process-id').value,
                burstTime: parseInt(row.querySelector('.burst-time').value),
                arrivalTime: parseInt(row.querySelector('.arrival-time').value) || 0,
                priority: row.querySelector('.priority') ? parseInt(row.querySelector('.priority').value) : 0
            });
        });
        
        return processes;
    }
    
    function calculateAlgorithm(processes, algorithm, timeQuantum, isPreemptive = false) {
        switch (algorithm) {
            case 'fcfs':
                return calculateFCFS(processes);
            case 'sjf':
                return calculateSJF(processes, isPreemptive);
            case 'srtf':
                return calculateSRTF(processes);
            case 'priority':
                return calculatePriority(processes, isPreemptive);
            case 'rr':
                return calculateRoundRobin(processes, timeQuantum);
            default:
                return calculateFCFS(processes);
        }
    }
    
    function calculateFCFS(processes) {
        // Sort by arrival time
        const sortedProcesses = [...processes].sort((a, b) => a.arrivalTime - b.arrivalTime);
        
        let currentTime = sortedProcesses[0].arrivalTime || 0;
        let totalWaitTime = 0;
        let totalTurnaroundTime = 0;
        
        const results = sortedProcesses.map(process => {
            const waitTime = Math.max(0, currentTime - process.arrivalTime);
            const turnaroundTime = waitTime + process.burstTime;
            
            totalWaitTime += waitTime;
            totalTurnaroundTime += turnaroundTime;
            
            currentTime += process.burstTime;
            
            return {
                ...process,
                waitTime,
                turnaroundTime,
                completionTime: currentTime
            };
        });
        
        return {
            algorithm: 'First Come First Serve (FCFS)',
            type: 'Non-Preemptive',
            processes: results,
            avgWaitTime: totalWaitTime / processes.length,
            avgTurnaroundTime: totalTurnaroundTime / processes.length,
            ganttChart: generateGanttChart(results)
        };
    }
    
    function calculateSJF(processes, isPreemptive = false) {
        if (isPreemptive) {
            return calculateSRTF(processes); // SRTF is preemptive SJF
        }
        
        // Non-preemptive SJF
        let currentTime = 0;
        let totalWaitTime = 0;
        let totalTurnaroundTime = 0;
        const results = [];
        const remainingProcesses = [...processes].map(p => ({ ...p, remainingTime: p.burstTime }));
        
        while (remainingProcesses.length > 0) {
            // Get arrived processes
            const arrivedProcesses = remainingProcesses.filter(p => p.arrivalTime <= currentTime);
            
            if (arrivedProcesses.length === 0) {
                currentTime++;
                continue;
            }
            
            // Find process with shortest burst time
            arrivedProcesses.sort((a, b) => a.remainingTime - b.remainingTime);
            const process = arrivedProcesses[0];
            
            // Calculate metrics
            const waitTime = currentTime - process.arrivalTime;
            const turnaroundTime = waitTime + process.burstTime;
            
            totalWaitTime += waitTime;
            totalTurnaroundTime += turnaroundTime;
            
            currentTime += process.burstTime;
            
            results.push({
                ...process,
                waitTime,
                turnaroundTime,
                completionTime: currentTime
            });
            
            // Remove from remaining processes
            const index = remainingProcesses.findIndex(p => p.id === process.id);
            remainingProcesses.splice(index, 1);
        }
        
        return {
            algorithm: 'Shortest Job First (SJF)',
            type: 'Non-Preemptive',
            processes: results,
            avgWaitTime: totalWaitTime / processes.length,
            avgTurnaroundTime: totalTurnaroundTime / processes.length,
            ganttChart: generateGanttChart(results)
        };
    }
    
    function calculateSRTF(processes) {
        let currentTime = 0;
        let totalWaitTime = 0;
        let totalTurnaroundTime = 0;
        const results = [];
        const remainingProcesses = [...processes].map(p => ({ 
            ...p, 
            remainingTime: p.burstTime,
            lastPreempted: p.arrivalTime
        }));
        
        const completedProcesses = new Map();
        
        while (remainingProcesses.length > 0) {
            // Get arrived processes
            const arrivedProcesses = remainingProcesses.filter(p => p.arrivalTime <= currentTime);
            
            if (arrivedProcesses.length === 0) {
                currentTime++;
                continue;
            }
            
            // Find process with shortest remaining time
            arrivedProcesses.sort((a, b) => a.remainingTime - b.remainingTime);
            const process = arrivedProcesses[0];
            
            // Execute for 1 unit of time
            process.remainingTime--;
            currentTime++;
            
            // Check if process completed
            if (process.remainingTime === 0) {
                const waitTime = (currentTime - process.arrivalTime - process.burstTime);
                const turnaroundTime = (currentTime - process.arrivalTime);
                
                totalWaitTime += waitTime;
                totalTurnaroundTime += turnaroundTime;
                
                results.push({
                    ...process,
                    waitTime,
                    turnaroundTime,
                    completionTime: currentTime
                });
                
                // Remove from remaining processes
                const index = remainingProcesses.findIndex(p => p.id === process.id);
                remainingProcesses.splice(index, 1);
            } else {
                process.lastPreempted = currentTime;
            }
        }
        
        return {
            algorithm: 'Shortest Remaining Time First (SRTF)',
            type: 'Preemptive',
            processes: results,
            avgWaitTime: totalWaitTime / processes.length,
            avgTurnaroundTime: totalTurnaroundTime / processes.length,
            ganttChart: generateGanttChart(results)
        };
    }
    
    // function calculatePriority(processes, isPreemptive = false) {
    //     let currentTime = 0;
    //     let totalWaitTime = 0;
    //     let totalTurnaroundTime = 0;
    //     const results = [];
    //     const remainingProcesses = [...processes].map(p => ({ 
    //         ...p, 
    //         remainingTime: p.burstTime,
    //         lastPreempted: p.arrivalTime
    //     }));
        
    //     while (remainingProcesses.length > 0) {
    //         // Get arrived processes
    //         const arrivedProcesses = remainingProcesses.filter(p => p.arrivalTime <= currentTime);
            
    //         if (arrivedProcesses.length === 0) {
    //             currentTime++;
    //             continue;
    //         }
            
    //         // Find process with highest priority (lower number = higher priority)
    //         arrivedProcesses.sort((a, b) => a.priority - b.priority);
    //         const process = arrivedProcesses[0];
            
    //         if (isPreemptive) {
    //             // Execute for 1 unit of time
    //             process.remainingTime--;
    //             currentTime++;
                
    //             // Check if process completed
    //             if (process.remainingTime === 0) {
    //                 const waitTime = (currentTime - process.arrivalTime - process.burstTime);
    //                 const turnaroundTime = (currentTime - process.arrivalTime);
                    
    //                 totalWaitTime += waitTime;
    //                 totalTurnaroundTime += turnaroundTime;
                    
    //                 results.push({
    //                     ...process,
    //                     waitTime,
    //                     turnaroundTime,
    //                     completionTime: currentTime
    //                 });
                    
    //                 // Remove from remaining processes
    //                 const index = remainingProcesses.findIndex(p => p.id === process.id);
    //                 remainingProcesses.splice(index, 1);
    //             } else {
    //                 process.lastPreempted = currentTime;
    //             }
    //         } else {
    //             // Non-preemptive - execute entire burst time
    //             const waitTime = currentTime - process.arrivalTime;
    //             const turnaroundTime = waitTime + process.burstTime;
                
    //             totalWaitTime += waitTime;
    //             totalTurnaroundTime += turnaroundTime;
                
    //             currentTime += process.burstTime;
                
    //             results.push({
    //                 ...process,
    //                 waitTime,
    //                 turnaroundTime,
    //                 completionTime: currentTime
    //             });
                
    //             // Remove from remaining processes
    //             const index = remainingProcesses.findIndex(p => p.id === process.id);
    //             remainingProcesses.splice(index, 1);
    //         }
    //     }
        
    //     return {
    //         algorithm: 'Priority Scheduling',
    //         type: isPreemptive ? 'Preemptive' : 'Non-Preemptive',
    //         processes: results,
    //         avgWaitTime: totalWaitTime / processes.length,
    //         avgTurnaroundTime: totalTurnaroundTime / processes.length,
    //         ganttChart: generateGanttChart(results)
    //     };
    // }
    function calculatePriority(processes, isPreemptive = false) {
        let currentTime = 0;
        let totalWaitTime = 0;
        let totalTurnaroundTime = 0;
        const results = [];
        const ganttChart = [];
        const remainingProcesses = [...processes].map(p => ({
            ...p,
            remainingTime: p.burstTime
        }));
    
        let lastProcessId = null;
    
        while (remainingProcesses.length > 0) {
            // Get all processes that have arrived by currentTime
            const arrived = remainingProcesses.filter(p => p.arrivalTime <= currentTime);
    
            if (arrived.length === 0) {
                ganttChart.push({ id: 'Idle', start: currentTime, end: currentTime + 1 });
                currentTime++;
                continue;
            }
    
            // Sort by priority (lower number is higher priority)
            arrived.sort((a, b) => a.priority - b.priority);
    
            const currentProcess = arrived[0];
            console.log(currentProcess);
    
            if (isPreemptive) {
                if (lastProcessId !== currentProcess.id) {
                    ganttChart.push({ id: currentProcess.id, start: currentTime });
                }
    
                currentProcess.remainingTime--;
                currentTime++;
    
                // Extend end time of last Gantt item
                ganttChart[ganttChart.length - 1].end = currentTime;
    
                if (currentProcess.remainingTime === 0) {
                    const turnaroundTime = currentTime - currentProcess.arrivalTime;
                    const waitTime = turnaroundTime - currentProcess.burstTime;
    
                    totalTurnaroundTime += turnaroundTime;
                    totalWaitTime += waitTime;
    
                    results.push({
                        ...currentProcess,
                        completionTime: currentTime,
                        turnaroundTime,
                        waitTime
                    });
    
                    const index = remainingProcesses.findIndex(p => p.id === currentProcess.id);
                    remainingProcesses.splice(index, 1);
                    lastProcessId = null; // reset for next pick
                } else {
                    lastProcessId = currentProcess.id;
                }
    
            } else {
                // Non-preemptive: Run to completion
                if (lastProcessId !== currentProcess.id) {
                    ganttChart.push({ id: currentProcess.id, start: currentTime });
                }
    
                const startTime = currentTime;
                currentTime += currentProcess.burstTime;
                ganttChart[ganttChart.length - 1].end = currentTime;
    
                const turnaroundTime = currentTime - currentProcess.arrivalTime;
                const waitTime = turnaroundTime - currentProcess.burstTime;
    
                totalTurnaroundTime += turnaroundTime;
                totalWaitTime += waitTime;
    
                results.push({
                    ...currentProcess,
                    completionTime: currentTime,
                    turnaroundTime,
                    waitTime
                });
    
                const index = remainingProcesses.findIndex(p => p.id === currentProcess.id);
                remainingProcesses.splice(index, 1);
            }
        }
    
        return {
            algorithm: 'Priority Scheduling',
            type: isPreemptive ? 'Preemptive' : 'Non-Preemptive',
            processes: results,
            avgWaitTime: totalWaitTime / processes.length,
            avgTurnaroundTime: totalTurnaroundTime / processes.length,
            ganttChart: generateGanttChart(results)
        };
    }
    
    
    // function calculateRoundRobin(processes, timeQuantum) {
    //     let currentTime = 0;
    //     let totalWaitTime = 0;
    //     let totalTurnaroundTime = 0;
    //     const results = [];
    //     const queue = [];
    //     const remainingProcesses = [...processes].map(p => ({ 
    //         ...p, 
    //         remainingTime: p.burstTime,
    //         lastPreempted: p.arrivalTime,
    //         addedToQueue: false
    //     }));
        
    //     // Initial queue population
    //     remainingProcesses.filter(p => p.arrivalTime <= currentTime).forEach(p => {
    //             p.addedToQueue = true;
    //             queue.push(p);
    //             queue.sort((a, b) => a.arrivalTime - b.arrivalTime);
    //         });

    //     while (queue.length > 0 || remainingProcesses.length > 0) {
    //         if (queue.length === 0) {
    //             // No processes in queue, but some haven't arrived yet
    //             currentTime++;

                
    //             // Check for new arrivals
    //             remainingProcesses.filter(p => p.arrivalTime <= currentTime && !p.addedToQueue).forEach(p => {
    //                     p.addedToQueue = true;
    //                     queue.push(p);
    //                     queue.sort((a, b) => a.arrivalTime - b.arrivalTime);
    //                 });
                
    //             continue;
    //         }
            
    //         const process = queue.shift();
    //         const executionTime = Math.min(timeQuantum, process.remainingTime);
            
    //         // Update wait time (time since last preemption/arrival until now)
    //         if (!process.waitTime) {
    //             process.waitTime = currentTime - process.arrivalTime;
    //         } else {
    //             process.waitTime += currentTime - process.lastPreempted;
    //         }
            
    //         // Execute for executionTime
    //         process.remainingTime -= executionTime;
    //         currentTime += executionTime;
    //         process.lastPreempted = currentTime;
            
    //         // Check for new arrivals during this execution
    //         remainingProcesses.filter(p => p.arrivalTime <= currentTime && !p.addedToQueue && p.id !== process.id).forEach(p => {
    //                 p.addedToQueue = true;
    //                 queue.push(p);
    //                 queue.sort((a, b) => a.arrivalTime - b.arrivalTime);
    //             });
            
    //         if (process.remainingTime === 0) {
    //             // Process completed
    //             const turnaroundTime = currentTime - process.arrivalTime;
    //             totalWaitTime += process.waitTime;
    //             totalTurnaroundTime += turnaroundTime;
                
    //             results.push({
    //                 ...process,
    //                 turnaroundTime,
    //                 completionTime: currentTime
    //             });
                
    //             // Remove from remaining processes
    //             const index = remainingProcesses.findIndex(p => p.id === process.id);
    //             if (index !== -1) {
    //                 remainingProcesses.splice(index, 1);
    //             }
    //         } else {
    //             // Process not completed, add back to queue
    //             queue.push(process);
    //             queue.sort((a, b) => a.arrivalTime - b.arrivalTime);
    //         }
    //     }
        
    //     return {
    //         algorithm: 'Round Robin (RR)',
    //         type: `Preemptive (Time Quantum = ${timeQuantum}ms)`,
    //         processes: results,
    //         avgWaitTime: totalWaitTime / processes.length,
    //         avgTurnaroundTime: totalTurnaroundTime / processes.length,
    //         ganttChart: generateGanttChart(results)
    //     };
    // }
    function calculateRoundRobin(processes, timeQuantum) {
        let currentTime = 0;
        let totalWaitTime = 0;
        let totalTurnaroundTime = 0;
        const results = [];
        const queue = [];
        const ganttChart = [];
    
        const remainingProcesses = processes.map(p => ({
            ...p,
            remainingTime: p.burstTime,
            completionTime: 0,
            startTime: null,
            waitTime: 0
        }));
    
        // Keep track of arrived processes
        while (remainingProcesses.some(p => p.remainingTime > 0)) {
            // Add processes that have arrived to the queue
            for (let p of remainingProcesses) {
                if (p.arrivalTime <= currentTime && !queue.includes(p) && p.remainingTime > 0) {
                    queue.push(p);
                }
            }
    
            if (queue.length === 0) {
                currentTime++;
                continue;
            }
    
            const currentProcess = queue.shift();
    
            // Start time tracking
            if (currentProcess.startTime === null) {
                currentProcess.startTime = currentTime;
            }
    
            // Record this execution slice for Gantt chart
            ganttChart.push({
                id: currentProcess.id,
                start: currentTime,
                end: currentTime + Math.min(timeQuantum, currentProcess.remainingTime)
            });
    
            const execTime = Math.min(timeQuantum, currentProcess.remainingTime);
            currentTime += execTime;
            currentProcess.remainingTime -= execTime;
    
            // Re-add new arrivals that came during this execution
            for (let p of remainingProcesses) {
                if (p.arrivalTime > currentTime - execTime && p.arrivalTime <= currentTime && !queue.includes(p) && p.remainingTime > 0 && p !== currentProcess) {
                    queue.push(p);
                }
            }
    
            // Re-add current process if not finished
            if (currentProcess.remainingTime > 0) {
                queue.push(currentProcess);
            } else {
                currentProcess.completionTime = currentTime;
                const turnaroundTime = currentTime - currentProcess.arrivalTime;
                const waitTime = turnaroundTime - currentProcess.burstTime;
                currentProcess.turnaroundTime = turnaroundTime;
                currentProcess.waitTime = waitTime;
                totalTurnaroundTime += turnaroundTime;
                totalWaitTime += waitTime;
                results.push(currentProcess);
            }
        }
    
        return {
            algorithm: 'Round Robin (RR)',
            type: `Preemptive (Time Quantum = ${timeQuantum}ms)`,
            processes: results,
            avgWaitTime: totalWaitTime / results.length,
            avgTurnaroundTime: totalTurnaroundTime / results.length,
            ganttChart: generateGanttChart(results)
        };
    }
    
    
    function generateGanttChart(processes) {
        // Simplified Gantt chart representation
        const sortedByCompletion = [...processes].sort((a, b) => a.completionTime - b.completionTime);
        let chart = '';
        let lastTime = 0;
        
        sortedByCompletion.forEach(process => {
            const start = Math.max(lastTime, process.arrivalTime);
            const duration = process.completionTime - start;
            
            chart += `${process.id} [${start}-${process.completionTime}] `;
            lastTime = process.completionTime;
        });
        
        return chart.trim();
    }
    
    function compareResults(result1, result2) {
        return {
            algorithm: `${result1.algorithm} (Comparison)`,
            type: `${result1.type} vs ${result2.type}`,
            results: [result1, result2],
            comparison: true
        };
    }
    
    // function displayResults(resultData) {
    //     resultsContent.innerHTML = '';
        
    //     if (resultData.comparison) {
    //         // Display comparison of two results
    //         const [result1, result2] = resultData.results;
            
    //         const comparisonHTML = `
    //             <h3>${result1.algorithm} - ${result1.type} vs ${result2.type}</h3>
    //             <div style="display: flex; justify-content: space-between; margin-top: 20px;">
    //                 <div style="width: 48%;">
    //                     <h4>${result1.type}</h4>
    //                     <div class="metric">
    //                         <span class="metric-name">Average Waiting Time:</span>
    //                         <span class="metric-value">${result1.avgWaitTime.toFixed(2)} ms</span>
    //                     </div>
    //                     <div class="metric">
    //                         <span class="metric-name">Average Turnaround Time:</span>
    //                         <span class="metric-value">${result1.avgTurnaroundTime.toFixed(2)} ms</span>
    //                     </div>
    //                     <div class="metric">
    //                         <span class="metric-name">Gantt Chart:</span>
    //                         <span>${result1.ganttChart}</span>
    //                     </div>
    //                 </div>
    //                 <div style="width: 48%;">
    //                     <h4>${result2.type}</h4>
    //                     <div class="metric">
    //                         <span class="metric-name">Average Waiting Time:</span>
    //                         <span class="metric-value">${result2.avgWaitTime.toFixed(2)} ms</span>
    //                     </div>
    //                     <div class="metric">
    //                         <span class="metric-name">Average Turnaround Time:</span>
    //                         <span class="metric-value">${result2.avgTurnaroundTime.toFixed(2)} ms</span>
    //                     </div>
    //                     <div class="metric">
    //                         <span class="metric-name">Gantt Chart:</span>
    //                         <span>${result2.ganttChart}</span>
    //                     </div>
    //                 </div>
    //             </div>
    //             <div style="margin-top: 30px; padding: 15px; background-color: #f8f9fa; border-radius: 5px;">
    //                 <h4>Comparison Summary</h4>
    //                 <p>The ${result1.avgWaitTime < result2.avgWaitTime ? result1.type : result2.type} version 
    //                 has better (lower) average waiting time by 
    //                 ${Math.abs(result1.avgWaitTime - result2.avgWaitTime).toFixed(2)} ms.</p>
    //                 <p>The ${result1.avgTurnaroundTime < result2.avgTurnaroundTime ? result1.type : result2.type} version 
    //                 has better (lower) average turnaround time by 
    //                 ${Math.abs(result1.avgTurnaroundTime - result2.avgTurnaroundTime).toFixed(2)} ms.</p>
    //             </div>
    //         `;
            
    //         resultsContent.innerHTML = comparisonHTML;
    //     } else {
    //         // Display single result
    //         const resultHTML = `
    //             <h3>${resultData.algorithm} - ${resultData.type}</h3>
    //             <div class="metric">
    //                 <span class="metric-name">Average Waiting Time:</span>
    //                 <span class="metric-value">${resultData.avgWaitTime.toFixed(2)} ms</span>
    //             </div>
    //             <div class="metric">
    //                 <span class="metric-name">Average Turnaround Time:</span>
    //                 <span class="metric-value">${resultData.avgTurnaroundTime.toFixed(2)} ms</span>
    //             </div>
    //             <div class="metric">
    //                 <span class="metric-name">Gantt Chart:</span>
    //                 <span>${resultData.ganttChart}</span>
    //             </div>
    //             <div style="margin-top: 30px;">
    //                 <h4>Process Details</h4>
    //                 <div class="process-details-result">
    //                 <table class="process-table" style="margin-top: 10px;">
    //                     <thead>
    //                         <tr>
    //                             <th>Process</th>
    //                             <th>Arrival Time</th>
    //                             <th>Burst Time</th>
    //                             ${resultData.algorithm.includes('Priority') ? '<th>Priority</th>' : ''}
    //                             <th>Completion Time</th>
    //                             <th>Waiting Time</th>
    //                             <th>Turnaround Time</th>
    //                         </tr>
    //                     </thead>
    //                     <tbody>
    //                         ${resultData.processes.map(process => `
    //                             <tr>
    //                                 <td>${process.id}</td>
    //                                 <td>${process.arrivalTime} ms</td>
    //                                 <td>${process.burstTime} ms</td>
    //                                 ${resultData.algorithm.includes('Priority') ? `<td>${process.priority}</td>` : ''}
    //                                 <td>${process.completionTime} ms</td>
    //                                 <td>${process.waitTime} ms</td>
    //                                 <td>${process.turnaroundTime} ms</td>
    //                             </tr>
    //                         `).join('')}
    //                     </tbody>
    //                 </table>
    //                 </div>
    //             </div>
    //         `;
            
    //         resultsContent.innerHTML = resultHTML;
    //     }
    // }
    function displayResults(resultData) {
        resultsContent.innerHTML = '';
    
        if (resultData.comparison) {
            const [result1, result2] = resultData.results;
    
            const comparisonHTML = `
                <h3>${result1.algorithm} - ${result1.type} vs ${result2.type}</h3>
                <div style="display: flex; justify-content: space-between; margin-top: 20px;">
                    <div style="width: 48%;">
                        <h4>${result1.type}</h4>
                        <div class="metric">
                            <span class="metric-name">Average Waiting Time:</span>
                            <span class="metric-value">${result1.avgWaitTime.toFixed(2)} ms</span>
                        </div>
                        <div class="metric">
                            <span class="metric-name">Average Turnaround Time:</span>
                            <span class="metric-value">${result1.avgTurnaroundTime.toFixed(2)} ms</span>
                        </div>
                        <div class="metric">
                            <span class="metric-name">Gantt Chart:</span>
                            <span>${result1.ganttChart}</span>
                        </div>
                    </div>
                    <div style="width: 48%;">
                        <h4>${result2.type}</h4>
                        <div class="metric">
                            <span class="metric-name">Average Waiting Time:</span>
                            <span class="metric-value">${result2.avgWaitTime.toFixed(2)} ms</span>
                        </div>
                        <div class="metric">
                            <span class="metric-name">Average Turnaround Time:</span>
                            <span class="metric-value">${result2.avgTurnaroundTime.toFixed(2)} ms</span>
                        </div>
                        <div class="metric">
                            <span class="metric-name">Gantt Chart:</span>
                            <span>${result2.ganttChart}</span>
                        </div>
                    </div>
                </div>
                <div style="margin-top: 30px; padding: 15px; background-color: #f8f9fa; border-radius: 5px;">
                    <h4>Comparison Summary</h4>
                    <p>The <strong>${result1.avgWaitTime < result2.avgWaitTime ? result1.type : result2.type}</strong> version 
                    has better (lower) average waiting time by 
                    <strong>${Math.abs(result1.avgWaitTime - result2.avgWaitTime).toFixed(2)} ms</strong>.</p>
                    <p>The <strong>${result1.avgTurnaroundTime < result2.avgTurnaroundTime ? result1.type : result2.type}</strong> version 
                    has better (lower) average turnaround time by 
                    <strong>${Math.abs(result1.avgTurnaroundTime - result2.avgTurnaroundTime).toFixed(2)} ms</strong>.</p>
                </div>
            `;
    
            resultsContent.innerHTML = comparisonHTML;
    
        } else {
            // Single result display
            const resultHTML = `
                <h3>${resultData.algorithm} - ${resultData.type}</h3>
                <div class="metric">
                    <span class="metric-name">Average Waiting Time:</span>
                    <span class="metric-value">${resultData.avgWaitTime.toFixed(2)} ms</span>
                </div>
                <div class="metric">
                    <span class="metric-name">Average Turnaround Time:</span>
                    <span class="metric-value">${resultData.avgTurnaroundTime.toFixed(2)} ms</span>
                </div>
                <div class="metric">
                    <span class="metric-name">Gantt Chart:</span>
                    <span>${resultData.ganttChart}</span>
                </div>
                <div style="margin-top: 30px;">
                    <h4>Process Details</h4>
                    <div class="process-details-result">
                        <table class="process-table" style="margin-top: 10px; width: 100%;">
                            <thead>
                                <tr>
                                    <th>Process</th>
                                    <th>Arrival Time</th>
                                    <th>Burst Time</th>
                                    ${resultData.algorithm.includes('Priority') ? '<th>Priority</th>' : ''}
                                    <th>Completion Time</th>
                                    <th>Waiting Time</th>
                                    <th>Turnaround Time</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${resultData.processes.map(process => `
                                    <tr>
                                        <td>${process.id}</td>
                                        <td>${process.arrivalTime} ms</td>
                                        <td>${process.burstTime} ms</td>
                                        ${resultData.algorithm.includes('Priority') ? `<td>${process.priority}</td>` : ''}
                                        <td>${process.completionTime} ms</td>
                                        <td>${process.waitTime} ms</td>
                                        <td>${process.turnaroundTime} ms</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
    
            resultsContent.innerHTML = resultHTML;
        }
    }
    
});
