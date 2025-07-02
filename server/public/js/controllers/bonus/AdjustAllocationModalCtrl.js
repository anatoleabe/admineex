angular.module('app').controller('AdjustAllocationModalCtrl', ['$scope', '$http', 'toastr', '$mdDialog', 'allocation',
function($scope, $http, toastr, $mdDialog, allocation) {
    // Initialize the form data
    $scope.selectedAllocation = {
        _id: allocation._id,
        personnelId: allocation.personnelId,
        status: allocation.status,
        calculatedAmount: allocation.calculatedAmount || 0,
        finalAmount: allocation.finalAmount || allocation.calculatedAmount || 0,
        calculationInputs: {
            parts: allocation.calculationInputs?.parts || allocation.parts || 0,
            comment: allocation.calculationInputs?.comment || ''
        },
        shareAmount: allocation.instanceId.shareAmount || 0
    };

    // Function to update final amount based on parts
    $scope.updateFinalAmount = function() {
        // Calculate final amount by multiplying parts by share amount
        $scope.selectedAllocation.finalAmount =
            $scope.selectedAllocation.calculationInputs.parts * $scope.selectedAllocation.shareAmount;

        // Ensure the final amount is a whole number
        $scope.selectedAllocation.finalAmount = Math.round($scope.selectedAllocation.finalAmount);
    };

    // Load allocation history
    $scope.loadHistory = function() {
        $http.get('/api/bonus/allocations/' + allocation._id + '/history')
            .then(function(response) {
                $scope.allocationHistory = response.data.history; // Updated to use the history array
                $scope.currentAllocation = response.data.current; // Added to store the current allocation
                console.log('Allocation history loaded', $scope.allocationHistory);
            })
            .catch(function(error) {
                console.error('Error fetching allocation history', error);
                toastr.error('Could not fetch allocation history');
                $scope.allocationHistory = [];
            });
    };

    // Save the adjusted allocation
    $scope.save = function() {
        if (!$scope.selectedAllocation.calculationInputs.comment) {
            toastr.error('Adjustment reason is required');
            return;
        }

        $scope.adjusting = true;

        const adjustmentData = {
            parts: $scope.selectedAllocation.calculationInputs.parts,
            amount: $scope.selectedAllocation.finalAmount,
            reason: $scope.selectedAllocation.calculationInputs.comment
        };

        $http.post('/api/bonus/allocations/' + allocation._id + '/adjust', adjustmentData)
            .then(function(response) {
                $scope.adjusting = false;
                $mdDialog.hide(response.data);
            })
            .catch(function(error) {
                console.error('Error adjusting allocation', error);
                toastr.error(error.data?.message || 'Could not adjust allocation');
                $scope.adjusting = false;
            });
    };

    // Cancel the modal
    $scope.cancel = function() {
        $mdDialog.cancel();
    };

    // Load history when controller initializes
    $scope.loadHistory();
}]);
