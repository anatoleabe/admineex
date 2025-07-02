angular.module('app')
.controller('ExcludeAllocationModalCtrl', ['$scope', '$http', '$mdDialog', 'toastr', 'allocation', function($scope, $http, $mdDialog, toastr, allocation) {
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
        }
    };

    $scope.saveExcludedAllocation = function() {
        if (!$scope.selectedAllocation) return;

        const allocationId = $scope.selectedAllocation._id;
        const excludeData = {
            reason: $scope.selectedAllocation.calculationInputs.comment || 'Manual exclusion'
        };

        $scope.excluding = true;

        $http.post('/api/bonus/allocations/' + allocationId + '/exclude', excludeData)
            .then(function(response) {
                $mdDialog.hide(response.data);
                toastr.success('Allocation excluded');
            })
            .catch(function(error) {
                console.error('Error excluding allocation', error);
                toastr.error('Could not exclude allocation');
                $scope.excluding = false;
            });
    };

    $scope.cancel = function() {
        $mdDialog.cancel();
    };
}]);