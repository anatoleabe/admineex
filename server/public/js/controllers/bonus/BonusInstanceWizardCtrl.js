/**
 * Bonus Instance Wizard Controller
 * Handles the multi-step workflow for adjusting and reviewing bonus instances
 */
angular.module('app')
.controller('BonusInstanceWizardCtrl', ['$scope', '$http', '$stateParams', '$state', 'SweetAlert', 'toastr',
function($scope, $http, $stateParams, $state, SweetAlert, toastr) {

    // Initialize the wizard
    $scope.initialize = function() {
        $scope.instanceId = $stateParams.instanceId;
        $scope.currentStep = 'adjust'; // Default step
        $scope.loading = true;
        $scope.historicalData = [];

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
                $scope.loadingHistory = false;
            })
            .catch(function(error) {
                console.error('Error loading historical data', error);
                toastr.error('Could not load historical snapshot data');
                $scope.loadingHistory = false;
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
        $scope.selectedAllocation = angular.copy(allocation);
        $('#adjustAllocationModal').modal('show');
    };

    // Save adjusted allocation
    $scope.saveAdjustedAllocation = function() {
        if (!$scope.selectedAllocation) return;

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
                toastr.success('Allocation adjusted');
            })
            .catch(function(error) {
                console.error('Error adjusting allocation', error);
                toastr.error('Could not adjust allocation');
                $scope.adjusting = false;
            });
    };

    // Exclude allocation
    $scope.excludeAllocation = function(allocation) {
        $scope.selectedAllocation = angular.copy(allocation);
        $('#excludeAllocationModal').modal('show');
    };

    // Save excluded allocation
    $scope.saveExcludedAllocation = function() {
        if (!$scope.selectedAllocation) return;

        const allocationId = $scope.selectedAllocation._id;
        const excludeData = {
            reason: $scope.selectedAllocation.calculationInputs.comment || 'Manual exclusion'
        };

        $scope.excluding = true;

        $http.post('/api/bonus/allocations/' + allocationId + '/exclude', excludeData)
            .then(function(response) {
                // Update the allocation in the list
                const index = $scope.allocations.findIndex(a => a._id === allocationId);
                if (index !== -1) {
                    $scope.allocations[index] = response.data;
                }

                $scope.excluding = false;
                $scope.calculateTotals();
                $('#excludeAllocationModal').modal('hide');
                toastr.success('Allocation excluded');
            })
            .catch(function(error) {
                console.error('Error excluding allocation', error);
                toastr.error('Could not exclude allocation');
                $scope.excluding = false;
            });
    };

    // Include allocation
    $scope.includeAllocation = function(allocation) {
        SweetAlert.swal({
            title: "Include Allocation",
            text: "Are you sure you want to include this allocation?",
            type: "warning",
            showCancelButton: true,
            confirmButtonColor: "#DD6B55",
            confirmButtonText: "Yes, include it",
            closeOnConfirm: false
        }, function() {
            $http.post('/api/bonus/allocations/' + allocation._id + '/include')
                .then(function(response) {
                    // Update the allocation in the list
                    const index = $scope.allocations.findIndex(a => a._id === allocation._id);
                    if (index !== -1) {
                        $scope.allocations[index] = response.data;
                    }

                    $scope.calculateTotals();
                    SweetAlert.swal("Included!", "The allocation has been included.", "success");
                })
                .catch(function(error) {
                    console.error('Error including allocation', error);
                    SweetAlert.swal("Error!", "Could not include allocation.", "error");
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

    // Export the instance data
    $scope.exportInstance = function() {
        window.location.href = '/api/bonus/instances/' + $scope.instanceId + '/export';
    };

    // Approve the instance
    $scope.approveInstance = function() {
        SweetAlert.swal({
            title: "Approve Instance",
            text: "Are you sure you want to approve this bonus instance? This will finalize all allocations.",
            type: "warning",
            showCancelButton: true,
            confirmButtonColor: "#DD6B55",
            confirmButtonText: "Yes, approve it",
            closeOnConfirm: false
        }, function() {
            $http.post('/api/bonus/instances/' + $scope.instanceId + '/approve')
                .then(function(response) {
                    $scope.instance = response.data;
                    SweetAlert.swal("Approved!", "The bonus instance has been approved.", "success");
                    // Redirect to the instances list
                    $state.go('home.bonus.instances');
                })
                .catch(function(error) {
                    console.error('Error approving instance', error);
                    SweetAlert.swal("Error!", "Could not approve instance.", "error");
                });
        });
    };

    // Initialize when controller loads
    $scope.initialize();
}]);
