/**
 * Bonus Instance Wizard Controller
 * Handles the multi-step workflow for adjusting and reviewing bonus instances
 */
angular.module('app')
.controller('BonusInstanceWizardCtrl', ['$scope', '$http', '$stateParams', '$state', '$ocLazyLoad', 'SweetAlert', '$mdDialog', 'toastr', '$timeout',
function($scope, $http, $stateParams, $state, $ocLazyLoad, SweetAlert, $mdDialog, toastr, $timeout) {

    // Helper to ensure numeric pagination
    function toInt(val, fallback) {
        const n = parseInt(val, 10);
        return isNaN(n) ? (fallback !== undefined ? fallback : 0) : n;
    }

    // Pagination state
    $scope.pagination = {
        limit: 50,
        offset: 0,
        total: 0
    };

    // Totals (sidebar) based on server stats
    $scope.totals = {
        eligible: 0,
        excluded: 0,
        adjusted: 0,
        total: 0,
        amount: 0,
        parts: 0
    };

    // Map stats payload to $scope.totals
    function setTotalsFromStats(stats) {
        if (!stats) return;
        $scope.totals = {
            eligible: stats.eligible || 0,
            excluded: stats.excluded || 0,
            adjusted: stats.adjusted || 0,
            total: stats.total || 0,
            amount: stats.totalAmount || 0,
            parts: stats.totalParts || 0
        };
    }

    // Load one page of allocations with optional status filter
    $scope.loadAllocationsPage = function() {
        // Coerce numbers
        $scope.pagination.limit = toInt($scope.pagination.limit, 50);
        $scope.pagination.offset = toInt($scope.pagination.offset, 0);

        const params = {
            instanceId: $scope.instanceId,
            limit: $scope.pagination.limit,
            offset: $scope.pagination.offset,
            sortBy: 'createdAt:desc',
            envelope: true,
            search: ($scope.searchTerm || '').trim()
        };
        if ($scope.filterStatus) {
            params.status = $scope.filterStatus;
        }

        return $http.get('/api/bonus/allocations', { params })
            .then(function(response) {
                if (response.data && response.data.items) {
                    $scope.allocations = response.data.items;
                    $scope.pagination.total = toInt(response.data.total, 0);
                    $scope.pagination.limit = toInt(response.data.limit, $scope.pagination.limit);
                    // Clamp offset if it overflows total
                    const maxOffset = Math.max(0, $scope.pagination.total - $scope.pagination.limit);
                    $scope.pagination.offset = Math.min(toInt(response.data.offset, 0), maxOffset);

                    // Update sidebar totals with filtered stats when available
                    if (response.data.stats) {
                        setTotalsFromStats(response.data.stats);
                    } else {
                        // Fallback to client calculation if stats missing
                        $scope.calculateTotals();
                    }
                    return response.data.stats;
                } else {
                    $scope.allocations = response.data || [];
                    $scope.pagination.total = $scope.allocations.length;
                    // Fallback to client totals for non-envelope responses
                    $scope.calculateTotals();
                    return null;
                }
            })
            .catch(function(error) {
                console.error('Error loading allocations page', error);
                toastr.error('Could not load allocations');
                throw error;
            });
    };

    // Refresh global stats (not affected by current filter)
    $scope.refreshGlobalStats = function() {
        const params = {
            instanceId: $scope.instanceId,
            limit: 1,
            offset: 0,
            envelope: true
        };
        return $http.get('/api/bonus/allocations', { params })
            .then(function(response) {
                if (response.data && response.data.stats) {
                    setTotalsFromStats(response.data.stats);
                } else {
                    // Fallback to client totals for current page
                    $scope.calculateTotals();
                }
            })
            .catch(function(error) {
                console.error('Error refreshing stats', error);
                // Keep previous totals if stats fail
            });
    };

    // Calculate client-side totals for current allocations list (fallback only)
    $scope.calculateTotals = function() {
        $scope.totals = {
            eligible: 0,
            excluded: 0,
            adjusted: 0,
            total: 0,
            amount: 0,
            parts: 0
        };

        if ($scope.allocations && $scope.allocations.length) {
            $scope.allocations.forEach(function(allocation) {
                $scope.totals.total++;

                if (allocation.status === 'eligible') {
                    $scope.totals.eligible++;
                    $scope.totals.amount += allocation.finalAmount || 0;
                    $scope.totals.parts += allocation.calculationInputs?.parts || 0;
                } else if (allocation.status === 'excluded') {
                    $scope.totals.excluded++;
                } else if (allocation.status === 'adjusted') {
                    $scope.totals.adjusted++;
                    $scope.totals.amount += allocation.finalAmount || 0;
                    $scope.totals.parts += allocation.calculationInputs?.parts || 0;
                }
            });
        }
    };

    // Navigation helpers
    $scope.canPrevPage = function() {
        return toInt($scope.pagination.offset, 0) > 0;
    };
    $scope.canNextPage = function() {
        const offset = toInt($scope.pagination.offset, 0);
        const limit = toInt($scope.pagination.limit, 50);
        const total = toInt($scope.pagination.total, 0);
        return (offset + limit) < total;
    };
    $scope.nextPage = function() {
        if (!$scope.canNextPage()) return;
        $scope.pagination.offset = toInt($scope.pagination.offset, 0) + toInt($scope.pagination.limit, 50);
        $scope.reloadPage();
    };
    $scope.prevPage = function() {
        if (!$scope.canPrevPage()) return;
        $scope.pagination.offset = Math.max(0, toInt($scope.pagination.offset, 0) - toInt($scope.pagination.limit, 50));
        $scope.reloadPage();
    };
    $scope.goToPage = function(pageNumber) {
        const limit = toInt($scope.pagination.limit, 50);
        const total = toInt($scope.pagination.total, 0);
        const maxPage = Math.max(1, Math.ceil(total / Math.max(1, limit)));
        const page = Math.max(1, Math.min(toInt(pageNumber, 1), maxPage));
        $scope.pagination.offset = (page - 1) * limit;
        $scope.reloadPage();
    };

    // Ensure changing page size resets to first page
    $scope.$watch('pagination.limit', function(newVal, oldVal) {
        if (newVal === oldVal) return;
        $scope.pagination.limit = toInt(newVal, 50);
        $scope.pagination.offset = 0;
    });

    $scope.reloadPage = function() {
        $scope.loading = true;
        var hasActiveFilters = ($scope.filterStatus && $scope.filterStatus.length) || ($scope.searchTerm && $scope.searchTerm.trim().length);
        $scope.loadAllocationsPage()
            .then(function() {
                // Only load global stats when no active filters
                if (!hasActiveFilters) {
                    return $scope.refreshGlobalStats();
                }
            })
            .finally(function() { $scope.loading = false; });
    };

    // Load historical personnel data
    $scope.loadHistoricalData = function() {
        $scope.loadingHistory = true;

        $http.get('/api/bonus/instances/' + $scope.instanceId + '/historical-data')
            .then(function(response) {
                $scope.historicalData = response.data.personnelData;

                // Organize historical data by personnel ID for easier access
                $scope.historicalDataByPersonnelId = {};
                if ($scope.historicalData && $scope.historicalData.length) {
                    $scope.historicalData.forEach(function(data) {
                        if (data.personnelId) {
                            $scope.historicalDataByPersonnelId[data.personnelId] = data;
                        }
                    });
                }

                $scope.loadingHistory = false;
            })
            .catch(function(error) {
                console.error('Error loading historical data', error);
                toastr.error('Could not load historical snapshot data');
                $scope.loadingHistory = false;
            });
    };

    // Get historical data for a specific personnel
    $scope.getHistoricalDataForPersonnel = function(personnelId) {
        if (!personnelId || !$scope.historicalDataByPersonnelId) return null;

        const id = typeof personnelId === 'object' ? personnelId.toString() : personnelId;
        return $scope.historicalDataByPersonnelId[id];
    };

    // Open detailed history view for an allocation
    $scope.openHistoryDetails = function(allocation) {
        // Get the historical data for this allocation
        const historicalData = $scope.getHistoricalDataForPersonnel(allocation.personnelId._id);

        $mdDialog.show({
            controller: function($scope, $mdDialog, allocation, historicalData) {
                $scope.allocation = allocation;
                $scope.historicalData = historicalData;

                $scope.closeDialog = function() {
                    $mdDialog.hide();
                };
            },
            templateUrl: 'templates/bonus/modals/history-details.html',
            parent: angular.element(document.body),
            clickOutsideToClose: true,
            locals: {
                allocation: allocation,
                historicalData: historicalData
            }
        });
    };

    // Move to the next step in the wizard
    $scope.nextStep = function() {
        let nextStep;

        switch($scope.currentStep) {
            case 'adjust':
                nextStep = 'confirm';
                break;
            case 'confirm':
                nextStep = 'export';
                break;
            case 'export':
                nextStep = 'completed';
                break;
            default:
                return; // Already at the final step
        }

        $scope.updateWizardStep(nextStep);
    };

    // Go back to the previous step
    $scope.previousStep = function() {
        let prevStep;

        switch($scope.currentStep) {
            case 'confirm':
                prevStep = 'adjust';
                break;
            case 'export':
                prevStep = 'confirm';
                break;
            case 'completed':
                prevStep = 'export';
                break;
            default:
                return; // Already at the first step
        }

        $scope.updateWizardStep(prevStep);
    };

    // Update the wizard step on the server
    $scope.updateWizardStep = function(step) {
        $scope.updatingStep = true;

        $http.post('/api/bonus/instances/' + $scope.instanceId + '/wizard-step', { step: step })
            .then(function(response) {
                $scope.instance = response.data;
                $scope.currentStep = step;
                $scope.updatingStep = false;

                // Load historical data if moving to confirm or export step
                if (step === 'confirm' || step === 'export') {
                    $scope.loadHistoricalData();
                }

                toastr.success('Moved to ' + step + ' step');
            })
            .catch(function(error) {
                console.error('Error updating wizard step', error);
                toastr.error('Could not update wizard step');
                $scope.updatingStep = false;
            });
    };

    // Adjust allocation parts/amount
    $scope.adjustAllocation = function(allocation) {
        $ocLazyLoad.load('js/controllers/bonus/AdjustAllocationModalCtrl.js').then(function() {
            $mdDialog.show({
                controller: 'AdjustAllocationModalCtrl',
                templateUrl: 'templates/bonus/modals/adjust-allocation.html',
                parent: angular.element(document.body),
                clickOutsideToClose: false,
                locals: {
                    allocation: allocation
                }
            }).then(function(updatedAllocation) {
                // Update the allocation in the list
                const index = $scope.allocations.findIndex(a => a._id === updatedAllocation._id);
                if (index !== -1) {
                    $scope.allocations[index] = updatedAllocation;
                }
                $scope.reloadPage();
                toastr.success('Allocation adjusted successfully');
            });
        });
    };

    // Save adjusted allocation
    $scope.saveAdjustedAllocation = function() {
        if (!$scope.selectedAllocation) return;

        // Validate required fields
        if (!$scope.selectedAllocation.calculationInputs.comment) {
            toastr.error('Adjustment reason is required');
            return;
        }

        const allocationId = $scope.selectedAllocation._id;
        const adjustmentData = {
            parts: $scope.selectedAllocation.calculationInputs.parts,
            amount: $scope.selectedAllocation.finalAmount,
            reason: $scope.selectedAllocation.calculationInputs.comment
        };

        $scope.adjusting = true;

        $http.post('/api/bonus/allocations/' + allocationId + '/adjust', adjustmentData)
            .then(function(response) {
                // Update the allocation in the list
                const index = $scope.allocations.findIndex(a => a._id === allocationId);
                if (index !== -1) {
                    $scope.allocations[index] = response.data;
                }

                $scope.adjusting = false;
                $scope.reloadPage();
                $('#adjustAllocationModal').modal('hide');
                toastr.success('Allocation adjusted successfully');
            })
            .catch(function(error) {
                console.error('Error adjusting allocation', error);
                toastr.error(error.data?.message || 'Could not adjust allocation');
                $scope.adjusting = false;
            });
    };

    // Exclude allocation
    $scope.excludeAllocation = function(allocation) {
        $ocLazyLoad.load('js/controllers/bonus/ExcludeAllocationModalCtrl.js').then(function() {
            $mdDialog.show({
                controller: 'ExcludeAllocationModalCtrl',
                templateUrl: 'templates/bonus/modals/exclude-allocation.html',
                parent: angular.element(document.body),
                clickOutsideToClose: false,
                locals: {
                    allocation: allocation
                }
            }).then(function(updatedAllocation) {
                const index = $scope.allocations.findIndex(a => a._id === updatedAllocation._id);
                if (index !== -1) {
                    $scope.allocations[index] = updatedAllocation;
                }
                $scope.reloadPage();
                toastr.success('Allocation excluded successfully');
            });
        });
    };

    // Include allocation
    $scope.includeAllocation = function(allocation) {
        $ocLazyLoad.load('js/controllers/bonus/IncludeAllocationModalCtrl.js').then(function() {
            $mdDialog.show({
                controller: 'IncludeAllocationModalCtrl',
                templateUrl: 'templates/bonus/modals/include-allocation.html',
                parent: angular.element(document.body),
                clickOutsideToClose: false,
                locals: {
                    allocation: allocation // Pass allocation object correctly
                }
            }).then(function(updatedAllocation) {
                const index = $scope.allocations.findIndex(a => a._id === updatedAllocation._id);
                if (index !== -1) {
                    $scope.allocations[index] = updatedAllocation;
                }
                $scope.reloadPage();
                toastr.success('Allocation included successfully');
            });
        });
    };

    // View allocation history
    $scope.viewHistory = function(allocation) {
        $scope.selectedAllocation = allocation;

        $http.get('/api/bonus/allocations/' + allocation._id + '/history')
            .then(function(response) {
                $scope.allocationHistory = response.data;
                $('#allocationHistoryModal').modal('show');
            })
            .catch(function(error) {
                console.error('Error fetching allocation history', error);
                toastr.error('Could not fetch allocation history');
            });
    };

    // Open View History Modal
    $scope.openViewHistory = function(allocation) {
        $http.get('/api/bonus/allocations/' + allocation._id + '/history')
            .then(function(response) {
                $scope.allocationHistory = response.data.history; // Updated to use the history array
                $scope.currentAllocation = response.data.current; // Added to store the current allocation

                console.log($scope.allocationHistory)

                $mdDialog.show({
                    templateUrl: '/templates/bonus/modals/view-history.html',
                    parent: angular.element(document.body),
                    clickOutsideToClose: true,
                    scope: $scope,
                    preserveScope: true
                });
            })
            .catch(function(error) {
                console.error('Error loading allocation history', error);
                toastr.error('Could not load allocation history');
            });
    };

    // Export the instance data in Excel format
    $scope.exportInstance = function() {
        $scope.exporting = 'excel';

        // Show loading toast
        toastr.info('Generating Excel export, please wait...');

        $http({
            method: 'GET',
            url: '/api/bonus/instances/' + $scope.instanceId + '/export',
            params: { format: 'excel' },
            responseType: 'blob' // Important for handling binary data
        }).then(function(response) {
            // Create blob from response
            const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

            // Get the file size in bytes
            const fileSizeBytes = blob.size;

            // Format file size for display
            const fileSizeFormatted = formatFileSize(fileSizeBytes);

            // Create object URL
            const url = window.URL.createObjectURL(blob);

            // Create anchor and trigger download
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'bonus-export-' + $scope.instance.referencePeriod + '.xlsx';
            document.body.appendChild(a);
            a.click();

            // Clean up
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            // Update UI
            $scope.exporting = null;
            toastr.success('Excel export completed successfully!');

            // Record the export in database
            const exportRecord = {
                type: 'Excel',
                user: $scope.account ? ($scope.account.firstname + ' ' + $scope.account.lastname) : 'System',
                userId: $scope.account ? $scope.account._id : null,
                fileSize: fileSizeFormatted
            };

            // Save export record to the database
            $http.post('/api/bonus/instances/' + $scope.instanceId + '/record-export', exportRecord)
                .then(function(response) {
                    // Update the local instance with the updated export history
                    if (response.data && response.data.exports) {
                        $scope.instance.exports = response.data.exports;
                    }
                })
                .catch(function(error) {
                    console.error('Error recording export history', error);
                    // Continue silently as this is not critical functionality
                });
        }).catch(function(error) {
            console.error('Error generating Excel export', error);
            $scope.exporting = null;
            toastr.error('Could not generate Excel export');
        });
    };

    // Export the instance data in PDF format
    $scope.exportPDF = function() {
        $scope.exporting = 'pdf';

        // Show loading toast
        toastr.info('Generating PDF report, please wait...');

        $http({
            method: 'GET',
            url: '/api/bonus/instances/' + $scope.instanceId + '/export',
            params: { format: 'pdf' },
            responseType: 'blob' // Important for handling binary data
        }).then(function(response) {
            // Create blob from response
            const blob = new Blob([response.data], { type: 'application/pdf' });

            // Get the file size in bytes
            const fileSizeBytes = blob.size;

            // Format file size for display
            const fileSizeFormatted = formatFileSize(fileSizeBytes);

            // Create object URL
            const url = window.URL.createObjectURL(blob);

            // Create anchor and trigger download
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'bonus-export-' + $scope.instance.referencePeriod + '.pdf';
            document.body.appendChild(a);
            a.click();

            // Clean up
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            // Update UI
            $scope.exporting = null;
            toastr.success('PDF export completed successfully!');

            // Record the export in database
            const exportRecord = {
                type: 'PDF',
                user: $scope.account ? ($scope.account.firstname + ' ' + $scope.account.lastname) : 'System',
                userId: $scope.account ? $scope.account._id : null,
                fileSize: fileSizeFormatted
            };

            // Save export record to the database
            $http.post('/api/bonus/instances/' + $scope.instanceId + '/record-export', exportRecord)
                .then(function(response) {
                    // Update the local instance with the updated export history
                    if (response.data && response.data.exports) {
                        $scope.instance.exports = response.data.exports;
                    }
                })
                .catch(function(error) {
                    console.error('Error recording export history', error);
                    // Continue silently as this is not critical functionality
                });
        }).catch(function(error) {
            console.error('Error generating PDF export', error);
            $scope.exporting = null;
            toastr.error('Could not generate PDF export');
        });
    };

    // Helper function to format file size
    function formatFileSize(bytes) {
        if (!bytes) return 'N/A';
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0) return '0 Byte';
        const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
        return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
    }

    // Approve the instance
    $scope.approveInstance = function() {
        console.log('approveInstance function called');
        console.log('Instance ID:', $scope.instanceId);
        console.log('Instance status:', $scope.instance.status);

        // Using standard SweetAlert syntax instead of SweetAlert2
        SweetAlert.swal({
            title: "Approve Instance",
            text: "Are you sure you want to approve this bonus instance? This will finalize all allocations.",
            type: "warning",
            showCancelButton: true,
            confirmButtonColor: "#DD6B55",
            confirmButtonText: "Yes, approve it",
            cancelButtonText: "Cancel",
            closeOnConfirm: false
        }, function(isConfirmed) {
            if (isConfirmed) {
                console.log('SweetAlert confirmation callback triggered');

                $http.post('/api/bonus/instances/' + $scope.instanceId + '/approve')
                    .then(function(response) {
                        console.log('API call successful:', response.data);
                        $scope.instance = response.data;
                        SweetAlert.swal("Approved!", "The bonus instance has been approved.", "success");
                        // Redirect to the instances list
                        $state.go('home.bonus.instances');
                    })
                    .catch(function(error) {
                        console.error('Error approving instance', error);
                        SweetAlert.swal("Error!", "Could not approve instance.", "error");
                    });
            }
        });
    };

    // Direct approve function (alternative implementation)
    $scope.directApproveInstance = function() {
        console.log('directApproveInstance function called');

        // Show loading toast
        toastr.info('Processing approval request...');

        $http.post('/api/bonus/instances/' + $scope.instanceId + '/approve')
            .then(function(response) {
                console.log('API call successful:', response.data);
                $scope.instance = response.data;
                toastr.success('The bonus instance has been approved.');
                // Redirect to the instances list after a brief delay
                setTimeout(function() {
                    $state.go('home.bonus.instances');
                }, 1500);
            })
            .catch(function(error) {
                console.error('Error approving instance', error);
                toastr.error('Could not approve instance: ' + (error.data?.message || 'Unknown error'));
            });
    };

    // Update share amount for the instance
    $scope.updateShareAmount = function() {
        // Display modal for updating share amount
        $mdDialog.show({
            controller: function($scope, $mdDialog, instance, currentShareAmount) {
                $scope.instance = instance;
                $scope.formData = {
                    currentShareAmount: currentShareAmount,
                    newShareAmount: currentShareAmount,
                    reason: ''
                };
                $scope.updating = false;

                $scope.cancel = function() {
                    $mdDialog.cancel();
                };

                $scope.save = function() {
                    if ($scope.updating) return;

                    if (!$scope.formData.newShareAmount) {
                        toastr.error('Please enter a valid amount');
                        return;
                    }

                    if (!$scope.formData.reason) {
                        toastr.error('Please provide a reason for the change');
                        return;
                    }

                    $scope.updating = true;

                    $http.post('/api/bonus/instances/' + instance._id + '/update-share-amount', {
                        newShareAmount: $scope.formData.newShareAmount,
                        reason: $scope.formData.reason
                    })
                    .then(function(response) {
                        $mdDialog.hide(response.data);
                    })
                    .catch(function(error) {
                        console.error('Error updating share amount', error);
                        toastr.error('Could not update share amount: ' + (error.data?.message || 'Unknown error'));
                        $scope.updating = false;
                    });
                };
            },
            templateUrl: 'templates/bonus/modals/update-share-amount.html',
            parent: angular.element(document.body),
            clickOutsideToClose: false,
            locals: {
                instance: $scope.instance,
                currentShareAmount: $scope.instance.shareAmount
            }
        }).then(function(updatedInstance) {
            // Update the instance in the scope
            $scope.instance = updatedInstance;
            toastr.success('Share amount updated successfully. Recalculation in progress.');

            // Start polling for recalculation progress
            $scope.startRecalculationPolling();
        });
    };

    // Update tax configuration for the instance
    $scope.updateTaxConfig = function() {
        // Display modal for updating tax configuration
        $mdDialog.show({
            controller: function($scope, $mdDialog, instance, currentTaxName, currentTaxPercentage) {
                $scope.instance = instance;
                $scope.formData = {
                    currentTaxName: currentTaxName,
                    currentTaxPercentage: currentTaxPercentage,
                    newTaxName: currentTaxName,
                    newTaxPercentage: currentTaxPercentage,
                    reason: ''
                };
                $scope.updating = false;

                $scope.cancel = function() {
                    $mdDialog.cancel();
                };

                $scope.save = function() {
                    if ($scope.updating) return;

                    if (!$scope.formData.newTaxName) {
                        toastr.error('Please enter a valid tax name');
                        return;
                    }

                    if ($scope.formData.newTaxPercentage === undefined || $scope.formData.newTaxPercentage < 0 || $scope.formData.newTaxPercentage > 100) {
                        toastr.error('Please enter a valid tax percentage (0-100%)');
                        return;
                    }

                    if (!$scope.formData.reason) {
                        toastr.error('Please provide a reason for the change');
                        return;
                    }

                    $scope.updating = true;

                    $http.post('/api/bonus/instances/' + instance._id + '/update-tax-config', {
                        taxName: $scope.formData.newTaxName,
                        taxPercentage: $scope.formData.newTaxPercentage,
                        reason: $scope.formData.reason
                    })
                    .then(function(response) {
                        $mdDialog.hide(response.data);
                    })
                    .catch(function(error) {
                        console.error('Error updating tax configuration', error);
                        toastr.error('Could not update tax configuration: ' + (error.data?.message || 'Unknown error'));
                        $scope.updating = false;
                    });
                };
            },
            templateUrl: 'templates/bonus/modals/update-tax-config.html',
            parent: angular.element(document.body),
            clickOutsideToClose: false,
            locals: {
                instance: $scope.instance,
                currentTaxName: $scope.instance.taxName,
                currentTaxPercentage: $scope.instance.taxPercentage
            }
        }).then(function(updatedInstance) {
            // Update the instance in the scope
            $scope.instance = updatedInstance;
            toastr.success('Tax configuration updated successfully. Recalculation in progress.');

            // Start polling for recalculation progress
            $scope.startRecalculationPolling();
        });
    };

    // Poll for recalculation progress
    $scope.startRecalculationPolling = function() {
        if ($scope.recalculationPolling) {
            $timeout.cancel($scope.recalculationPolling);
        }

        function checkRecalculationProgress() {
            $http.get('/api/bonus/instances/' + $scope.instanceId)
                .then(function(response) {
                    $scope.instance = response.data;

                    // If recalculation is complete, stop polling
                    if (!$scope.instance.recalculationStatus.inProgress) {
                        $timeout.cancel($scope.recalculationPolling);
                        $scope.recalculationPolling = null;

                        // Reload allocations to get updated values
                        $scope.loading = true;
                        $scope.loadInstanceData();
                        toastr.success('Allocation recalculation completed successfully.');
                    } else {
                        // Continue polling
                        $scope.recalculationPolling = $timeout(checkRecalculationProgress, 2000);
                    }
                })
                .catch(function(error) {
                    console.error('Error checking recalculation status', error);
                    $timeout.cancel($scope.recalculationPolling);
                    $scope.recalculationPolling = null;
                });
        }

        // Start polling
        $scope.recalculationPolling = $timeout(checkRecalculationProgress, 2000);
    };

    // Load instance data
    $scope.loadInstanceData = function() {
        $http.get('/api/bonus/instances/' + $scope.instanceId)
            .then(function(response) {
                $scope.instance = response.data;
                $scope.currentStep = $scope.instance.wizardStep || 'adjust';
                // Reset pagination on first load
                $scope.pagination.offset = 0;
                // Load first page of allocations
                return $scope.loadAllocationsPage();
            })
            .then(function() {
                // If no active filters, ensure sidebar shows global stats
                var hasActiveFilters = ($scope.filterStatus && $scope.filterStatus.length) || ($scope.searchTerm && $scope.searchTerm.trim().length);
                if (!hasActiveFilters) {
                    return $scope.refreshGlobalStats();
                }
            })
            .then(function() {
                $scope.loading = false;
                $scope.kernel && ($scope.kernel.loading = 100);
                // Load historical data if on the confirm step
                if ($scope.currentStep === 'confirm' || $scope.currentStep === 'export') {
                    $scope.loadHistoricalData();
                }
            })
            .catch(function(error) {
                console.error('Error loading instance data', error);
                toastr.error('Could not load bonus instance data');
                $scope.loading = false;
                $scope.kernel && ($scope.kernel.loading = 100);
            });
    };

    // Debounced search watcher
    let searchDebouncePromise;
    $scope.$watch('searchTerm', function(newVal, oldVal) {
        if (newVal === oldVal && $scope.allocations) return;
        if (searchDebouncePromise) {
            $timeout.cancel(searchDebouncePromise);
        }
        searchDebouncePromise = $timeout(function() {
            $scope.pagination.offset = 0;
            $scope.reloadPage();
            searchDebouncePromise = null;
        }, 300);
    });

    // Watch status filter to refetch from server
    $scope.$watch('filterStatus', function(newVal, oldVal) {
        if (newVal === oldVal && $scope.allocations) return;
        // Reset to first page when filter changes
        $scope.pagination.offset = 0;
        $scope.reloadPage();
    });

    // Initialize
    $scope.initialize = function() {
        $scope.instanceId = $stateParams.instanceId;
        $scope.currentStep = 'adjust';
        $scope.loading = true;
        $scope.historicalData = [];
        $scope.historicalDataByPersonnelId = {};
        $scope.loadInstanceData();
    };

    // Initialize when controller loads
    $scope.initialize();
}]);
