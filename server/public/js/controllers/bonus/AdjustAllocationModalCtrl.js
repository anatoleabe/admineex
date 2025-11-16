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
            comment: allocation.calculationInputs?.comment || '',
            // expose sans-part fields for display
            txPercent: allocation.calculationInputs?.txPercent,
            sbi: allocation.calculationInputs?.sbi,
            subType: allocation.calculationInputs?.subType
        },
        shareAmount: (allocation.instanceId && allocation.instanceId.shareAmount) || 0,
        isSansPart: (allocation.templateId && allocation.templateId.category === 'without_parts')
    };

    // Function to update final amount based on parts (only for with_parts)
    $scope.updateFinalAmount = function() {
        if ($scope.selectedAllocation.isSansPart) return; // not applicable
        $scope.selectedAllocation.finalAmount = Math.round(($scope.selectedAllocation.calculationInputs.parts || 0) * ($scope.selectedAllocation.shareAmount || 0));
    };

    // Load allocation history
    $scope.loadHistory = function() {
        $http.get('/api/bonus/allocations/' + allocation._id + '/history')
            .then(function(response) {
                $scope.allocationHistory = response.data.history; // Updated to use the history array
                $scope.currentAllocation = response.data.current; // Added to store the current allocation
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

        var fd = new FormData();
        fd.append('parts', $scope.selectedAllocation.calculationInputs.parts);
        fd.append('amount', $scope.selectedAllocation.finalAmount);
        fd.append('reason', $scope.selectedAllocation.calculationInputs.comment);

        $http.post('/api/bonus/allocations/' + allocation._id + '/adjust', fd, {
            headers: { 'Content-Type': undefined }
        })
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
