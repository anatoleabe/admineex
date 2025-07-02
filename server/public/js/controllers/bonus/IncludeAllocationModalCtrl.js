angular.module('app')
    .controller('IncludeAllocationModalCtrl', ['$scope', '$http', '$mdDialog', 'toastr', 'allocation', function($scope, $http, $mdDialog, toastr, allocation) {
    $scope.selectedAllocation = allocation || {}; // Ensure allocation is initialized properly
    $scope.including = false;

    // Initialize modal data
    $scope.initialize = function() {
        $scope.selectedAllocation.comment = $scope.selectedAllocation.comment || ''; // Initialize comment field
    };


        $scope.save = function() {
            if (!$scope.selectedAllocation) return;

            const allocationId = $scope.selectedAllocation._id;
            const includeData = {
                reason: $scope.selectedAllocation.comment || 'Manual exclusion'
            };

            $scope.including = true;

            $http.post('/api/bonus/allocations/' + allocationId + '/include', includeData)
                .then(function(response) {
                    $mdDialog.hide(response.data);
                    toastr.success('Allocation included');
                })
                .catch(function(error) {
                    console.error('Error including allocation', error);
                    toastr.error('Could not including allocation');
                    $scope.including = false;
                });
        };

    $scope.cancel = function() {
        $mdDialog.cancel();
    };

    // Call initialization
    $scope.initialize();
}]);
