/**
 * Bonus Instance Wizard Controller
 * Handles the multi-step workflow for adjusting and reviewing bonus instances
 */
angular.module('app')
.controller('BonusInstanceWizardCtrl', ['$scope', '$http', '$stateParams', '$state', '$ocLazyLoad', 'SweetAlert', '$mdDialog', 'toastr',
function($scope, $http, $stateParams, $state, $ocLazyLoad, SweetAlert, $mdDialog, toastr) {

    // Initialize the wizard
    $scope.initialize = function() {
        $scope.instanceId = $stateParams.instanceId;
        $scope.currentStep = 'adjust'; // Default step
        $scope.loading = true;
        $scope.historicalData = [];
        $scope.historicalDataByPersonnelId = {};

        // Load the instance details
        $http.get('/api/bonus/instances/' + $scope.instanceId)
            .then(function(response) {
                $scope.instance = response.data;
                $scope.currentStep = $scope.instance.wizardStep || 'adjust';

                // Load allocations for this instance
                return $http.get('/api/bonus/allocations', {
                    params: {
                        instanceId: $scope.instanceId,
                        limit:4000
                    }
                });
            })
            .then(function(response) {
                $scope.allocations = response.data;
                console.log($scope.allocations)
                $scope.loading = false;
                $scope.kernel.loading = 100;

                // Calculate totals
                $scope.calculateTotals();

                // Load historical data if on the confirm step
                if ($scope.currentStep === 'confirm' || $scope.currentStep === 'export') {
                    $scope.loadHistoricalData();
                }
            })
            .catch(function(error) {
                console.error('Error loading instance data', error);
                toastr.error('Could not load bonus instance data');
                $scope.loading = false;
                $scope.kernel.loading = 100;
            });
    };

    // Calculate allocation totals
    $scope.calculateTotals = function() {
        $scope.totals = {
            eligible: 0,
            excluded: 0,
            adjusted: 0,
            total: 0,
            amount: 0
        };

        if ($scope.allocations && $scope.allocations.length) {
            $scope.allocations.forEach(function(allocation) {
                $scope.totals.total++;

                if (allocation.status === 'eligible') {
                    $scope.totals.eligible++;
                    $scope.totals.amount += allocation.finalAmount || 0;
                } else if (allocation.status === 'excluded') {
                    $scope.totals.excluded++;
                } else if (allocation.status === 'adjusted') {
                    $scope.totals.adjusted++;
                    $scope.totals.amount += allocation.finalAmount || 0;
                }
            });
        }
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
                $scope.calculateTotals();
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
                $scope.calculateTotals();
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
                $scope.calculateTotals();
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
                $scope.calculateTotals();
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

    // Initialize when controller loads
    $scope.initialize();
}]);
